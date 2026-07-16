# Finding 4 — Missing WAF & Rate Limiting

Runbook for closing pentest Finding 4 (MEDIUM). Covers what changed in code and the
dashboard/infra steps that must be done by hand to finish the fix.

## Summary of the fix

| Layer | What | Where |
|-------|------|-------|
| Rate limit + lockout (admin) | KV-backed, 5 req/min/IP + exponential lockout after 5 wrong passcodes | `api/admin-auth.ts` (code — done) |
| Rate limit (brand + history) | Per-IP throttle inside the validating n8n workflows | n8n — **done** (see below) |
| Brute-force UX | 429 → cooldown countdown, inputs disabled | Admin / Brand / History passcode modals (code — done) |
| CAPTCHA | Cloudflare Turnstile after 3 fails on all three gates | code — done, **dormant until keys set** |
| Security headers | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy | `vercel.json` (code — done) |
| WAF | Cloudflare in front of a custom domain | dashboard (see below) |
| Anti-bypass | Edge middleware rejects sensitive paths not proxied by Cloudflare | `middleware.ts` (code — done, inert until `CF_GUARD_SECRET` set) |

The rate limiter reuses the **existing** `@vercel/kv` store (already used by
`api/dashboard-snapshot`). No new infrastructure for the admin fix. It **fails open** if KV is
unreachable, so a KV outage cannot lock admins out — Cloudflare rate limiting is the backstop.

## Tunables (`api/admin-auth.ts`)

- `RATE_LIMIT` = 5 requests / `RATE_WINDOW_SEC` = 60s per IP (any outcome)
- `FAIL_THRESHOLD` = 5 wrong passcodes / `FAIL_WINDOW_SEC` = 15 min → lockout
- Lockout: `BASE_LOCK_SEC` = 60s, doubling each cycle, capped at `2^MAX_LOCK_LEVEL` (~64 min)
- Success clears all counters for that IP.

---

## Ops step 0 — Enable CAPTCHA (Cloudflare Turnstile)

Turnstile does **not** need the domain/zone — a free Cloudflare account is enough. In the
Cloudflare dashboard → Turnstile → add a widget with hostnames `kult-kit.vercel.app`,
`localhost`, and any custom domain. Then set:

- `VITE_TURNSTILE_SITE_KEY` (public site key) in Vercel env — client renders the widget.
- `TURNSTILE_SECRET_KEY` (secret) in Vercel env — `api/admin-auth.ts` verifies via `siteverify`.
- n8n var `TURNSTILE_SECRET` (same secret) — the History Fetch + Brand Validator Code nodes verify.

Behaviour: after **3 failed attempts** the widget appears and a valid token is required for the
next attempt (progressive — normal users never see it). All code is **feature-flagged off** until
these keys exist, so nothing changes until you set them. Local dev keys for testing:
site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (Cloudflare's
"always passes" test pair). **After setting the real n8n `TURNSTILE_SECRET`, do one live test of
the brand/history gates** — the Code-node `siteverify` call uses `this.helpers.httpRequest`, so
confirm a solved challenge is accepted.

## Ops step 1 — Cloudflare WAF (needs a domain you control)

**A Cloudflare account alone is not enough for the WAF** — Cloudflare only filters traffic for
domains added as a *zone*, which requires controlling that domain's DNS. `*.vercel.app` cannot be
added (Vercel owns it). Pick one:

- **Custom domain → Cloudflare (recommended):** e.g. `kult.astro.com.my` (ask the Astro DNS team)
  or any cheap standalone domain. Add it to Vercel + Cloudflare (proxied). Full WAF + rate limiting
  + Turnstile in one console; surest `wafw00f` pass.
- **No domain possible → Vercel WAF (fallback):** Vercel's built-in Firewall runs on the bare
  `*.vercel.app` — managed ruleset + custom + rate-limit rules in the Vercel dashboard, no DNS
  change. Needs a **Vercel Pro** plan; `wafw00f` detection is weaker than Cloudflare.

The steps below assume the Cloudflare path.

1. Add a custom domain (e.g. `kult.astro.com.my`) to the Vercel project.
2. In Cloudflare, add the domain and set the DNS record for it to **Proxied** (orange cloud).
3. Update MSAL redirect URIs (Azure app registration) and any hardcoded URLs to the new domain.
4. **WAF → Managed rules:** enable the Cloudflare Managed Ruleset (OWASP core). This is what a
   `wafw00f` re-test detects.
5. **Security → Bots:** enable Bot Fight Mode.
6. **Security → WAF → Rate limiting rules:**
   - `/api/admin-auth` → 5 requests / minute / IP → Block.
   - `/webhook/*` → a sane cap (e.g. 30/min/IP) → Block.

### Prevent WAF bypass (direct-to-origin)

Sensitive endpoints must only be reachable *through* Cloudflare:

1. Generate a random secret. Add it to Vercel env as `CF_GUARD_SECRET` (all environments).
2. Cloudflare **Rules → Transform Rules → Modify Request Header**: add
   `x-cf-guard: <same secret>` on all requests to the domain.
3. `middleware.ts` (already deployed) rejects requests to `/api/admin-auth` and `/webhook/*`
   that lack the matching header with `403`. Until `CF_GUARD_SECRET` is set it does nothing, so
   deploy order does not matter.

---

## Ops step 2 — Rate-limit the n8n passcode webhooks (DONE)

The **brand** (`brand-passcode-validate`) and **history** (`history-fetch`) passcodes are validated
inside n8n and are called on `astroproduct.app.n8n.cloud` directly — Cloudflare/Vercel never sees
them, so limiting lives in the workflows.

**Implemented** in each validating Code node using `$getWorkflowStaticData('global')` as a per-IP
counter (no Data Table needed — avoids the project-scope gotcha). Client IP =
`headers['cf-connecting-ip']` → first `x-forwarded-for`. 5 failures → escalating lockout
(60s doubling, cap ~64 min); success clears the counter; stale entries pruned after 1h.

- **History Fetch** (`Y3vvEM51XPfqz1yp`, node **Filter & Authorize**): counts non-admin passcode
  failures; returns `{ status: 'RATE_LIMITED', message, retryAfter, rows: [] }` when locked.
  Live-tested: 5th wrong attempt flips to `RATE_LIMITED`.
- **Brand Passcode Validator** (`vqqgSCoXcpGDS2Z8`, node **Validate Passcode**): keyed per
  IP+brand; returns `{ success: false, requires_passcode: true, retryAfter, message }` when locked.

Both are active and validated (0 errors). The client already understands these:
- `services/historyLog.ts` maps `status: 'RATE_LIMITED'` / HTTP 429 → cooldown message.
- `components/BrandPasscodeModal.tsx` maps HTTP 429 / `retryAfter` → cooldown countdown.

> Note: n8n static data persists on **production** (webhook) executions, not manual test runs.
> If thresholds need tuning, edit the `FAIL_THRESHOLD` / `BASE_LOCK_MS` consts in each Code node.

---

## Ops step 3 — Rotate the admin passcode

`ADMIN_PASSCODE` was exercised during the pentest. Rotate it in Vercel env (Production +
Preview) as hygiene. It is **not** committed to git (`.env*` is gitignored).

---

## Verification

1. **Admin brute-force:** loop wrong-passcode POSTs to `/api/admin-auth` → `401`s then `429` +
   `Retry-After`; modal shows a live cooldown and disables the input. Correct passcode after
   expiry succeeds and resets counters.
2. **n8n gates:** replay POSTs past the threshold → `RATE_LIMITED`; brand/history modals show the
   cooldown.
3. **WAF:** `wafw00f https://kult.astro.com.my` detects Cloudflare. A direct request to
   `/api/admin-auth` on the `*.vercel.app` origin (no `x-cf-guard`) returns `403`.
4. **Headers:** `curl -I https://kult.astro.com.my` shows the security headers; app still loads.
