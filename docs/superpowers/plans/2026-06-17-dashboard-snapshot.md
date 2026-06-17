# Dashboard Snapshot via Vercel KV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the Meta and YouTube dashboard reads from per-user n8n executions by serving a daily Vercel KV snapshot behind a 7-day session cookie. Eliminates the MSAL silent-renewal failure mode from the dashboard read path and caps n8n exec at 1/day.

**Architecture:** New Vercel routes (`/api/auth/session`, `/api/dashboard-snapshot`, `/api/dashboard-snapshot/refresh`) sit between the React hooks and Vercel KV. A new n8n cron workflow writes the snapshot to KV daily at 12:00 PM MYT. Session cookies (signed JWT, 7-day expiry) replace per-call MSAL bearer tokens on the read path. Existing admin passcode HMAC token reused for admin gating.

**Tech Stack:** Vercel serverless functions (TypeScript), Vercel KV (Upstash Redis), `@vercel/kv` SDK, `jose` for JWT (already installed), `lz-string` for payload compression (already installed), n8n cloud, React 19 hooks. No test framework — manual verification steps per task.

**Spec:** `docs/superpowers/specs/2026-06-17-dashboard-snapshot-design.md`

**Branching:** All tasks land on a new branch `feat/dashboard-snapshot` cut from `origin/staging`. Per the project's CLAUDE.md, never push to `staging` or `main` without explicit user approval — the rollout tasks pause for that confirmation.

---

## Phase 1: Backend helpers (foundation)

### Task 1: Extract MSAL ID-token verification helper

The current `/api/n8n-proxy.ts` inlines MSAL JWT verification. We need that same verification in the new `/api/auth/session` route. Extract it into a shared module so both routes import from one place.

**Files:**
- Create: `super-tool/ui/api/_lib/verifyMsalIdToken.ts`
- Modify: `super-tool/ui/api/n8n-proxy.ts:1-60`

- [ ] **Step 1: Create the helper file**

`super-tool/ui/api/_lib/verifyMsalIdToken.ts`:

```ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

const TENANT_ID = process.env.AZURE_TENANT_ID!
const CLIENT_ID = process.env.AZURE_CLIENT_ID!
const ALLOWED_DOMAIN = process.env.AZURE_ALLOWED_DOMAIN ?? 'astro.com.my'

// Lazily initialised so the module loads even if env vars are set after cold start.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)
    )
  }
  return jwks
}

export interface VerifiedMsalClaims {
  email: string
  payload: JWTPayload
}

export async function verifyMsalIdToken(authorizationHeader: string | undefined): Promise<VerifiedMsalClaims> {
  const token = authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.slice(7) : ''
  if (!token) throw new Error('UNAUTHORIZED')

  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    audience: CLIENT_ID,
  })

  const email = (payload.preferred_username as string) ?? ''
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    throw new Error('FORBIDDEN_DOMAIN')
  }

  return { email, payload }
}
```

- [ ] **Step 2: Refactor n8n-proxy to use the helper**

Replace lines 1-60 of `super-tool/ui/api/n8n-proxy.ts` with:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyMsalIdToken } from './_lib/verifyMsalIdToken'

const N8N_HOST = 'astroproduct.app.n8n.cloud'

// Per-webhook tokens + forwarding method. Keyed by path prefix on the n8n host.
// The n8n Webhook node must be configured with Header Auth using the same value.
type WebhookRule = {
  match: (path: string) => boolean
  token: string | undefined
  header: string
  method: 'GET' | 'POST'
}
const WEBHOOK_TOKENS: WebhookRule[] = [
  {
    match: (path) => path.startsWith('/webhook/dashboard') || path.startsWith('/webhook-test/dashboard'),
    token: process.env.DASHBOARD_WEBHOOK_TOKEN,
    header: 'dashboard-webhook-token',
    method: 'GET',
  },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await verifyMsalIdToken(req.headers.authorization)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AUTH_ERROR'
    if (msg === 'FORBIDDEN_DOMAIN') return res.status(403).json({ error: 'Forbidden: not an authorised domain' })
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // --- Forward to n8n --- (unchanged from here on; keep existing body)
```

Then the rest of the file (the n8nUrl validation + forward fetch) stays identical. The block being replaced is from `const TENANT_ID = process.env.AZURE_TENANT_ID!` down through the `} catch { return res.status(401).json({ error: 'Invalid or expired token' }) }` block.

- [ ] **Step 3: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.node.json
```

Expected: no output (clean).

- [ ] **Step 4: Manual smoke**

Manually compare the new helper's behaviour against the old inlined logic by reading both side-by-side. The replacement should be behaviour-equivalent: same token verification, same domain check, same error shape (401 vs 403).

- [ ] **Step 5: Commit**

```
cd super-tool && git add ui/api/_lib/verifyMsalIdToken.ts ui/api/n8n-proxy.ts
git commit -m "refactor(api): extract MSAL ID-token verification into shared helper"
```

---

### Task 2: Session JWT sign/verify helper

A small wrapper around `jose` for signing and verifying the `astro_session` cookie.

**Files:**
- Create: `super-tool/ui/api/_lib/jwtSession.ts`

- [ ] **Step 1: Create the helper**

`super-tool/ui/api/_lib/jwtSession.ts`:

```ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const COOKIE_NAME = 'astro_session'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_JWT_SECRET
  if (!raw) throw new Error('SESSION_JWT_SECRET not configured')
  return new TextEncoder().encode(raw)
}

export interface SessionClaims extends JWTPayload {
  sub: string  // user email
}

export async function signSession(claims: { sub: string }): Promise<string> {
  return await new SignJWT({ sub: claims.sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
  return payload as SessionClaims
}

export function sessionCookieHeader(jwt: string): string {
  return [
    `${COOKIE_NAME}=${jwt}`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Path=/`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ')
}

export function extractSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}
```

- [ ] **Step 2: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.node.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```
cd super-tool && git add ui/api/_lib/jwtSession.ts
git commit -m "feat(api): add session JWT sign/verify helper"
```

---

### Task 3: Admin token verifier (shared with existing admin-auth)

Extract the existing admin HMAC verification so the new refresh route can require admin without duplicating logic.

**Files:**
- Create: `super-tool/ui/api/_lib/verifyAdminToken.ts`
- Modify: `super-tool/ui/api/admin-auth.ts:1-42` — refactor to import shared logic

- [ ] **Step 1: Create the helper**

`super-tool/ui/api/_lib/verifyAdminToken.ts`:

```ts
import { createHmac, timingSafeEqual } from 'crypto'

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

export function generateAdminToken(secret: string): string {
  const expiresAt = String(Date.now() + TOKEN_TTL_MS)
  const sig = createHmac('sha256', secret).update(expiresAt).digest('hex')
  return `${expiresAt}.${sig}`
}

// Returns true when the token has a valid signature and has not yet expired.
export function verifyAdminToken(token: string | undefined, secret: string): boolean {
  if (!token) return false
  const [expiresAtRaw, sig] = token.split('.')
  if (!expiresAtRaw || !sig) return false

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

  const expected = createHmac('sha256', secret).update(expiresAtRaw).digest('hex')

  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Refactor admin-auth.ts to import the helper**

Replace `super-tool/ui/api/admin-auth.ts` body with:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'crypto'
import { generateAdminToken } from './_lib/verifyAdminToken'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.ADMIN_PASSCODE
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const passcode = (req.body as { passcode?: string })?.passcode ?? ''
  if (!passcode) {
    return res.status(400).json({ error: 'Passcode required' })
  }

  let match = false
  try {
    const a = Buffer.from(passcode)
    const b = Buffer.from(secret)
    match = a.length === b.length && timingSafeEqual(a, b)
  } catch {
    match = false
  }

  if (!match) {
    return res.status(401).json({ error: 'Incorrect passcode' })
  }

  return res.status(200).json({ token: generateAdminToken(secret) })
}
```

- [ ] **Step 3: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.node.json
```

Expected: clean.

- [ ] **Step 4: Manual smoke**

Compare both files side by side. `generateAdminToken()` produces the same shape (`<expiresAt>.<hex>`) as the previous inline code. Verifier is new, mirrors the signer.

- [ ] **Step 5: Commit**

```
cd super-tool && git add ui/api/_lib/verifyAdminToken.ts ui/api/admin-auth.ts
git commit -m "refactor(api): extract admin token sign/verify into shared helper"
```

---

### Task 4: Install `@vercel/kv` dependency

The Vercel KV SDK provides a thin client over the Upstash REST API.

**Files:**
- Modify: `super-tool/ui/package.json`
- Modify: `super-tool/ui/package-lock.json`

- [ ] **Step 1: Install**

```
cd super-tool/ui && npm install @vercel/kv
```

- [ ] **Step 2: Confirm install**

```
cd super-tool/ui && grep '@vercel/kv' package.json
```

Expected: prints the `@vercel/kv` line in `dependencies`.

- [ ] **Step 3: Type-check (sanity)**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.node.json
```

Expected: clean.

- [ ] **Step 4: Commit**

```
cd super-tool && git add ui/package.json ui/package-lock.json
git commit -m "feat(deps): add @vercel/kv for daily dashboard snapshots"
```

---

### Task 5: KV client wrapper with compression

Centralise KV read/write so route handlers stay focused. Handles the `lz-string` compression so the routes never see raw payloads.

**Files:**
- Create: `super-tool/ui/api/_lib/kv.ts`

- [ ] **Step 1: Create the wrapper**

`super-tool/ui/api/_lib/kv.ts`:

```ts
import { kv } from '@vercel/kv'
import LZString from 'lz-string'

export type SnapshotType = 'meta' | 'youtube'

function snapshotKey(type: SnapshotType): string {
  return `dashboard:${type}:current`
}

const STATUS_KEY = 'dashboard:status'

export interface SnapshotStatus {
  last_run_at: string
  last_meta_rows: number
  last_youtube_rows: number
  last_status: 'ok' | 'failed'
  last_error?: string
}

// Stored payload is LZString-compressed JSON to fit within Upstash's per-value cap.
export async function readSnapshot<T>(type: SnapshotType): Promise<T | null> {
  const compressed = await kv.get<string>(snapshotKey(type))
  if (!compressed) return null
  const json = LZString.decompressFromUTF16(compressed)
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

export async function readSnapshotStatus(): Promise<SnapshotStatus | null> {
  return (await kv.get<SnapshotStatus>(STATUS_KEY)) ?? null
}
```

Note: only READ helpers live in Vercel. The producer (n8n) writes to KV directly via the REST API — no SDK on that side.

- [ ] **Step 2: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.node.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```
cd super-tool && git add ui/api/_lib/kv.ts
git commit -m "feat(api): add KV client wrapper for compressed snapshot reads"
```

---

## Phase 2: Backend routes

### Task 6: POST /api/auth/session — mint the session cookie

**Files:**
- Create: `super-tool/ui/api/auth/session.ts`

- [ ] **Step 1: Create the route**

`super-tool/ui/api/auth/session.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyMsalIdToken } from '../_lib/verifyMsalIdToken'
import { signSession, sessionCookieHeader } from '../_lib/jwtSession'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let email: string
  try {
    const verified = await verifyMsalIdToken(req.headers.authorization)
    email = verified.email
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AUTH_ERROR'
    if (msg === 'FORBIDDEN_DOMAIN') return res.status(403).json({ error: 'Forbidden: not an authorised domain' })
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let jwt: string
  try {
    jwt = await signSession({ sub: email })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SIGN_ERROR'
    return res.status(500).json({ error: 'Server misconfigured', detail: msg })
  }

  res.setHeader('Set-Cookie', sessionCookieHeader(jwt))
  return res.status(200).json({ ok: true, email })
}
```

- [ ] **Step 2: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.node.json
```

Expected: clean.

- [ ] **Step 3: Manual smoke (local dev)**

Requires `vercel dev` and a real MSAL token. Defer to Task 21 (staging validation). For now, just verify the file compiles and the imports resolve.

- [ ] **Step 4: Commit**

```
cd super-tool && git add ui/api/auth/session.ts
git commit -m "feat(api): add /api/auth/session route to mint 7-day session cookie"
```

---

### Task 7: GET /api/dashboard-snapshot — read the snapshot

**Files:**
- Create: `super-tool/ui/api/dashboard-snapshot.ts`

- [ ] **Step 1: Create the route**

`super-tool/ui/api/dashboard-snapshot.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { extractSessionCookie, verifySession } from './_lib/jwtSession'
import { verifyAdminToken } from './_lib/verifyAdminToken'
import { readSnapshot, readSnapshotStatus, type SnapshotType } from './_lib/kv'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 1. Verify session cookie
  const cookie = extractSessionCookie(req.headers.cookie)
  if (!cookie) return res.status(401).json({ error: 'session_invalid' })
  try {
    await verifySession(cookie)
  } catch {
    return res.status(401).json({ error: 'session_invalid' })
  }

  // 2. Resolve query
  const type = String(req.query.type ?? '')
  if (type === 'meta' || type === 'youtube') {
    const payload = await readSnapshot(type as SnapshotType)
    if (!payload) return res.status(404).json({ error: 'snapshot_not_ready', type })
    res.setHeader('Cache-Control', 'private, max-age=300')
    return res.status(200).json(payload)
  }

  if (type === 'status') {
    // Admin-only — verify the admin HMAC token in X-Admin-Token
    const adminSecret = process.env.ADMIN_PASSCODE
    if (!adminSecret) return res.status(500).json({ error: 'Server misconfigured' })
    const adminToken = req.headers['x-admin-token']
    if (typeof adminToken !== 'string' || !verifyAdminToken(adminToken, adminSecret)) {
      return res.status(403).json({ error: 'admin_required' })
    }
    const status = await readSnapshotStatus()
    if (!status) return res.status(404).json({ error: 'snapshot_not_ready', type })
    return res.status(200).json(status)
  }

  return res.status(400).json({ error: 'invalid_type' })
}
```

- [ ] **Step 2: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.node.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```
cd super-tool && git add ui/api/dashboard-snapshot.ts
git commit -m "feat(api): add /api/dashboard-snapshot GET route reading from KV"
```

---

### Task 8: POST /api/dashboard-snapshot/refresh — trigger producer on demand

**Files:**
- Create: `super-tool/ui/api/dashboard-snapshot/refresh.ts`

(Note the directory rename — moving the read route into the same directory keeps the file structure clean. We'll do that in this task.)

- [ ] **Step 1: Move the read route into a subdirectory**

```
cd super-tool/ui/api && mkdir -p dashboard-snapshot && git mv dashboard-snapshot.ts dashboard-snapshot/index.ts
```

After this, the read route lives at `/api/dashboard-snapshot` (Vercel resolves `index.ts` under that path).

- [ ] **Step 2: Create the refresh route**

`super-tool/ui/api/dashboard-snapshot/refresh.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { extractSessionCookie, verifySession } from '../_lib/jwtSession'
import { verifyAdminToken } from '../_lib/verifyAdminToken'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 1. Verify session cookie
  const cookie = extractSessionCookie(req.headers.cookie)
  if (!cookie) return res.status(401).json({ error: 'session_invalid' })
  try {
    await verifySession(cookie)
  } catch {
    return res.status(401).json({ error: 'session_invalid' })
  }

  // 2. Verify admin token
  const adminSecret = process.env.ADMIN_PASSCODE
  if (!adminSecret) return res.status(500).json({ error: 'Server misconfigured' })
  const adminToken = req.headers['x-admin-token']
  if (typeof adminToken !== 'string' || !verifyAdminToken(adminToken, adminSecret)) {
    return res.status(403).json({ error: 'admin_required' })
  }

  // 3. Trigger n8n producer via its on-demand webhook
  const webhookUrl = process.env.N8N_REFRESH_WEBHOOK_URL
  const webhookToken = process.env.N8N_REFRESH_WEBHOOK_TOKEN
  if (!webhookUrl || !webhookToken) {
    return res.status(500).json({ error: 'Producer webhook not configured' })
  }

  try {
    // Fire-and-forget — n8n workflow takes ~10s; we return 202 immediately.
    void fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'dashboard-refresh-token': webhookToken },
      body: JSON.stringify({ triggered_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => { /* swallow — caller polls status to detect completion */ })

    return res.status(202).json({ ok: true, triggered_at: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'TRIGGER_ERROR'
    return res.status(502).json({ error: 'Failed to trigger producer', detail: msg })
  }
}
```

- [ ] **Step 3: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.node.json
```

Expected: clean.

- [ ] **Step 4: Commit**

```
cd super-tool && git add ui/api/dashboard-snapshot/
git commit -m "feat(api): add /api/dashboard-snapshot/refresh admin-only trigger"
```

---

## Phase 3: Producer (n8n + KV provisioning)

### Task 9: Provision Vercel KV in the Vercel staging project (operator)

This is an operator action — no code, but the env vars must exist before the routes work.

- [ ] **Step 1: Open the Vercel dashboard** for the staging project `supertool-staging-...`.

- [ ] **Step 2: Storage → Create Database → KV (Upstash Redis)**. Pick the region closest to the team (likely `sin1` / Singapore for Astro). Name it `kult-dashboard-staging-kv`.

- [ ] **Step 3: Connect the KV instance to the staging project.** This auto-creates four env vars: `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`.

- [ ] **Step 4: Add the manual env vars** in Project Settings → Environment Variables (Production + Preview + Development scopes):

| Name | Value |
|---|---|
| `SESSION_JWT_SECRET` | Generate a 32-byte random hex: `openssl rand -hex 32` |
| `N8N_REFRESH_WEBHOOK_URL` | `https://astroproduct.app.n8n.cloud/webhook/dashboard-snapshot-refresh` |
| `N8N_REFRESH_WEBHOOK_TOKEN` | Generate similarly: `openssl rand -hex 16` |
| `VITE_USE_DASHBOARD_SNAPSHOT` | `false` (off until rollout stage 5) |

- [ ] **Step 5: Note the values down** — they'll be needed in n8n credentials (Task 10).

- [ ] **Step 6: Sanity** — visit `/api/dashboard-snapshot?type=meta` on the deployed staging URL (after redeploy from the previous tasks). Should return 401 `session_invalid` (no cookie). That's the right error — confirms the route is alive and KV-aware.

---

### Task 10: Build the n8n producer workflow

This uses the n8n MCP to construct the workflow. The workflow has both a cron trigger and a webhook trigger feeding the same downstream nodes.

- [ ] **Step 1: Open the n8n SDK reference and node-suggestion via MCP**

Call `mcp__claude_ai_n8n__get_sdk_reference` (sections: `core`, `patterns`).

Call `mcp__claude_ai_n8n__get_suggested_nodes` with categories: `scheduling`, `http`, `data_transformation`, `error_handling`.

- [ ] **Step 2: Identify nodes**

- `Schedule Trigger` (cron at 12:00 MYT daily, recurrence `0 12 * * *` with timezone `Asia/Kuala_Lumpur`)
- `Webhook` (POST `/webhook/dashboard-snapshot-refresh`, Header Auth header `dashboard-refresh-token` matching `N8N_REFRESH_WEBHOOK_TOKEN`)
- `HTTP Request` to call the existing Sheets-reading n8n workflow at `https://astroproduct.app.n8n.cloud/webhook/dashboard-staging` (with the existing `dashboard-webhook-token`) — reuses all the existing parsing logic. This is the simplest path: don't duplicate Sheets-reading logic in the producer.
- `Code` node to LZString-compress the JSON payload (use the JavaScript `LZString` library available in n8n Code nodes via `require('lz-string')`).
- Two `HTTP Request` nodes to PUT to Vercel KV REST API:
  - `PUT {{KV_REST_API_URL}}/set/dashboard:meta:current` with Bearer `{{KV_REST_API_TOKEN}}` and body `<compressed-string>`
  - `PUT {{KV_REST_API_URL}}/set/dashboard:youtube:current` similarly
- One more PUT to set `dashboard:status` with the status JSON.

- [ ] **Step 3: Validate the workflow code**

Use `mcp__claude_ai_n8n__validate_workflow` with the full workflow JSON before creating.

- [ ] **Step 4: Create the workflow**

Call `mcp__claude_ai_n8n__create_workflow_from_code` with the validated code. Place it in the same project as the existing dashboard workflow. Name it `Snapshot Dashboards → Vercel KV [Staging]`. **Do NOT publish (activate) yet** — leave inactive until Task 11 confirms it works.

- [ ] **Step 5: Configure n8n credentials**

In the n8n UI, create credentials for:
- "Vercel KV Bearer" — type Header Auth, header `Authorization`, value `Bearer <KV_REST_API_TOKEN from Task 9>`
- "Dashboard Refresh Webhook Auth" — type Header Auth, header `dashboard-refresh-token`, value `<N8N_REFRESH_WEBHOOK_TOKEN from Task 9>`

Attach to the relevant nodes.

- [ ] **Step 6: Document**

Add a sticky note inside the workflow explaining: purpose (daily snapshot), schedule (12 PM MYT), dependencies (existing dashboard webhook + Vercel KV), error handling (status key reflects failure).

---

### Task 11: Run the producer manually and verify KV is populated

- [ ] **Step 1: Execute the producer workflow once manually** via the n8n UI (Execute Workflow button).

- [ ] **Step 2: Inspect each node's output** in the execution view. Confirm:
  - Sheets read returned ~5000 rows for Meta and ~400 rows for YT
  - Compression produced strings ~250 KB each
  - Both PUT requests returned `{ "result": "OK" }`
  - Status PUT also succeeded

- [ ] **Step 3: Verify KV from outside** by running this against the Vercel KV REST API:

```
curl -s -H "Authorization: Bearer <KV_REST_API_READ_ONLY_TOKEN>" \
  "<KV_REST_API_URL>/get/dashboard:status"
```

Expected: JSON with `last_run_at`, `last_meta_rows`, `last_youtube_rows`, `last_status: "ok"`.

- [ ] **Step 4: Activate the cron**

In n8n, toggle the workflow to Active. Next run will fire at 12:00 PM MYT.

- [ ] **Step 5: Confirm via mcp tool**

Call `mcp__claude_ai_n8n__publish_workflow` to ensure the workflow is published/active.

---

## Phase 4: Frontend session mint

### Task 12: `useSession` hook + AuthGate wiring

After MSAL completes inside AuthGate, call `/api/auth/session` once to mint the cookie. Subsequent requests carry the cookie automatically.

**Files:**
- Create: `super-tool/ui/src/hooks/useSession.ts`
- Modify: `super-tool/ui/src/components/AuthGate.tsx`

- [ ] **Step 1: Create the hook**

`super-tool/ui/src/hooks/useSession.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { loginRequest } from '../auth/msalConfig'

type SessionState = 'idle' | 'minting' | 'ready' | 'failed'

// Mints the astro_session cookie once per app load. Returns the current state so
// AuthGate can hold the UI until the cookie is in place before rendering protected
// routes. Idempotent — subsequent renders no-op when the cookie has been minted.
export function useSession(): { state: SessionState; mint: () => Promise<void> } {
  const { instance } = useMsal()
  const [state, setState] = useState<SessionState>('idle')
  const startedRef = useRef(false)

  const mint = async () => {
    setState('minting')
    try {
      const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
      if (!account) {
        setState('failed')
        return
      }
      const tokenResult = await instance.acquireTokenSilent({ ...loginRequest, account })
      const resp = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenResult.idToken}` },
        credentials: 'include',
      })
      if (resp.ok) {
        setState('ready')
      } else {
        setState('failed')
      }
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await instance.loginRedirect(loginRequest)
      } else {
        setState('failed')
      }
    }
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void mint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, mint }
}
```

- [ ] **Step 2: Wire into AuthGate**

Modify `super-tool/ui/src/components/AuthGate.tsx`. After the existing `if (!email.endsWith…)` block, before `return <>{children}</>`, add a session-mint gate:

```tsx
import { useSession } from '../hooks/useSession'

// Inside AuthGate, replace the final `return <>{children}</>` with:

const { state: sessionState, mint } = useSession()

if (sessionState === 'idle' || sessionState === 'minting') {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Preparing your session…</p>
      </div>
    </div>
  )
}

if (sessionState === 'failed') {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-6">
        <span className="text-xl font-semibold text-white">Session error</span>
        <p className="text-gray-400 text-sm text-center">
          We couldn't establish your session. Click to retry.
        </p>
        <button
          onClick={() => mint()}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg px-4 py-3 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

return <>{children}</>
```

- [ ] **Step 3: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.app.json
```

Expected: clean.

- [ ] **Step 4: Commit**

```
cd super-tool && git add ui/src/hooks/useSession.ts ui/src/components/AuthGate.tsx
git commit -m "feat(auth): mint astro_session cookie after MSAL login in AuthGate"
```

---

## Phase 5: Frontend hook rewrites

### Task 13: `useDashboardData` snapshot path behind feature flag

Add the snapshot fetch path without removing the existing `/api/n8n-proxy` path. The flag `VITE_USE_DASHBOARD_SNAPSHOT` selects between them.

**Files:**
- Modify: `super-tool/ui/src/hooks/useDashboardData.ts`

- [ ] **Step 1: Read the current state of the file**

Verify the file currently contains the in-flight guard and once-per-day cooldown from commit `589a004`. (Skip this verification if the file has been further modified.)

- [ ] **Step 2: Add the snapshot path inside `fetchData`**

Locate the block in `fetchData` that begins with `const useProxy = import.meta.env.PROD || import.meta.env.VITE_USE_PROXY === 'true'` (around line 130). Before that block, add:

```ts
const useSnapshot = import.meta.env.VITE_USE_DASHBOARD_SNAPSHOT === 'true'
if (useSnapshot) {
  // New snapshot path — read from /api/dashboard-snapshot, session cookie attached automatically.
  let resp = await fetch('/api/dashboard-snapshot?type=meta', { credentials: 'include' })

  // Cookie expired? Re-mint once and retry.
  if (resp.status === 401) {
    const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
    try {
      const tokenResult = await instance.acquireTokenSilent({ ...loginRequest, account })
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenResult.idToken}` },
        credentials: 'include',
      })
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await instance.loginRedirect(loginRequest)
        return
      }
      throw err
    }
    resp = await fetch('/api/dashboard-snapshot?type=meta', { credentials: 'include' })
  }

  if (resp.status === 404) {
    throw new Error('Snapshot not ready yet — please try again in a few minutes')
  }
  if (!resp.ok) {
    throw new Error(`Snapshot read failed: HTTP ${resp.status}`)
  }

  const responseItem = await resp.json() as any
  // Reuse the existing extraction code below by setting `result` to the same shape it would have produced.
  // The snapshot stores the same JSON shape that /api/n8n-proxy returned.
  let dataArray: DashboardRow[] = []
  let targetsArray: TargetRow[] = Array.isArray(responseItem.targets) ? responseItem.targets : []
  let bonusesData: Record<string, BonusRow[]> = {}

  if (Array.isArray(responseItem.data)) {
    dataArray = (responseItem.data as any[]).map((row: any) => ({
      ...row,
      brand: normalizeN8NBrand(row.brand) || row.brand,
    })) as DashboardRow[]
  }
  if (responseItem.bonuses && typeof responseItem.bonuses === 'object') {
    Object.entries(responseItem.bonuses as Record<string, BonusRow[]>).forEach(([brandName, bonuses]) => {
      const canonicalBrand = normalizeN8NBrand(brandName) || brandName
      bonusesData[canonicalBrand] = bonuses
    })
  }

  setData(dataArray)
  const normalizedTargets = targetsArray.map(t => {
    const canonicalBrand = normalizeN8NBrand(t.Brand) || t.Brand
    return { ...t, Brand: canonicalBrand }
  })
  setTargets(normalizedTargets)
  setBonuses(bonusesData)
  const updated = new Date()
  setLastUpdated(updated)
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    data: dataArray, targets: normalizedTargets, bonuses: bonusesData, lastUpdated: updated.toISOString(),
  }))
  return
}
```

The block is added inside the existing `try` and `if (useSnapshot) return` short-circuits before the `useProxy` block. The existing `useProxy` / `n8n-proxy` code stays untouched as the off-flag fallback.

- [ ] **Step 3: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.app.json
```

Expected: clean.

- [ ] **Step 4: Commit**

```
cd super-tool && git add ui/src/hooks/useDashboardData.ts
git commit -m "feat(dashboard): add snapshot fetch path to Meta hook behind VITE_USE_DASHBOARD_SNAPSHOT"
```

---

### Task 14: `useYouTubeDashboardData` snapshot path

Same shape as Task 13 — add the snapshot path behind the flag without removing the existing direct-webhook path.

**Files:**
- Modify: `super-tool/ui/src/hooks/useYouTubeDashboardData.ts`

- [ ] **Step 1: Add the snapshot path inside `fetchData`**

At the start of the `try { ... }` block of `fetchData`, before the existing `const webhookUrl = import.meta.env.VITE_YT_DASHBOARD_WEBHOOK_URL` line:

```ts
const useSnapshot = import.meta.env.VITE_USE_DASHBOARD_SNAPSHOT === 'true'
if (useSnapshot) {
  let resp = await fetch('/api/dashboard-snapshot?type=youtube', { credentials: 'include' })
  if (resp.status === 401) {
    // Session-mint retry — note this hook doesn't have direct MSAL access; rely on AuthGate having
    // minted the cookie. If it's truly stale, surface the failure and let AuthGate's session-mint
    // gate handle re-auth.
    throw new Error('Session expired — reload to re-authenticate')
  }
  if (resp.status === 404) {
    throw new Error('Snapshot not ready yet — please try again in a few minutes')
  }
  if (!resp.ok) {
    throw new Error(`Snapshot read failed: HTTP ${resp.status}`)
  }
  const responseItem = await resp.json() as any
  const dataArray: YouTubeDashboardRow[] = Array.isArray(responseItem.data) ? responseItem.data : []
  const targetsArray: YouTubeTargetRow[] = Array.isArray(responseItem.targets) ? responseItem.targets : []
  setData(dataArray)
  setTargets(targetsArray)
  const updated = new Date()
  setLastUpdated(updated)
  writeCache({ data: dataArray, targets: targetsArray, lastUpdated: updated.toISOString() })
  return
}
```

- [ ] **Step 2: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.app.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```
cd super-tool && git add ui/src/hooks/useYouTubeDashboardData.ts
git commit -m "feat(dashboard): add snapshot fetch path to YouTube hook behind VITE_USE_DASHBOARD_SNAPSHOT"
```

---

## Phase 6: Admin UI

### Task 15: `<SnapshotControl />` admin component

The Refresh Snapshot button. Shows the snapshot age, fires the refresh, polls for completion.

**Files:**
- Create: `super-tool/ui/src/components/SnapshotControl.tsx`

- [ ] **Step 1: Create the component**

`super-tool/ui/src/components/SnapshotControl.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { IconRefresh, IconCheck } from '@tabler/icons-react'

interface SnapshotStatus {
  last_run_at: string
  last_meta_rows: number
  last_youtube_rows: number
  last_status: 'ok' | 'failed'
  last_error?: string
}

interface Props {
  adminToken: string  // existing admin HMAC token from BrandContext / admin-auth flow
  onRefreshed?: () => void  // called after a successful refresh, so parent can refetch dashboard data
}

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 30_000

export function SnapshotControl({ adminToken, onRefreshed }: Props) {
  const [status, setStatus] = useState<SnapshotStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initial status fetch
  useEffect(() => {
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchStatus(): Promise<SnapshotStatus | null> {
    try {
      const resp = await fetch('/api/dashboard-snapshot?type=status', {
        credentials: 'include',
        headers: { 'X-Admin-Token': adminToken },
      })
      if (!resp.ok) return null
      const next = await resp.json() as SnapshotStatus
      setStatus(next)
      return next
    } catch {
      return null
    }
  }

  async function triggerRefresh() {
    setRefreshing(true)
    setError(null)
    const triggeredAt = Date.now()
    try {
      const resp = await fetch('/api/dashboard-snapshot/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Admin-Token': adminToken },
      })
      if (!resp.ok) throw new Error(`Trigger failed: HTTP ${resp.status}`)

      // Poll status until last_run_at moves past triggeredAt
      const deadline = Date.now() + POLL_TIMEOUT_MS
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
        const next = await fetchStatus()
        if (next && new Date(next.last_run_at).getTime() > triggeredAt) {
          if (next.last_status === 'failed') {
            setError(next.last_error ?? 'Producer reported failure')
          } else {
            onRefreshed?.()
          }
          return
        }
      }
      setError('Refresh did not complete within 30s — check n8n executions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const lastRunLabel = status
    ? `Last snapshot: ${new Date(status.last_run_at).toLocaleString()}`
    : 'No snapshot recorded yet'

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-600">{lastRunLabel}</span>
      <button
        onClick={triggerRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
      >
        <IconRefresh className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        {refreshing ? 'Refreshing snapshot…' : 'Refresh snapshot'}
      </button>
      {error && (
        <span className="text-xs text-red-600" title={error}>⚠ {error.slice(0, 60)}</span>
      )}
      {!error && status?.last_status === 'ok' && !refreshing && (
        <IconCheck className="w-4 h-4 text-emerald-600" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.app.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```
cd super-tool && git add ui/src/components/SnapshotControl.tsx
git commit -m "feat(dashboard): add admin SnapshotControl component for force-refresh"
```

---

### Task 16: `<SnapshotStaleBanner />` admin component

Banner that appears when the snapshot is more than 24h old OR `last_status === "failed"`.

**Files:**
- Create: `super-tool/ui/src/components/SnapshotStaleBanner.tsx`

- [ ] **Step 1: Create the component**

`super-tool/ui/src/components/SnapshotStaleBanner.tsx`:

```tsx
import { useEffect, useState } from 'react'

interface SnapshotStatus {
  last_run_at: string
  last_status: 'ok' | 'failed'
  last_error?: string
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000

export function SnapshotStaleBanner({ adminToken }: { adminToken: string }) {
  const [status, setStatus] = useState<SnapshotStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const resp = await fetch('/api/dashboard-snapshot?type=status', {
          credentials: 'include',
          headers: { 'X-Admin-Token': adminToken },
        })
        if (!resp.ok) return
        const next = await resp.json() as SnapshotStatus
        if (!cancelled) setStatus(next)
      } catch { /* swallow — banner is best-effort */ }
    }
    void load()
    return () => { cancelled = true }
  }, [adminToken])

  if (!status) return null

  const age = Date.now() - new Date(status.last_run_at).getTime()
  const isStale = age > STALE_THRESHOLD_MS
  const isFailed = status.last_status === 'failed'

  if (!isStale && !isFailed) return null

  const message = isFailed
    ? `Last snapshot failed — admins should investigate. ${status.last_error ?? ''}`.trim()
    : `Snapshot is ${Math.round(age / 3600_000)} hours old. The producer cron may have stalled.`

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800 flex items-center gap-2">
      <span className="font-medium">⚠ Snapshot warning:</span>
      <span>{message}</span>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.app.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```
cd super-tool && git add ui/src/components/SnapshotStaleBanner.tsx
git commit -m "feat(dashboard): add admin SnapshotStaleBanner for cron failures"
```

---

### Task 17: Mount admin controls in DashboardPage

**Files:**
- Modify: `super-tool/ui/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add imports and admin gating**

At the top of `DashboardPage.tsx`, add the imports:

```tsx
import { SnapshotControl } from '../components/SnapshotControl'
import { SnapshotStaleBanner } from '../components/SnapshotStaleBanner'
```

The page already pulls `isAdmin` from `useBrand()`. We also need the admin HMAC token. The token lives in localStorage under whichever key the admin-auth flow set it (verify by searching for `localStorage.getItem` calls related to admin in `super-tool/ui/src`). Read it locally inside the page:

```tsx
const adminToken = isAdmin ? (localStorage.getItem('astro_admin_token') ?? '') : ''
```

(Replace `'astro_admin_token'` with whatever key the existing code uses — check the admin-auth verifier on the frontend side.)

- [ ] **Step 2: Render the banner above the page header**

In the sticky-header section near the top of the JSX (after `<main className="pb-8">`), before the page-header div:

```tsx
{isAdmin && adminToken && <SnapshotStaleBanner adminToken={adminToken} />}
```

- [ ] **Step 3: Render the control next to the existing admin buttons**

Inside the `isAdmin && (<div className="flex gap-2">…)` block (around line 215 in DashboardPage.tsx), add SnapshotControl as the first child:

```tsx
{adminToken && (
  <SnapshotControl adminToken={adminToken} onRefreshed={() => refetch()} />
)}
```

`refetch` is already destructured from `useDashboardData()` at the top of the page.

- [ ] **Step 4: Type-check**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.app.json
```

Expected: clean.

- [ ] **Step 5: Commit**

```
cd super-tool && git add ui/src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): mount SnapshotControl + SnapshotStaleBanner for admins"
```

---

## Phase 7: Rollout

### Task 18: Push the branch (do NOT push to staging yet)

- [ ] **Step 1: Stash any local WIP first** (per project's branch-management rules)

```
cd super-tool && git stash push -m "pre-rollout-wip" -- $(git diff --name-only HEAD)
```

- [ ] **Step 2: Push the branch to origin**

```
cd super-tool && git push -u origin feat/dashboard-snapshot
```

- [ ] **Step 3: Get explicit user approval before pushing to staging.**

Stop here. Tell the user: "Branch `feat/dashboard-snapshot` is on remote. Per CLAUDE.md I do not auto-push to staging. Ready to fast-forward `origin/staging` to this branch's HEAD?"

Wait for explicit yes. Per CLAUDE.md, **never run `git push origin staging` without explicit approval**.

---

### Task 19: Fast-forward staging once approved

Only execute this task after explicit user approval from Task 18 step 3.

- [ ] **Step 1: Dry-run the push**

```
cd super-tool && git push --dry-run origin feat/dashboard-snapshot:staging
```

Expected: a fast-forward line like `<old>..<new>  feat/dashboard-snapshot -> staging`. If `(forced update)` appears, stop — that's not a fast-forward.

- [ ] **Step 2: Push**

```
cd super-tool && git push origin feat/dashboard-snapshot:staging
```

- [ ] **Step 3: Wait for Vercel to redeploy staging** (1-3 minutes). Confirm via the Vercel dashboard.

---

### Task 20: Validate on staging with flag OFF

The flag still defaults to `false`. The new code is on staging but inactive. Confirm nothing regressed.

- [ ] **Step 1: Hard-reload the staging URL**

```
https://supertool-git-staging-digitalproduct-2424s-projects.vercel.app/admin/dashboard
```

Use a fresh Incognito window for a clean session.

- [ ] **Step 2: Confirm dashboard renders** with the legacy `/api/n8n-proxy` path (verify in Network tab — should see `n8n-proxy` POST, NOT `dashboard-snapshot` GET).

- [ ] **Step 3: Confirm AuthGate's session-mint runs** — Network tab should show `POST /api/auth/session` returning 200, and a `Set-Cookie: astro_session=...` response header. (Even with the flag off, the session-mint happens after login because Task 12 wired it in.)

- [ ] **Step 4: Inspect Application tab** → Cookies → `astro_session` is present, HttpOnly, Secure, expires in 7 days.

- [ ] **Step 5: Verify nothing broke** for the existing flows: filtering by date, brand dropdown, charts render, weekly report page loads.

---

### Task 21: Flip the flag on staging

- [ ] **Step 1: In Vercel staging project Environment Variables**, change `VITE_USE_DASHBOARD_SNAPSHOT` from `false` to `true`.

- [ ] **Step 2: Redeploy staging.** Vercel UI → Deployments → latest → Redeploy (env var changes alone don't trigger rebuild).

- [ ] **Step 3: Hard-reload the staging URL in a fresh Incognito window.**

- [ ] **Step 4: Verify the new path in Network tab**

Should see:
- `POST /api/auth/session` → 200
- `GET /api/dashboard-snapshot?type=meta` → 200, response body is the JSON snapshot
- `GET /api/dashboard-snapshot?type=youtube` → 200
- NO calls to `/api/n8n-proxy`

- [ ] **Step 5: Verify dashboard renders correctly.** Date range advances to today-1. Brand dropdown works. Charts render.

- [ ] **Step 6: Force-refresh test (admin)** — log in as admin, click Refresh Snapshot. Wait up to 30 s. Verify:
  - `POST /api/dashboard-snapshot/refresh` returns 202
  - Polling `?type=status` advances `last_run_at`
  - Dashboard data refreshes

- [ ] **Step 7: 7-day cookie expiry simulation** — open DevTools → Application → Cookies → delete `astro_session`. Reload. Verify the hook returns 401, re-mints via MSAL silently, and the dashboard recovers.

- [ ] **Step 8: Stale banner test** — DevTools → Application → KV (not directly visible; verify by writing a stale value via curl) — set `dashboard:status.last_run_at` to 25h ago. Reload as admin. Banner should appear. Restore after testing.

---

### Task 22: Production rollout

After 2-3 days of staging validation with at least one observed natural cron run, replicate to production.

- [ ] **Step 1: Provision Vercel KV in the production project** (separate KV instance — do not share between staging and production). Same env-var pattern as Task 9.

- [ ] **Step 2: Create a production n8n cron workflow** (or clone the staging one and re-point to the production KV).

- [ ] **Step 3: Run the production producer manually** to populate KV.

- [ ] **Step 4: Set `VITE_USE_DASHBOARD_SNAPSHOT=true` on production.**

- [ ] **Step 5: Get explicit user approval to push to `main`.** Per CLAUDE.md, never push to main without approval.

- [ ] **Step 6: Once approved, fast-forward `main` to `staging`.**

```
cd super-tool && git push origin staging:main
```

- [ ] **Step 7: Monitor for 1 week.** Specifically watch:
  - n8n monthly execution count drops to ~30/month (one cron + occasional admin refresh)
  - No "Fetch error: timed_out" reports from editors
  - Cron fires at 12 PM MYT and `dashboard:status.last_run_at` advances daily

---

### Task 23: Cleanup — remove the legacy code path

After 1 week of stable production operation.

**Files:**
- Modify: `super-tool/ui/src/hooks/useDashboardData.ts`
- Modify: `super-tool/ui/src/hooks/useYouTubeDashboardData.ts`
- Delete: `super-tool/ui/api/n8n-proxy.ts`
- Modify: `super-tool/ui/.env.local`, `super-tool/ui/.env.staging`

- [ ] **Step 1: Delete the legacy hook branches**

In `useDashboardData.ts`, remove the entire `if (useProxy) { ... }` and dev-proxy branches added in commits `b6999f8` and earlier. The hook reduces to: try cache → if stale → call snapshot → on 401 → mint → retry → on 404 → error.

In `useYouTubeDashboardData.ts`, same — remove the direct webhook branch and keep only the snapshot path.

Also remove the `useSnapshot` feature flag check (it's now unconditional).

- [ ] **Step 2: Delete the legacy proxy route**

```
cd super-tool && git rm ui/api/n8n-proxy.ts
```

- [ ] **Step 3: Remove the feature-flag env var**

Remove `VITE_USE_DASHBOARD_SNAPSHOT` from `.env.local`, `.env.staging`, and Vercel environment variables.

- [ ] **Step 4: Type-check + manual smoke**

```
cd super-tool/ui && npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.node.json
```

Reload staging dashboard. Verify everything still works without the flag.

- [ ] **Step 5: Commit**

```
cd super-tool && git add -A
git commit -m "chore(dashboard): remove legacy /api/n8n-proxy path after snapshot rollout"
```

- [ ] **Step 6: Push branch + approval flow** as in Tasks 18-19 and 22.

---

## Self-review notes (already applied)

- Spec coverage: all 7 sections of the spec map to tasks. Auth route → T6. Read route → T7-T8. Producer → T9-T11. Frontend session mint → T12. Hook rewrites → T13-T14. Admin UI → T15-T17. Rollout → T18-T23.
- Type consistency checks: `SessionClaims`, `SnapshotType`, `SnapshotStatus`, `verifyAdminToken`, `extractSessionCookie` — all defined in the foundation phase and consumed consistently downstream. The `kv` SDK from `@vercel/kv` is imported only inside `_lib/kv.ts`; routes go through the wrapper.
- Manual verification stands in for automated tests; the spec acknowledged this.
- Branching rule embedded in T18 — stops before staging push, waits for explicit user approval.
