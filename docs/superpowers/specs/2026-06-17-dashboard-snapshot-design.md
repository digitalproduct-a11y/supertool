# Dashboard Snapshot via Vercel KV — Design Spec

- **Date:** 2026-06-17
- **Author:** brainstorm with Claude
- **Status:** Draft, pending implementation plan
- **Repo:** `super-tool/` (KULT Digital Kit)

## Problem

The Meta and YouTube dashboards under `/admin/dashboard` currently fetch live from n8n on every page open, every visibility flip, and every manual refresh. Three problems compound:

1. **n8n execution cost.** Every user × every tab × every refresh = one n8n workflow execution. With ~30 internal editors, this can hit thousands of executions per day for read-only data.
2. **MSAL silent-renewal fragility.** Long-lived tabs (open for days) hit expired ID tokens. MSAL tries to refresh via a hidden iframe; that iframe times out in real conditions (third-party cookie restrictions, browser throttling, network blips). When silent renewal fails, the dashboard read fails silently and users see stale data with no clear recovery path.
3. **Latency.** Each dashboard load waits 5-10 s on n8n + Google Sheets. KV-cached snapshot reads complete in ~20 ms.

The underlying Google Sheets data updates once a day at 11 AM Malaysia time (an existing external cron). Live per-user fetches add no freshness benefit — every editor would see identical data anyway.

## Goal

Decouple dashboard *reads* from n8n. The dashboards should:

- Serve sub-100 ms reads to all internal editors from a daily snapshot.
- Continue working when individual users' MSAL silent renewal fails.
- Cap n8n executions at one per day (the producer cron), not per user.
- Allow admins to force a fresh snapshot on demand when upstream data changes mid-day.

## Out of scope

- Removing MSAL entirely. MSAL stays the source of truth for "who is this user." Only the dashboard *read* path stops touching MSAL after login.
- Real-time freshness. Snapshot updates once a day; this is acceptable because the upstream sheet does too.
- Rate-limiting the admin Force Refresh button. Decided no rate limit for now; revisit if it becomes a problem.
- Email/Slack notification on cron failure. Decided banner-only for now.
- Migration of historical localStorage caches. New code reads/writes its own cache; old keys are ignored and naturally evicted.

## Architecture

Three independent moving parts:

```
PRODUCER (once at 12:00 PM MYT daily)
  n8n Cron Workflow → reads Google Sheets (Meta + YouTube) → PUTs JSON to Vercel KV
  Writes: dashboard:meta:current, dashboard:youtube:current, dashboard:status

AUTH (once at user login)
  Browser (MSAL login) → POST /api/auth/session
    → verifies MSAL ID token against Microsoft JWKS
    → checks email is @astro.com.my
    → issues signed JWT cookie astro_session (HttpOnly, Secure, 7-day expiry)

CONSUMER (every dashboard load)
  Browser → GET /api/dashboard-snapshot?type=meta
    → reads astro_session cookie
    → verifies JWT signature + expiry locally (no DB lookup)
    → reads dashboard:meta:current from KV (read-only token)
    → decompresses LZString payload
    → returns JSON (~20 ms)
  Admin:
  Browser → POST /api/dashboard-snapshot/refresh
    → same cookie verification + isAdmin check
    → triggers n8n cron workflow via on-demand webhook
    → returns 202 immediately (client polls /status for completion)
```

**Key property:** MSAL is touched at most once per 7 days per user (when the cookie expires and the frontend re-mints). The dashboard read path never invokes MSAL silent renewal — sidesteps the entire timeout failure mode.

## Components

### 1. Producer — n8n workflow `Snapshot Dashboards → Vercel KV`

A new workflow, separate from the existing `Fetch Data to Dashboard [Staging]` (ID `AH3FpGe9mSTgeRIo`). The existing read-on-demand workflow stays untouched during rollout and can be retired in stage 7.

**Shape:**

```
[Cron Trigger: 12:00 MYT daily]   [Webhook Trigger: /webhook/dashboard-snapshot-refresh]
                                  ↓ (both feed into the same flow)
                       [Read Sheets — Meta]   [Read Sheets — YouTube]
                                  ↓                      ↓
                       [Format payload as JSON]  [Format payload as JSON]
                                  ↓                      ↓
                       [HTTP PUT to Vercel KV     [HTTP PUT to Vercel KV
                          key=dashboard:meta:current  key=dashboard:youtube:current
                          body=compressed JSON]      body=compressed JSON]
                                  ↓                      ↓
                                  └────── [Merge] ───────┘
                                                ↓
                                  [HTTP PUT to Vercel KV
                                     key=dashboard:status
                                     body={last_run_at, last_meta_rows, last_youtube_rows, last_status}]
                                                ↓
                                             [Done]
```

The webhook trigger lets the admin Force Refresh button kick the same flow on demand. n8n runs the workflow for both triggers identically.

**Failure handling:** Each "Read Sheets" + "PUT" branch has an error-output edge. On failure, the workflow writes `{ last_status: "failed", last_error: <message> }` to `dashboard:status` and leaves the existing `dashboard:meta:current` / `dashboard:youtube:current` keys untouched. Yesterday's good snapshot stays in place. The staleness banner on the frontend picks up the failed status.

**Compression:** Apply `LZString.compressToUTF16` before the PUT. The Meta payload is ~2.4 MB raw; Vercel KV (Upstash) caps values at ~1 MB. The same `lz-string` package already used in [useYouTubeDashboardData.ts](super-tool/ui/src/hooks/useYouTubeDashboardData.ts) for the localStorage size constraint gets the Meta payload to ~250 KB.

**Auth on the n8n → KV write path:** n8n credentials hold `KV_REST_API_TOKEN` (read+write) and use it as a Bearer token on the HTTP Request node. The token is provisioned by Vercel when KV is created.

### 2. Storage — Vercel KV layout

| Key | Value | Read by | Written by |
|---|---|---|---|
| `dashboard:meta:current` | LZString-compressed JSON: `{ data: DashboardRow[], targets: TargetRow[], bonuses: Record<string,BonusRow[]>, lastUpdated: ISO8601 }` | `/api/dashboard-snapshot?type=meta` | Producer cron |
| `dashboard:youtube:current` | LZString-compressed JSON: `{ data: YouTubeDashboardRow[], targets: YouTubeTargetRow[], lastUpdated: ISO8601 }` | `/api/dashboard-snapshot?type=youtube` | Producer cron |
| `dashboard:status` | Plain JSON: `{ last_run_at: ISO8601, last_meta_rows: number, last_youtube_rows: number, last_status: "ok"\|"failed", last_error?: string }` | `/api/dashboard-snapshot?type=status` (admin only) and the staleness banner | Producer cron |

No TTL on any key. Keys overwrite-or-stay. A failed cron leaves yesterday's good data live and editable.

**Why three keys, not one combined blob:** decoupling lets the YouTube and Meta read paths be tested and rolled out independently, and lets the status be cheaply polled (small payload) without dragging the whole snapshot.

### 3. Auth route — `POST /api/auth/session`

A new Vercel serverless function under `super-tool/ui/api/auth/session.ts`.

**Behaviour:**

1. Reads `Authorization: Bearer <MSAL ID token>` from the request.
2. Verifies the ID token against Microsoft's JWKS, same code path as [n8n-proxy.ts:49-60](super-tool/ui/api/n8n-proxy.ts#L49-L60). Extract that verification into a shared helper `super-tool/ui/api/_lib/verifyMsalIdToken.ts` so both routes share it.
3. Pulls `preferred_username` (email) from the verified claims. Rejects if not `@astro.com.my` (or whatever `AZURE_ALLOWED_DOMAIN` env var says).
4. Builds JWT payload: `{ sub: email, iat: now, exp: now + 7d }`. Note: admin role is *not* encoded here — admin gating continues to use the existing passcode-based HMAC token issued by [admin-auth.ts](super-tool/ui/api/admin-auth.ts), kept intentionally separate so admin status survives independent of MSAL identity.
6. Signs with HMAC-SHA256 using `SESSION_JWT_SECRET` (new Vercel env var, 32-byte random string).
7. Sets cookie `astro_session=<JWT>`, attributes `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
8. Returns `200 { ok: true, isAdmin, email }` so the frontend can stash isAdmin in state.

**Frontend integration:** modify the existing `AuthGate` (or wherever MSAL resolution lands today) so that immediately after `acquireTokenSilent` returns a fresh token, it calls `POST /api/auth/session` with the bearer token. The fetch runs once per page session — the cookie does the work from there.

### 4. Snapshot read route — `GET /api/dashboard-snapshot`

A new Vercel serverless function under `super-tool/ui/api/dashboard-snapshot.ts`.

**Query string:** `?type=meta` | `?type=youtube` | `?type=status` (status requires admin)

**Behaviour:**

1. Reads the `astro_session` cookie.
2. Verifies the JWT using `SESSION_JWT_SECRET`. Rejects missing/invalid/expired with `401 { error: "session_invalid" }`.
3. If `type=status`, also requires a valid admin-auth bearer token in the `X-Admin-Token` header (verified against the same HMAC scheme as [admin-auth.ts](super-tool/ui/api/admin-auth.ts) — the existing pattern). Rejects missing/invalid admin token with `403`.
4. Builds the KV key: `dashboard:<type>:current` for meta/youtube, or `dashboard:status`.
5. Reads from Vercel KV using `KV_REST_API_READ_ONLY_TOKEN`.
6. If found:
   - Meta/YouTube: decompress with `LZString.decompressFromUTF16`, parse JSON, return as `200 application/json`. Headers: `Cache-Control: private, max-age=300` (5 min — lets rapid intra-SPA navigation between pages reuse the same response).
   - Status: return the raw JSON.
7. If not found: returns `404 { error: "snapshot_not_ready", type }`.

### 5. Force refresh route — `POST /api/dashboard-snapshot/refresh`

Admin-only manual snapshot trigger.

**Behaviour:**

1. Verify the session cookie (identity) AND the admin-auth bearer token in `X-Admin-Token` (admin role). Same checks as `/api/dashboard-snapshot?type=status`.
2. POST to the n8n webhook `/webhook/dashboard-snapshot-refresh` (the manual trigger leg added to the producer workflow) with the same Header Auth token used elsewhere.
3. Return `202 { ok: true, triggered_at: <ISO8601> }` immediately. Do not wait for the workflow to complete.

Frontend polls `/api/dashboard-snapshot?type=status` every 5 s for up to 30 s. When `last_run_at` exceeds the trigger time AND `last_status === "ok"`, it refreshes the dashboard data. If the 30 s budget expires without progress, surface an error toast pointing the admin to retry.

### 6. Frontend changes

Files affected:

- [`super-tool/ui/src/hooks/useDashboardData.ts`](super-tool/ui/src/hooks/useDashboardData.ts) — replace the MSAL-bearer + `/api/n8n-proxy` path with a cookie-bearing `GET /api/dashboard-snapshot?type=meta`. On 401, re-mint the session cookie once then retry. Drop the in-flight guard and once-per-day cooldown added on 2026-06-17 (commit `589a004`) — they exist to mitigate MSAL fragility that no longer applies on this read path. Keep the localStorage cache and the visibilitychange refetch (KV reads are cheap, so refetching on visibility is fine).
- [`super-tool/ui/src/hooks/useYouTubeDashboardData.ts`](super-tool/ui/src/hooks/useYouTubeDashboardData.ts) — same rewrite, hitting `?type=youtube`.
- [`super-tool/ui/src/components/AuthGate.tsx`](super-tool/ui/src/components/AuthGate.tsx) — after MSAL completes, call `POST /api/auth/session` once to mint the cookie.
- **New** `super-tool/ui/src/components/SnapshotControl.tsx` — admin-only component mounted in the dashboard header. Shows:
  - "Last snapshot: 12:02 PM today" (parsed from `dashboard:status.last_run_at`)
  - Refresh Snapshot button — POSTs to `/refresh`, shows spinner during the 30 s poll window, refreshes data on completion.
- **New** `super-tool/ui/src/components/SnapshotStaleBanner.tsx` — top-of-page banner, **admin only**. Visible when `dashboard:status.last_run_at` > 24 h ago OR `last_status === "failed"`. Includes the Refresh Snapshot button inline.

### 7. Rollback / feature flag

New Vite env var `VITE_USE_DASHBOARD_SNAPSHOT` (default `false` during dev, flipped to `true` during stage 5). When `false`, both hooks fall back to the existing `/api/n8n-proxy` code path. Letting the toggle ship before flipping it means a quick revert if the new path misbehaves on staging or production.

After stage 7, this toggle and the old `/api/n8n-proxy` route get removed.

## Sequence — typical user day

```
07:00 — User opens laptop, hard-reloads dashboard
  → MSAL acquires fresh ID token
  → AuthGate calls POST /api/auth/session
  → Cookie astro_session set (expires 2026-06-24)
  → useDashboardData fires GET /api/dashboard-snapshot?type=meta
  → Reads dashboard:meta:current from KV, returns ~20 ms
  → Dashboard rendered with yesterday's 12 PM snapshot

12:02 — Producer cron writes new snapshot
  → dashboard:meta:current overwritten with 12 PM data
  → dashboard:status.last_run_at advances to 12:02

14:30 — User Cmd-Tab back to the dashboard tab
  → visibilitychange fires
  → Hook checks isFromPreviousDay(lastUpdated) — returns true
  → GET /api/dashboard-snapshot?type=meta with cookie
  → Returns 200 in ~20 ms, dashboard updates to 12 PM snapshot

16:00 — Editor spots a wrong cell in the sheet, corrects it
  → digitalproduct admin clicks Refresh Snapshot
  → POST /api/dashboard-snapshot/refresh
  → n8n producer workflow runs out-of-cycle
  → 10 s later, dashboard:meta:current updated
  → Admin's dashboard picks up the new snapshot

Day 7 — 07:00, user opens tab, cookie has just expired
  → GET /api/dashboard-snapshot?type=meta returns 401
  → Hook calls mintSession() → POST /api/auth/session
  → MSAL acquireTokenSilent runs (for the dashboard read path, this is the only
    time MSAL renewal is triggered per 7-day window; other MSAL-protected routes
    may still trigger renewal independently)
  → New cookie issued, hook retries the read
  → Dashboard renders normally
```

## Sequence — failure modes

```
Cron fails at 12:00 PM
  → dashboard:status.last_status = "failed"
  → dashboard:meta:current still holds yesterday's good data
  → Stale banner appears for admins
  → Admin clicks Refresh Snapshot → producer retries → recovers

MSAL silent renewal fails at day-7 re-mint
  → POST /api/auth/session returns 401 (no valid bearer)
  → Frontend triggers MSAL loginRedirect → full browser redirect to MS
  → User signs in fresh → cookie minted → back to dashboard
  → Notes: the dashboard READ path is never blocked by this — only the once-a-week mint

Vercel KV outage
  → /api/dashboard-snapshot returns 500
  → Hook serves cached localStorage data
  → Once KV recovers, next fetch resumes normal flow

Vercel KV first-deploy / never-populated
  → /api/dashboard-snapshot returns 404 { error: "snapshot_not_ready" }
  → Hook surfaces a one-time toast: "Snapshot not ready — see ops"
  → Admin manually triggers Refresh Snapshot, KV populates, normal flow resumes
```

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `KV_REST_API_URL` | Vercel | Base URL for KV REST API (auto-set when KV is provisioned) |
| `KV_REST_API_TOKEN` | Vercel + n8n credential | Read+write token. Only the producer workflow uses this. |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel | Read-only token. Used by `/api/dashboard-snapshot` and `/refresh` for status reads. |
| `SESSION_JWT_SECRET` | Vercel | HMAC-SHA256 signing secret for `astro_session` cookie. 32-byte random hex string. Rotating it invalidates all sessions. |
| `VITE_USE_DASHBOARD_SNAPSHOT` | Vercel + `.env.local` | Feature flag. `true` = new path, `false` = legacy `/api/n8n-proxy`. |
| `N8N_REFRESH_WEBHOOK_URL` | Vercel | The on-demand webhook for the producer workflow. Internal — used by `/api/dashboard-snapshot/refresh`. |
| `N8N_REFRESH_WEBHOOK_TOKEN` | Vercel + n8n | Header Auth token for the refresh webhook. Same pattern as `DASHBOARD_WEBHOOK_TOKEN`. |

## Rollout plan

| Stage | What happens | Outcome |
|---|---|---|
| 1 | Code lands on staging with `VITE_USE_DASHBOARD_SNAPSHOT=false` | No user-visible change |
| 2 | Provision Vercel KV + set env vars on staging | KV ready, routes return 404 |
| 3 | Create n8n producer workflow, execute once manually | KV populated |
| 4 | Activate n8n cron at 12 PM MYT | Snapshot refreshes daily |
| 5 | Flip `VITE_USE_DASHBOARD_SNAPSHOT=true` on staging, test 2-3 users for a few days | Validates the read path |
| 6 | Same env-var flip on production. Monitor 1 week. | Production live |
| 7 | Delete the `/api/n8n-proxy` route, the legacy hook branch, and the feature flag | Cleanup |

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Vercel KV transient outage | Hooks serve localStorage cache; admin stale banner shows; KV outages are rare and recover automatically. |
| Cron fails 1+ days in a row | Yesterday's snapshot still served. Admin sees the stale banner and clicks Refresh Snapshot. |
| Compressed Meta payload still > 1 MB KV limit | Split by business unit into multiple keys (`dashboard:meta:aasb:current`, etc.). Defer until first real measurement. |
| `SESSION_JWT_SECRET` leaks | Rotate the env var. All existing sessions invalidate; users get bounced to MSAL re-login. Low impact for internal tool. |
| n8n cron disabled by accident | Stale banner triggers within 24 h. Producer reactivation restores normal flow. |
| Editors confused that data only updates daily | The existing "Last updated: …" footer already shows the snapshot time; editors already understand T-2 data delay. No new education needed. |

## Success criteria

1. Across a 1-week production observation window, the per-day n8n execution count for the dashboard fetch drops from O(thousands) to O(1).
2. The "Fetch error: timed_out" entries reported in editor browser consoles drop to ~0 for dashboard reads.
3. The Meta dashboard renders within 1 s of page load (vs current 5-10 s).
4. Admins successfully use the Refresh Snapshot button when they spot upstream sheet corrections.
5. The stale banner correctly surfaces a missed cron run within 24 h of failure.

## Open questions (none blocking)

- Should the producer workflow also write a per-brand "lite" snapshot for the HomePage cards, or is the full snapshot fine? → Defer to first measurement; full snapshot likely fine after compression.
- Long-term: do we ever want to remove MSAL entirely and use email + magic link? → Out of scope; revisit only if Astro IT pushes for it.
