# History Log Download — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every post-generation and schedule action (who/what/brand/when) to a central Google Sheet via n8n, and give editors a brand-scoped History page that exports a date-ranged Excel log (admins freely, brand users behind a passcode).

**Architecture:** Browser fires a fire-and-forget `logHistoryEvent()` on each tracked event → n8n ingest workflow appends a Sheet row. A new History page reads brand rows for an in-page table and, on Download, calls an n8n fetch workflow that enforces the passcode (or trusts `is_admin`) and returns date-ranged rows the client turns into `.xlsx`.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind, `xlsx` (SheetJS), `@azure/msal-browser`, n8n cloud workflows, Google Sheets.

> **No test runner in this repo** (no vitest/jest, zero test files). Per-task verification is: `npm run build` (runs `tsc -b` — the real typecheck gate), `npm run lint`, n8n `validate_workflow` + `test_workflow`, and manual runtime checks. Do NOT add a test harness — it's out of scope. Run all `npm`/`git` commands from `ui/` unless noted.

---

## File Structure

**New**
- `ui/src/services/historyLog.ts` — logging + fetch service, identity helper, shared types.
- `ui/src/pages/HistoryLogPage.tsx` — brand-scoped table + date range + download.
- `ui/src/components/HistoryPasscodeModal.tsx` — passcode entry for brand-user downloads.

**Modified**
- `ui/src/auth/msalConfig.ts` + `ui/src/main.tsx` — export the MSAL singleton so non-React code can read identity.
- `ui/src/pages/ArticleToSocialPage.tsx` — log `generated`/`error` in `handleGenerate`; centralize `scheduled` logging in `postToFacebook`/`scheduleCarousel`; pass meta + `edited_fields` from call sites.
- `ui/src/pages/CmsPostPage.tsx` — log CMS `generated`/`error`.
- `ui/src/components/Sidebar.tsx` — add `history-log` to `ToolId`, `navSections` (Others), `TOOL_NAMES`.
- `ui/src/App.tsx` — add `history-log` to local `ToolId`, `pathToTool`, `toolToPath`, and a route.
- `ui/.env.local`, `ui/.env.production` — add two `VITE_` webhook URLs.

**Backend (n8n + Google)**
- Google Sheet "KULT History Log" (header row).
- n8n workflow "History Log Ingest" (webhook → append row).
- n8n workflow "History Fetch" (webhook → auth → read → filter → respond).

---

## Phase A — Backend (build & verify the pipeline first)

### Task 1: Create the Google Sheet

**Files:** none (external resource).

- [ ] **Step 1: Create the Sheet**

Create a Google Sheet named **KULT History Log**, tab **Log**, with this exact header row in row 1 (columns A–R):

```
event_id  server_time  client_time  event_type  user_email  user_name  brand  tool_post_type  source_page  article_url  source_domain  title  caption  image_url  scheduled_for  edited_fields  status  error_message
```

- [ ] **Step 2: Record the Sheet ID**

Copy the spreadsheet ID from its URL (`https://docs.google.com/spreadsheets/d/<ID>/edit`). It is used by both n8n workflows in Tasks 2 and 3.

Expected: a Sheet with 18 headers and an empty data area.

---

### Task 2: n8n "History Log Ingest" workflow

**Files:** none (built via n8n MCP tools).

Node graph: **Webhook (POST)** → **Set "Normalize"** → **Google Sheets (Append)** → **Respond to Webhook**, with an **error branch** off the Sheets node → **Respond (error)**.

- [ ] **Step 1: Read the SDK reference and discover nodes**

Run (MCP): `get_sdk_reference`, then `get_suggested_nodes` for webhook + Google Sheets append, then `search_nodes` for `["webhook","set","google sheets","respond to webhook"]`, then `get_node_types` for the exact IDs. Do not guess parameter names.

- [ ] **Step 2: Configure the Webhook node**

Method `POST`, path `history-log-ingest`, response mode "Using Respond to Webhook". This URL becomes `VITE_HISTORY_LOG_WEBHOOK_URL`.

- [ ] **Step 3: Configure the "Normalize" Set node**

Stamp the authoritative server time and pass through the body. Set these fields (string), values are n8n expressions:

```
server_time   = {{ $now.toISO() }}
event_id      = {{ $json.body.event_id }}
client_time   = {{ $json.body.client_time }}
event_type    = {{ $json.body.event_type }}
user_email    = {{ $json.body.user_email }}
user_name     = {{ $json.body.user_name }}
brand         = {{ $json.body.brand }}
tool_post_type= {{ $json.body.tool_post_type }}
source_page   = {{ $json.body.source_page }}
article_url   = {{ $json.body.article_url }}
source_domain = {{ $json.body.source_domain }}
title         = {{ $json.body.title }}
caption       = {{ $json.body.caption }}
image_url     = {{ $json.body.image_url }}
scheduled_for = {{ $json.body.scheduled_for }}
edited_fields = {{ $json.body.edited_fields }}
status        = {{ $json.body.status }}
error_message = {{ $json.body.error_message }}
```

- [ ] **Step 4: Configure Google Sheets (Append)**

Operation **Append**, document = the Sheet ID from Task 1, sheet = **Log**, mapping mode "Map each column manually", map all 18 columns to the matching `{{ $json.<field> }}`. Use the existing Google Sheets credential (`list_credentials` to find it).

- [ ] **Step 5: Add error handling + sticky note**

On the Sheets node set "On Error → Continue (error output)"; wire the error output to a **Respond to Webhook** returning `{ "status": "ERROR" }` (HTTP 200 — logging is best-effort and must never surface to the user). Success path responds `{ "status": "OK" }`. Add a sticky note: purpose ("append one KULT usage event per call"), required credential, and the target Sheet ID.

- [ ] **Step 6: Validate and create**

Run (MCP) `validate_workflow`; fix errors; `create_workflow_from_code` with a description.

- [ ] **Step 7: Test**

Run (MCP) `n8n_test_workflow` (or `execute_workflow`) with a sample body:

```json
{ "body": { "event_id": "test-1", "client_time": "2026-06-25T08:00:00.000Z", "event_type": "generated", "user_email": "tester@astro.com.my", "user_name": "Tester", "brand": "Astro Awani", "tool_post_type": "photo", "source_page": "article_to_social", "article_url": "https://astroawani.com/x", "source_domain": "astroawani.com", "title": "Demo", "caption": "Demo caption", "image_url": "https://img", "scheduled_for": "", "edited_fields": "", "status": "success", "error_message": "" } }
```

Expected: response `{ "status": "OK" }` and a new row in the Sheet with a populated `server_time`.

---

### Task 3: n8n "History Fetch" workflow

**Files:** none (built via n8n MCP tools).

Node graph: **Webhook (POST)** → **Google Sheets (Read rows)** → **Code "Filter & Authorize"** → **Respond to Webhook**.

- [ ] **Step 1: Discover nodes**

As Task 2 Step 1, plus `search_nodes` for `["code"]` and `get_node_types` for the Code node.

- [ ] **Step 2: Configure the Webhook node**

Method `POST`, path `history-fetch`, response mode "Using Respond to Webhook". This URL becomes `VITE_HISTORY_FETCH_WEBHOOK_URL`. Expected body:

```json
{ "brand": "Astro Awani", "mode": "view|download", "from": "2026-06-01", "to": "2026-06-25", "passcode": "", "is_admin": false }
```

- [ ] **Step 3: Configure Google Sheets (Read)**

Operation **Read/Get rows**, document = Sheet ID from Task 1, sheet = **Log**, return all rows. (Filtering happens in the Code node so date logic is exact.)

- [ ] **Step 4: Configure the Code "Filter & Authorize" node**

Mode "Run Once for All Items". Paste this JavaScript verbatim (the passcode lives here, server-side only):

```javascript
const HISTORY_PASSCODE = 'history101123!'; // server-side only — never shipped to the browser
const VIEW_CAP = 200;

const req = $('Webhook').first().json.body || {};
const mode = req.mode === 'download' ? 'download' : 'view';
const isAdmin = req.is_admin === true || req.is_admin === 'true';

// Auth: downloads require admin OR the correct passcode. Viewing is open (brand-scoped).
if (mode === 'download' && !isAdmin && req.passcode !== HISTORY_PASSCODE) {
  return [{ json: { status: 'AUTH_ERROR', message: 'Incorrect passcode.', rows: [] } }];
}

const brand = String(req.brand || '').trim().toLowerCase();
const from = req.from ? new Date(req.from + 'T00:00:00') : null;
const to = req.to ? new Date(req.to + 'T23:59:59.999') : null;

const all = items.map(i => i.json);
let rows = all.filter(r => String(r.brand || '').trim().toLowerCase() === brand);

rows = rows.filter(r => {
  const t = new Date(r.server_time);
  if (isNaN(t.getTime())) return true; // keep rows with unparZseable timestamps rather than drop silently
  if (from && t < from) return false;
  if (to && t > to) return false;
  return true;
});

// newest first
rows.sort((a, b) => new Date(b.server_time) - new Date(a.server_time));

if (mode === 'view') rows = rows.slice(0, VIEW_CAP);

return [{ json: { status: 'OK', rows } }];
```

> Note: fix the typo `unparZseable` → `unparseable` when pasting (artifact guard — confirm the word reads "unparseable").

- [ ] **Step 5: Respond + sticky note**

**Respond to Webhook** returns `{{ $json }}` (the Code node output: `{ status, rows, message? }`). Add a sticky note documenting: viewing is open/brand-scoped, downloads need admin or passcode, and that `HISTORY_PASSCODE` is intentionally inline (server-side).

- [ ] **Step 6: Validate, create, test**

`validate_workflow` → fix → `create_workflow_from_code`. Then `n8n_test_workflow` three times:
- `{ "body": { "brand": "Astro Awani", "mode": "view", "from": "2026-06-01", "to": "2026-06-30" } }` → `status: OK`, includes the Task 2 test row.
- `{ "body": { "brand": "Astro Awani", "mode": "download", "is_admin": false, "passcode": "wrong", "from": "2026-06-01", "to": "2026-06-30" } }` → `status: AUTH_ERROR`.
- `{ "body": { "brand": "Astro Awani", "mode": "download", "is_admin": false, "passcode": "history101123!", "from": "2026-06-01", "to": "2026-06-30" } }` → `status: OK` with rows.

---

## Phase B — Client service

### Task 4: Export the MSAL singleton

**Files:**
- Modify: `ui/src/auth/msalConfig.ts`
- Modify: `ui/src/main.tsx:5,14,20-24`

- [ ] **Step 1: Construct + export the instance in msalConfig.ts**

Append to `ui/src/auth/msalConfig.ts` (add the import at top):

```typescript
import { PublicClientApplication, type Configuration, LogLevel } from '@azure/msal-browser'

// ...existing msalConfig and loginRequest unchanged...

// Single shared instance so non-React modules (e.g. services/historyLog.ts) can read the
// signed-in account without the useMsal() hook. main.tsx initialize()s this same object.
export const msalInstance = new PublicClientApplication(msalConfig)
```

(Merge the `PublicClientApplication` into the existing `@azure/msal-browser` import line; keep `type Configuration` and `LogLevel`.)

- [ ] **Step 2: Use the shared instance in main.tsx**

In `ui/src/main.tsx`, remove the local construction and import the singleton:

```typescript
// remove: import { PublicClientApplication } from '@azure/msal-browser'
// remove: const msalInstance = new PublicClientApplication(msalConfig)
import { msalConfig, msalInstance } from './auth/msalConfig.ts'
```

Leave `msalInstance.initialize().then(...)` and `<MsalProvider instance={msalInstance}>` unchanged. (`msalConfig` import stays even if now only re-exported — keep it if still referenced elsewhere in the file; otherwise drop it.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS (no TS errors). This confirms the singleton refactor compiles before anything depends on it.

- [ ] **Step 4: Commit**

```bash
git add ui/src/auth/msalConfig.ts ui/src/main.tsx
git commit -m "refactor: export shared MSAL instance for non-React modules"
```

---

### Task 5: Create the history log service

**Files:**
- Create: `ui/src/services/historyLog.ts`
- Modify: `ui/.env.local`, `ui/.env.production`

- [ ] **Step 1: Add env vars**

Append to both `ui/.env.local` and `ui/.env.production` (use the real webhook URLs from Tasks 2 & 3):

```
VITE_HISTORY_LOG_WEBHOOK_URL=https://astroproduct.app.n8n.cloud/webhook/history-log-ingest
VITE_HISTORY_FETCH_WEBHOOK_URL=https://astroproduct.app.n8n.cloud/webhook/history-fetch
```

- [ ] **Step 2: Write the service**

Create `ui/src/services/historyLog.ts`:

```typescript
import { msalInstance } from '../auth/msalConfig'
import { extractDomain } from '../utils/analytics'

const LOG_URL = (import.meta.env.VITE_HISTORY_LOG_WEBHOOK_URL as string | undefined)?.trim()
const FETCH_URL = (import.meta.env.VITE_HISTORY_FETCH_WEBHOOK_URL as string | undefined)?.trim()

export type HistoryEventType = 'generated' | 'scheduled' | 'error' | 'downloaded'

export interface HistoryEventInput {
  eventType: HistoryEventType
  brand: string
  toolPostType: string          // photo | carousel | quickfact | quote | cms | history_export
  sourcePage: string            // article_to_social | cms | history_log
  articleUrl?: string
  title?: string
  caption?: string
  imageUrl?: string
  scheduledFor?: string
  editedFields?: string[]
  status: 'success' | 'error'
  errorMessage?: string
}

export interface HistoryRow {
  event_id: string
  server_time: string
  client_time: string
  event_type: string
  user_email: string
  user_name: string
  brand: string
  tool_post_type: string
  source_page: string
  article_url: string
  source_domain: string
  title: string
  caption: string
  image_url: string
  scheduled_for: string
  edited_fields: string
  status: string
  error_message: string
}

function getCurrentUser(): { email: string; name: string } {
  try {
    const acct = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]
    return { email: acct?.username ?? '', name: acct?.name ?? '' }
  } catch {
    return { email: '', name: '' }
  }
}

/** Fire-and-forget usage logging. Never throws, never blocks the UI. */
export function logHistoryEvent(input: HistoryEventInput): void {
  if (!LOG_URL) return
  const { email, name } = getCurrentUser()
  const payload = {
    event_id: crypto.randomUUID(),
    client_time: new Date().toISOString(),
    event_type: input.eventType,
    user_email: email,
    user_name: name,
    brand: input.brand,
    tool_post_type: input.toolPostType,
    source_page: input.sourcePage,
    article_url: input.articleUrl ?? '',
    source_domain: input.articleUrl ? extractDomain(input.articleUrl) : '',
    title: input.title ?? '',
    caption: input.caption ?? '',
    image_url: input.imageUrl ?? '',
    scheduled_for: input.scheduledFor ?? '',
    edited_fields: (input.editedFields ?? []).join(','),
    status: input.status,
    error_message: input.errorMessage ?? '',
  }
  try {
    void fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* swallow — logging must never disrupt UX */ })
  } catch { /* ignore */ }
}

export interface FetchHistoryParams {
  mode: 'view' | 'download'
  from?: string        // yyyy-mm-dd
  to?: string          // yyyy-mm-dd
  passcode?: string
  isAdmin?: boolean
}

export interface FetchHistoryResult {
  status: 'OK' | 'AUTH_ERROR' | 'ERROR'
  rows: HistoryRow[]
  message?: string
}

export async function fetchHistory(brand: string, params: FetchHistoryParams): Promise<FetchHistoryResult> {
  if (!FETCH_URL) return { status: 'ERROR', rows: [], message: 'History fetch webhook not configured' }
  try {
    const res = await fetch(FETCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand,                       // original case; n8n matches case-insensitively
        mode: params.mode,
        from: params.from ?? '',
        to: params.to ?? '',
        passcode: params.passcode ?? '',
        is_admin: params.isAdmin ?? false,
      }),
    })
    if (!res.ok) return { status: 'ERROR', rows: [], message: `HTTP ${res.status}` }
    const data = await res.json() as { status?: string; rows?: HistoryRow[]; message?: string }
    if (data.status === 'AUTH_ERROR') return { status: 'AUTH_ERROR', rows: [], message: data.message ?? 'Invalid passcode.' }
    return { status: 'OK', rows: data.rows ?? [], message: data.message }
  } catch {
    return { status: 'ERROR', rows: [], message: 'Network error. Please try again.' }
  }
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add ui/src/services/historyLog.ts ui/.env.local ui/.env.production
git commit -m "feat: add history log service (logHistoryEvent + fetchHistory)"
```

---

## Phase C — Event wiring

### Task 6: Log `generated` and `error` in handleGenerate

**Files:**
- Modify: `ui/src/pages/ArticleToSocialPage.tsx:2` (import), `:556-577` (the `settled.forEach` block).

- [ ] **Step 1: Add the import**

At the top of `ArticleToSocialPage.tsx`, add:

```typescript
import { logHistoryEvent } from '../services/historyLog'
```

- [ ] **Step 2: Replace the `settled.forEach` block**

Replace the existing `settled.forEach((result, i) => { ... })` (lines ~556–577) with this version — it logs one event per type:

```typescript
    settled.forEach((result, i) => {
      const type = orderedTypes[i]
      if (result.status === 'fulfilled') {
        const val = result.value
        let title = ''
        if (type === 'photo') {
          const v = val as Awaited<ReturnType<typeof generatePhoto>>
          title = v.photoTitle
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, caption: v.caption, photoTitle: v.photoTitle, cloudinaryUrl: v.cloudinaryUrl })
        } else if (type === 'carousel') {
          const v = val as Awaited<ReturnType<typeof generateCarousel>>
          title = v.carouselResult.title
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, carouselImages: v.carouselImages, caption: v.caption, carouselResult: v.carouselResult })
        } else if (type === 'quickfact') {
          const v = val as Awaited<ReturnType<typeof generateQuickFact>>
          title = v.quickFactTitle
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, caption: v.caption, quickFactTitle: v.quickFactTitle, quickFactFacts: v.quickFactFacts, quickFactKeyPhrase: v.quickFactKeyPhrase, cloudinaryUrl: v.cloudinaryUrl })
        } else if (type === 'quote') {
          const v = val as Awaited<ReturnType<typeof generateQuote>>
          title = v.quoteData.quote_text
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, caption: v.caption, quoteData: v.quoteData, quotePexelsUrls: v.quotePexelsUrls, quoteFontUse: v.quoteFontUse })
        }
        const out = val as { caption?: string; imageUrl?: string }
        logHistoryEvent({
          eventType: 'generated', brand, toolPostType: type, sourcePage: 'article_to_social',
          articleUrl: url, title, caption: out.caption ?? '', imageUrl: out.imageUrl ?? '', status: 'success',
        })
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : 'Generation failed'
        updateCard(type, { status: 'error', errorMessage: msg })
        logHistoryEvent({
          eventType: 'error', brand, toolPostType: type, sourcePage: 'article_to_social',
          articleUrl: url, status: 'error', errorMessage: msg,
        })
      }
    })
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add ui/src/pages/ArticleToSocialPage.tsx
git commit -m "feat: log post generation events"
```

---

### Task 7: Centralize `scheduled` logging + pass meta from call sites

**Files:**
- Modify: `ui/src/pages/ArticleToSocialPage.tsx` — `postToFacebook` (`:91-115`), `scheduleCarousel` (`:117-145`), and 8 `handleSchedule`/schedule call sites.

- [ ] **Step 1: Add a meta param + logging to `postToFacebook`**

Replace `postToFacebook` (lines ~91–115) with:

```typescript
interface ScheduleLogMeta {
  toolPostType: string
  articleUrl?: string
  title?: string
  editedFields?: string[]
}

async function postToFacebook(
  imageUrl: string,
  caption: string,
  brand: string,
  scheduledFor: string,
  passcode: string,
  meta: ScheduleLogMeta,
): Promise<{ authError: boolean }> {
  const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('Post webhook not configured')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fb_ai_image_url: imageUrl,
      fb_ai_caption: caption,
      brand: brand.toLowerCase(),
      scheduled_for: scheduledFor,
      passcode,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as { status?: string }
  if (json.status === 'AUTH_ERROR') return { authError: true }
  logHistoryEvent({
    eventType: 'scheduled', brand, toolPostType: meta.toolPostType, sourcePage: 'article_to_social',
    articleUrl: meta.articleUrl, title: meta.title, caption, imageUrl,
    scheduledFor, editedFields: meta.editedFields, status: 'success',
  })
  return { authError: false }
}
```

- [ ] **Step 2: Add logging to `scheduleCarousel`**

In `scheduleCarousel` (lines ~117–145), add a `meta: ScheduleLogMeta` parameter (after `passcode?`) and, on the success branch (where it currently does `return { success: true, message: 'Scheduled!' }`), insert before the return:

```typescript
      logHistoryEvent({
        eventType: 'scheduled', brand, toolPostType: 'carousel', sourcePage: 'article_to_social',
        articleUrl: meta?.articleUrl, title: meta?.title, caption, imageUrl: imageUrls[0],
        scheduledFor, editedFields: meta?.editedFields, status: 'success',
      })
```

Signature becomes: `async function scheduleCarousel(imageUrls, caption, brand, scheduledFor?, passcode?, meta?: ScheduleLogMeta)`.

- [ ] **Step 3: Add an `initialCaption` ref to the 4 SingleView components**

Edits are detected per view. In each of `PhotoSingleView`, `QuickFactSingleView`, `QuoteSingleView`, `CarouselSingleView`, add a ref near the other `useState`/`useRef` declarations:

```typescript
  const initialCaptionRef = useRef(card.caption)
```

(`useRef` is already imported in this file.)

- [ ] **Step 4: Compute `editedFields` and pass meta in each `handleSchedule`**

In `PhotoSingleView.handleSchedule` (line ~871) and `QuickFactSingleView.handleSchedule` (~1030), the call currently reads:

```typescript
const { authError } = await postToFacebook(displayImageUrl, card.caption, brand, scheduledFor, resolvedPasscode)
```

Replace with (Photo uses `card.photoTitle`; QuickFact uses `card.quickFactTitle`):

```typescript
const editedFields: string[] = []
if (card.caption !== initialCaptionRef.current) editedFields.push('caption')
if (committedTitle !== (card.photoTitle ?? '')) editedFields.push('title')   // QuickFact: card.quickFactTitle
if (adjustedImageUrl || uploadedPublicId) editedFields.push('image')
const { authError } = await postToFacebook(
  displayImageUrl, card.caption, brand, scheduledFor, resolvedPasscode,
  { toolPostType: card.type, articleUrl, title: committedTitle, editedFields },
)
```

- [ ] **Step 5: Pass meta in QuoteSingleView**

`QuoteSingleView.handleSchedule` (~1205) — its title is the quote author/text. Add before the `postToFacebook` call:

```typescript
const editedFields: string[] = []
if (card.caption !== initialCaptionRef.current) editedFields.push('caption')
```

and pass `{ toolPostType: 'quote', articleUrl, title: card.quoteData?.quote_author ?? '', editedFields }` as the 6th argument to `postToFacebook`.

- [ ] **Step 6: Pass meta in CarouselSingleView**

`CarouselSingleView` (~1418) schedules via `scheduleCarousel(imageUrls, caption, postBrand, scheduledFor, passcode)`. Append the meta arg:

```typescript
scheduleCarousel(imageUrls, caption, postBrand, scheduledFor, passcode, { toolPostType: 'carousel', articleUrl, title: card.carouselResult?.title ?? '' })
```

- [ ] **Step 7: Pass meta in the 4 Bulk components**

The bulk handlers schedule the same way but without per-field edit tracking (single-post is the primary path; bulk logs `scheduled` with no `editedFields`). Apply the 6th argument:

| Component | Line | Function | Add as final arg |
|---|---|---|---|
| `PhotoBulkContent.handleSchedule` | ~1540 | `postToFacebook(displayImageUrl, card.caption, brand, scheduledFor, rp` | `, { toolPostType: 'photo', articleUrl, title: committedTitle })` |
| `QuickFactBulkContent.handleSchedule` | ~1668 | `postToFacebook(displayImageUrl, card.caption, brand, scheduledFor, rp` | `, { toolPostType: 'quickfact', articleUrl, title: committedTitle })` |
| `QuoteBulkContent.handleSchedule` | ~1804 | `postToFacebook(...)` | `, { toolPostType: 'quote', articleUrl: undefined, title: '' })` |
| `CarouselBulkContent` | ~1937 | `scheduleCarousel(imageUrls, caption, postBrand, scheduledFor, passcode` | `, { toolPostType: 'carousel', articleUrl, title: card.carouselResult?.title ?? '' })` |

(`QuoteBulkContent` has no `articleUrl` prop — pass `undefined`. Confirm each component's available props when editing; do not invent variables.)

- [ ] **Step 8: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS. The compiler will flag any `postToFacebook`/`scheduleCarousel` call still missing the new required/optional meta arg — fix each until clean.

- [ ] **Step 9: Commit**

```bash
git add ui/src/pages/ArticleToSocialPage.tsx
git commit -m "feat: log post schedule events with edited-field tracking"
```

---

### Task 8: Log CMS generation events

**Files:**
- Modify: `ui/src/pages/CmsPostPage.tsx`

- [ ] **Step 1: Locate the CMS generation call site**

Open `ui/src/pages/CmsPostPage.tsx` and find where `generatePhotoFromCms` / `generateQuickFactFromCms` / `generateQuoteFromCms` (from `../services/postGeneration`) are awaited, and the surrounding try/catch. Note the in-scope variables for `brand`, the article `url`, and `title`.

- [ ] **Step 2: Log success and error**

Add `import { logHistoryEvent } from '../services/historyLog'`. On each successful generation, call:

```typescript
logHistoryEvent({
  eventType: 'generated', brand, toolPostType: postType, sourcePage: 'cms',
  articleUrl: url, title, caption: result.caption, imageUrl: result.imageUrl, status: 'success',
})
```

and in the catch block:

```typescript
logHistoryEvent({
  eventType: 'error', brand, toolPostType: postType, sourcePage: 'cms',
  articleUrl: url, status: 'error', errorMessage: err instanceof Error ? err.message : 'Generation failed',
})
```

Use the actual variable names present in `CmsPostPage.tsx` (it may iterate over `types`; log once per generated type). Do not reference variables that don't exist in scope.

- [ ] **Step 3: Verify build + lint, then commit**

Run: `npm run build && npm run lint` → PASS.

```bash
git add ui/src/pages/CmsPostPage.tsx
git commit -m "feat: log CMS post generation events"
```

---

## Phase D — UI: page, modal, nav

### Task 9: HistoryPasscodeModal

**Files:**
- Create: `ui/src/components/HistoryPasscodeModal.tsx`

- [ ] **Step 1: Write the component**

Modeled on `AdminPasscodeModal.tsx`, but it delegates validation to the parent via `onSubmit` (which performs the gated fetch and returns the result):

```typescript
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface HistoryPasscodeModalProps {
  onSubmit: (passcode: string) => Promise<{ ok: boolean; message?: string }>
  onClose: () => void
}

export function HistoryPasscodeModal({ onSubmit, onClose }: HistoryPasscodeModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async () => {
    if (!input || loading) return
    setLoading(true)
    setError(null)
    const res = await onSubmit(input)
    setLoading(false)
    if (!res.ok) {
      setError(res.message ?? 'Incorrect passcode. Try again.')
      setInput('')
      inputRef.current?.focus()
    }
    // on success the parent closes the modal
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-slide-up"
        onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="history-modal-title" aria-modal="true">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="history-modal-title" className="text-base font-semibold text-neutral-950">Download history log</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Enter the passcode to download</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal"
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none ml-4 transition-colors">×</button>
        </div>
        <div className="space-y-3">
          <input ref={inputRef} type="password" value={input}
            onChange={e => { setInput(e.target.value); if (error) setError(null) }}
            onKeyDown={handleKeyDown} placeholder="Passcode"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950/20 focus:border-neutral-400 transition" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="button" onClick={handleSubmit} disabled={!input || loading}
            className="w-full px-4 py-2 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium">
            {loading ? 'Downloading…' : 'Download →'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Verify build, commit**

Run: `npm run build && npm run lint` → PASS.

```bash
git add ui/src/components/HistoryPasscodeModal.tsx
git commit -m "feat: add history download passcode modal"
```

---

### Task 10: HistoryLogPage

**Files:**
- Create: `ui/src/pages/HistoryLogPage.tsx`

- [ ] **Step 1: Write the page**

```typescript
import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useBrand } from '../context/BrandContext'
import { BRANDS } from '../constants/brands'
import { BackButton } from '../components/ds'
import { toast } from '../hooks/useToast'
import { HistoryPasscodeModal } from '../components/HistoryPasscodeModal'
import { fetchHistory, logHistoryEvent, type HistoryRow } from '../services/historyLog'

const COLUMNS: { key: keyof HistoryRow; label: string }[] = [
  { key: 'server_time', label: 'Time' },
  { key: 'event_type', label: 'Event' },
  { key: 'user_name', label: 'User' },
  { key: 'user_email', label: 'Email' },
  { key: 'brand', label: 'Brand' },
  { key: 'tool_post_type', label: 'Type' },
  { key: 'source_page', label: 'Source' },
  { key: 'title', label: 'Title' },
  { key: 'article_url', label: 'Article URL' },
  { key: 'scheduled_for', label: 'Scheduled For' },
  { key: 'edited_fields', label: 'Edited' },
  { key: 'status', label: 'Status' },
  { key: 'error_message', label: 'Error' },
]

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export function HistoryLogPage() {
  const { selectedBrand, isAdmin } = useBrand()
  const [adminBrand, setAdminBrand] = useState<string>(BRANDS[0])
  const brand = isAdmin ? adminBrand : (selectedBrand ?? '')

  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(isoDaysAgo(0))
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showPasscode, setShowPasscode] = useState(false)

  const loadView = useCallback(async () => {
    if (!brand) return
    setLoading(true)
    const res = await fetchHistory(brand, { mode: 'view', from, to })
    setLoading(false)
    if (res.status === 'OK') setRows(res.rows)
    else toast.error(res.message ?? 'Failed to load history')
  }, [brand, from, to])

  useEffect(() => { void loadView() }, [loadView])

  function buildAndDownload(data: HistoryRow[]) {
    const aoa = [
      COLUMNS.map(c => c.label),
      ...data.map(r => COLUMNS.map(c => r[c.key] ?? '')),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, 'History')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const dlUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = dlUrl
    a.download = `KULT_History_${brand.replace(/\s+/g, '_')}_${from}_${to}.xlsx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(dlUrl)
    document.body.removeChild(a)
  }

  // Performs the gated download fetch. Returns ok/message for the passcode modal.
  const runDownload = useCallback(async (passcode?: string): Promise<{ ok: boolean; message?: string }> => {
    setDownloading(true)
    const res = await fetchHistory(brand, { mode: 'download', from, to, passcode, isAdmin })
    setDownloading(false)
    if (res.status === 'AUTH_ERROR') return { ok: false, message: res.message }
    if (res.status === 'ERROR') { toast.error(res.message ?? 'Download failed'); return { ok: false, message: res.message } }
    buildAndDownload(res.rows)
    logHistoryEvent({ eventType: 'downloaded', brand, toolPostType: 'history_export', sourcePage: 'history_log', status: 'success' })
    toast.success(`Downloaded ${res.rows.length} rows`)
    return { ok: true }
  }, [brand, from, to, isAdmin])

  function onDownloadClick() {
    if (!brand) { toast.error('Select a brand first'); return }
    if (isAdmin) void runDownload()
    else setShowPasscode(true)
  }

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <BackButton />
            <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">History Log</h1>
          </div>
          <p className="text-neutral-500 mt-1 text-sm">Generation &amp; scheduling activity{brand ? ` for ${brand}` : ''}</p>
          <div className="mt-6 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
                <select value={adminBrand} onChange={e => setAdminBrand(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
              <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <button onClick={onDownloadClick} disabled={downloading || !brand}
              className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-lg text-sm font-semibold transition">
              {downloading ? 'Downloading…' : 'Download Excel'}
            </button>
          </div>

          <div className="overflow-x-auto border border-neutral-100 rounded-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>{COLUMNS.map(c => <th key={c.key} className="text-left font-medium px-3 py-2 whitespace-nowrap">{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-neutral-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-neutral-400">No activity in this range.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.event_id} className="border-t border-neutral-100">
                    {COLUMNS.map(c => <td key={c.key} className="px-3 py-2 whitespace-nowrap max-w-[220px] truncate" title={String(r[c.key] ?? '')}>{String(r[c.key] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPasscode && (
        <HistoryPasscodeModal
          onSubmit={async (passcode) => {
            const res = await runDownload(passcode)
            if (res.ok) setShowPasscode(false)
            return res
          }}
          onClose={() => setShowPasscode(false)}
        />
      )}
    </main>
  )
}
```

> Confirm `BackButton` is exported from `../components/ds` (it is used by `ArticleToSocialPage.tsx`). Confirm `toast` is exported from `../hooks/useToast`.

- [ ] **Step 2: Verify build + lint, commit**

Run: `npm run build && npm run lint` → PASS.

```bash
git add ui/src/pages/HistoryLogPage.tsx
git commit -m "feat: add History Log page (view + Excel download)"
```

---

### Task 11: Wire navigation + routing

**Files:**
- Modify: `ui/src/components/Sidebar.tsx:27-53` (ToolId), `:112-120` (Others nav), `:122-148` (TOOL_NAMES).
- Modify: `ui/src/App.tsx:81` (local ToolId), `:83-112` (pathToTool), `:134-160` (toolToPath), `:709-712` (a route), and import.

- [ ] **Step 1: Sidebar — ToolId union**

In `Sidebar.tsx`, add to the `ToolId` union (after `'election-results'`):

```typescript
  | 'history-log'
```

- [ ] **Step 2: Sidebar — Others section + icon import**

Add `IconHistory` to the `@tabler/icons-react` import block. Add to the "Others" `items` array (after `post-queue`):

```typescript
      { id: 'history-log', label: 'History Log', icon: IconHistory },
```

- [ ] **Step 3: Sidebar — TOOL_NAMES**

Add to `TOOL_NAMES`:

```typescript
  'history-log': 'History Log',
```

- [ ] **Step 4: App.tsx — ToolId, maps, import, route**

In `App.tsx`:
- Append `| 'history-log'` to the local `ToolId` type (line ~81).
- Add to `pathToTool`: `'/history-log': 'history-log',`
- Add to `toolToPath`: `'history-log': '/history-log',`
- Add the import: `import { HistoryLogPage } from './pages/HistoryLogPage'`
- Add a route inside the `/:brandSlug` block (near the `post-queue` route):

```tsx
        <Route path="history-log" element={<HistoryLogPage />} />
```

- [ ] **Step 5: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS. TS will error if any `ToolId` record (`TOOL_NAMES`, `toolToPath`) is missing the new key — add it until clean.

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/Sidebar.tsx ui/src/App.tsx
git commit -m "feat: add History Log to Others nav + routing"
```

---

## Phase E — End-to-end verification

### Task 12: Manual E2E

**Files:** none.

- [ ] **Step 1: Run the app**

Run: `npm run dev` and open the app; select a brand (e.g. Astro Awani).

- [ ] **Step 2: Generate**

Generate a post in Article to Social Post. Confirm a `generated` row lands in the Sheet with correct `user_email`, `brand`, `tool_post_type`, `title`, and a populated `server_time`.

- [ ] **Step 3: Edit + schedule**

Edit the caption, adjust the image, then schedule. Confirm a `scheduled` row with `edited_fields` containing `caption,image` and a `scheduled_for` value.

- [ ] **Step 4: View**

Open **Others → History Log**. Confirm the table shows the brand's rows for the default range. As admin, switch brands and confirm the table reloads for the selected brand.

- [ ] **Step 5: Download (brand user)**

As a non-admin brand user, pick a date range and click **Download Excel** → enter `history101123!` → an `.xlsx` downloads with the in-range rows. Enter a wrong passcode → inline "Incorrect passcode", no download. Confirm a `downloaded` row was logged.

- [ ] **Step 6: Download (admin)**

As admin, click **Download Excel** → downloads immediately with no passcode prompt.

- [ ] **Step 7: Non-blocking logging**

Temporarily set `VITE_HISTORY_LOG_WEBHOOK_URL` to an unreachable URL, generate a post, and confirm generation still completes normally (logging failure is swallowed). Restore the URL.

- [ ] **Step 8: Final build gate**

Run: `npm run build && npm run lint`
Expected: PASS.

---

## Self-Review Notes

- **Spec coverage:** scope/access model (Tasks 3, 10, 12) · storage = Sheet/no-DB (Tasks 1–3) · events generated/scheduled/error/downloaded (Tasks 6, 7, 8, 10) · edited_fields on scheduled rows (Task 7) · passcode server-side, admin bypass (Task 3 Code node, Task 10 `runDownload`) · brand-scoped view (Tasks 3, 10) · Excel via SheetJS (Task 10) · Others nav (Task 11) · env vars (Task 5). All covered.
- **Type consistency:** `HistoryRow`/`HistoryEventInput`/`FetchHistoryResult`/`ScheduleLogMeta`, `logHistoryEvent`, `fetchHistory` names match across Tasks 5, 6, 7, 8, 10.
- **Known soft spots to confirm during implementation (not placeholders — verify in-scope vars):** exact variable names in `CmsPostPage.tsx` (Task 8) and the 4 Bulk components (Task 7 Step 7); `BackButton`/`toast` export paths (Task 10); the `unparseable` typo guard in the Task 3 Code node.
