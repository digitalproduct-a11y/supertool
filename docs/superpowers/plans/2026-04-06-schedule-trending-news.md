# Schedule Trending News — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated system that runs at 10 AM daily, fetches trending news for Astro Ulagam, generates Facebook posts (image + caption) for each article, stores them in Google Sheets, and provides a UI page for users to review, edit, and schedule posts.

**Architecture:** n8n cron workflow → generates posts → writes to Google Sheets → three separate n8n webhooks (fetch / update / schedule) serve a new React page at `/scheduled-posts`. All Sheets access stays server-side in n8n; the UI only talks to webhooks.

**Tech Stack:** n8n (MCP tools), Google Sheets (Google Sheets node in n8n), React + TypeScript + Tailwind CSS (existing UI stack), Cloudinary (real-time image URL manipulation)

---

## Pre-Work: Inspect the Cloudinary URL Code Node

Before touching any code, you must understand the exact URL structure the n8n article-to-FB workflow produces for Astro Ulagam. This determines which part of the `imageUrl` string the UI needs to swap when the user edits the title.

- [ ] **Step 1: Find the Code node that builds the Cloudinary URL**

  In n8n, open the article-to-FB-posts workflow. Find the Code node that constructs the Cloudinary transformation URL. Note:
  - The full URL template (copy it out)
  - Which segment contains the editable title/headline text
  - How text is encoded (single vs double `encodeURIComponent`)
  - Where the base photo public ID sits in the URL (always last path segment)

- [ ] **Step 2: Document the URL pattern**

  Write a comment block you'll paste into `useScheduledPosts.ts` later:

  ```typescript
  // Cloudinary URL pattern for Astro Ulagam article-to-FB posts
  // Structure: https://res.cloudinary.com/{cloud}/image/upload/
  //   {transformation_prefix}/
  //   l_text:{font}:{TITLE_DOUBLE_ENCODED},co_rgb:FFFFFF,.../fl_layer_apply,.../
  //   {transformation_suffix}/
  //   {photo_public_id}
  //
  // To update the title in real-time:
  //   1. Split URL on the photo_public_id (last path segment after final '/')
  //   2. In the prefix, find the text layer segment and replace the encoded title
  //   3. Rejoin with photo_public_id
  //
  // Encoding: encodeURIComponent(encodeURIComponent(title))
  ```

  Fill in the actual values from the Code node. Keep this comment for reference in Task 6.

---

## Phase 1: Infrastructure (n8n + Google Sheets)

### Task 1: Google Sheets Setup

**Files:** None (manual Google Sheets configuration)

- [ ] **Step 1: Create the Google Sheet**

  Create a new Google Sheet named `n8n-scheduled-posts` with a tab named `scheduled_posts`.

- [ ] **Step 2: Add column headers in Row 1**

  In order, columns A through K:
  ```
  A: id
  B: date
  C: brand
  D: articleUrl
  E: articleTitle
  F: imageUrl
  G: photoPublicId
  H: title
  I: caption
  J: status
  K: scheduled_time
  L: scheduled_to
  M: error_message
  ```

- [ ] **Step 3: Note the Sheet ID**

  Copy the Sheet ID from the URL:
  `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

  Save it — you'll use it in every n8n Google Sheets node.

- [ ] **Step 4: Verify Google Sheets credentials in n8n**

  In n8n → Credentials, confirm a Google Sheets OAuth credential exists and is connected. If not, create one via n8n → Credentials → Add → Google Sheets OAuth2 API.

---

### Task 2: n8n Scheduler Workflow (10 AM daily)

**Purpose:** Fetches trending news for Astro Ulagam, generates FB posts, writes to Google Sheets.

- [ ] **Step 1: Check existing trending news workflow**

  Use the MCP tool to inspect the existing trending news workflow:
  ```
  mcp__n8n-mcp__n8n_get_workflow with ID of the trending news workflow
  ```
  Note the webhook URL or node structure that accepts `{ brand }` and returns articles.

- [ ] **Step 2: Create the scheduler workflow via MCP**

  Use `mcp__n8n-mcp__n8n_create_workflow` with this structure:

  **Nodes:**
  1. **Schedule Trigger** — Daily at 10:00 AM (UTC). Cron: `0 10 * * *`
  2. **HTTP Request: Fetch Trending News** — POST to the existing trending news webhook URL with body `{ "brand": "Astro Ulagam" }`. Returns array of `{ url, title, source, publishedAt }`.
  3. **Split In Batches** — Process one article at a time (batch size: 1). Prevents rate limiting on the generate webhook.
  4. **HTTP Request: Generate FB Post** — POST to `GENERATE_WEBHOOK_URL` (the same URL behind `VITE_GENERATE_WEBHOOK_URL` env var):
     ```json
     {
       "url": "={{ $json.url }}",
       "brand": "Astro Ulagam",
       "mode": "own_brand",
       "title_mode": "ai",
       "caption_title_mode": "ai"
     }
     ```
     Response: `{ success, imageUrl, caption, title, originalTitle, brand }`
  5. **Code: Extract Photo Public ID** — Extract `photoPublicId` from `imageUrl`:
     ```javascript
     const imageUrl = $json.imageUrl;
     // Public ID is everything after the last '/' in the URL path (before any query string)
     const urlPath = imageUrl.split('?')[0];
     const photoPublicId = urlPath.split('/').pop();
     return [{
       json: {
         ...$json,
         photoPublicId,
       }
     }];
     ```
  6. **Google Sheets: Append Row** — Append to `scheduled_posts` tab:
     - `id`: `={{ $now.toMillis().toString() + '-' + $runIndex }}`
     - `date`: `={{ $now.format('yyyy-MM-dd') }}`
     - `brand`: `Astro Ulagam`
     - `articleUrl`: `={{ $('Split In Batches').item.json.url }}`
     - `articleTitle`: `={{ $('Split In Batches').item.json.title }}`
     - `imageUrl`: `={{ $json.imageUrl }}`
     - `photoPublicId`: `={{ $json.photoPublicId }}`
     - `title`: `={{ $json.title }}`
     - `caption`: `={{ $json.caption }}`
     - `status`: `pending`
     - `scheduled_time`: (empty)
     - `scheduled_to`: (empty)
     - `error_message`: (empty)
  7. **Error Trigger** — Catch any execution errors. Write error row to Sheets with `status: error` and `error_message` from the error object.

- [ ] **Step 3: Validate the workflow**

  ```
  mcp__n8n-mcp__n8n_validate_workflow
  ```
  Fix any errors reported.

- [ ] **Step 4: Test with manual execution**

  In n8n UI, run the workflow manually. Check Google Sheets — rows should appear with `status: pending`.

- [ ] **Step 5: Activate the workflow**

  ```
  mcp__n8n-mcp__n8n_update_partial_workflow — set active: true
  ```

---

### Task 3: n8n Fetch Webhook (read today's posts)

**Purpose:** UI calls this to load today's posts from Google Sheets.

- [ ] **Step 1: Create the fetch workflow via MCP**

  **Nodes:**
  1. **Webhook** — Method: GET, Path: `scheduled-posts-fetch`, Response mode: Last node
  2. **Google Sheets: Read Rows** — Read all rows from `scheduled_posts` tab
  3. **Code: Filter by Date and Brand** —
     ```javascript
     const targetDate = $('Webhook').first().json.query.date
       ?? new Date().toISOString().split('T')[0];
     const targetBrand = $('Webhook').first().json.query.brand ?? 'Astro Ulagam';

     const rows = $input.all();
     const filtered = rows.filter(row => {
       return row.json.date === targetDate && row.json.brand === targetBrand;
     });

     if (filtered.length === 0) {
       return [{ json: { success: true, posts: [] } }];
     }

     return [{ json: {
       success: true,
       posts: filtered.map(row => row.json)
     }}];
     ```
  4. **Respond to Webhook** — Return the filtered posts JSON.

- [ ] **Step 2: Validate and activate**

  ```
  mcp__n8n-mcp__n8n_validate_workflow
  mcp__n8n-mcp__n8n_update_partial_workflow — set active: true
  ```

- [ ] **Step 3: Copy the webhook URL**

  After activating, note the production webhook URL. This becomes `VITE_SCHEDULED_POSTS_FETCH_WEBHOOK_URL` in the UI `.env`.

- [ ] **Step 4: Test the webhook**

  ```bash
  curl "https://your-n8n-instance/webhook/scheduled-posts-fetch?date=2026-04-06&brand=Astro%20Ulagam"
  ```
  Expected: `{ "success": true, "posts": [...] }`

---

### Task 4: n8n Update Webhook (save edits)

**Purpose:** UI calls this when user clicks Save in Edit mode to persist changes to Google Sheets.

- [ ] **Step 1: Create the update workflow via MCP**

  **Nodes:**
  1. **Webhook** — Method: POST, Path: `scheduled-posts-update`, Response mode: Last node
  2. **Google Sheets: Read Rows** — Read all rows to find the target row by `id`
  3. **Code: Find Row Number** —
     ```javascript
     const postId = $('Webhook').first().json.body.postId;
     const updates = $('Webhook').first().json.body.updates;
     const rows = $input.all();

     // Google Sheets row numbers start at 2 (row 1 is headers)
     const rowIndex = rows.findIndex(row => row.json.id === postId);
     if (rowIndex === -1) {
       return [{ json: { success: false, error: 'Post not found' } }];
     }

     return [{ json: {
       rowNumber: rowIndex + 2,
       updates,
       postId,
     }}];
     ```
  4. **Google Sheets: Update Row** — Update row at `rowNumber` with fields from `updates`:
     - Only update `title`, `caption`, `imageUrl`, `photoPublicId` if present in updates
     - Use n8n's "Update Row" operation with row number from previous node
  5. **Respond to Webhook** — Return `{ success: true, rowNumber }`.

- [ ] **Step 2: Validate and activate**

  ```
  mcp__n8n-mcp__n8n_validate_workflow
  mcp__n8n-mcp__n8n_update_partial_workflow — set active: true
  ```

- [ ] **Step 3: Copy the webhook URL**

  This becomes `VITE_SCHEDULED_POSTS_UPDATE_WEBHOOK_URL`.

- [ ] **Step 4: Test the webhook**

  ```bash
  curl -X POST "https://your-n8n-instance/webhook/scheduled-posts-update" \
    -H "Content-Type: application/json" \
    -d '{"postId":"<id from Sheets>","updates":{"title":"Test headline","caption":"Test caption"}}'
  ```
  Expected: `{ "success": true }` — verify the row updated in Google Sheets.

---

### Task 5: n8n Schedule Webhook (schedule post to FB)

**Purpose:** UI calls this when user picks a date/time and clicks "Schedule to FB".

- [ ] **Step 1: Create the schedule workflow via MCP**

  **Nodes:**
  1. **Webhook** — Method: POST, Path: `scheduled-posts-schedule`, Response mode: Last node
  2. **Google Sheets: Read Rows** — Read all rows
  3. **Code: Find and Update** —
     ```javascript
     const { postId, scheduledTime, platform } = $('Webhook').first().json.body;
     const rows = $input.all();
     const rowIndex = rows.findIndex(row => row.json.id === postId);

     if (rowIndex === -1) {
       return [{ json: { success: false, error: 'Post not found' } }];
     }

     return [{ json: {
       rowNumber: rowIndex + 2,
       scheduledTime,
       platform,
       postId,
     }}];
     ```
  4. **Google Sheets: Update Row** — Update at `rowNumber`:
     - `status`: `scheduled`
     - `scheduled_time`: `={{ $json.scheduledTime }}`
     - `scheduled_to`: `={{ $json.platform }}`
  5. **Respond to Webhook** — Return `{ success: true, status: "scheduled", scheduled_time: <value> }`.

  **Note:** Zernio API integration hooks in here later — add a node after step 4 to call Zernio when credentials are available.

- [ ] **Step 2: Validate and activate**

  ```
  mcp__n8n-mcp__n8n_validate_workflow
  mcp__n8n-mcp__n8n_update_partial_workflow — set active: true
  ```

- [ ] **Step 3: Copy the webhook URL**

  This becomes `VITE_SCHEDULED_POSTS_SCHEDULE_WEBHOOK_URL`.

- [ ] **Step 4: Test the webhook**

  ```bash
  curl -X POST "https://your-n8n-instance/webhook/scheduled-posts-schedule" \
    -H "Content-Type: application/json" \
    -d '{"postId":"<id>","scheduledTime":"2026-04-07T14:30:00Z","platform":"facebook"}'
  ```
  Expected: `{ "success": true, "status": "scheduled", "scheduled_time": "2026-04-07T14:30:00Z" }`
  Verify the Sheets row now shows `status: scheduled`.

---

## Phase 2: UI

### Task 6: Types and environment variables

**Files:**
- Modify: `ui/src/types.ts`
- Modify: `ui/.env` (or `.env.local`)

- [ ] **Step 1: Add env vars to `.env`**

  ```env
  # Scheduled Posts
  VITE_SCHEDULED_POSTS_FETCH_WEBHOOK_URL=https://your-n8n-instance/webhook/scheduled-posts-fetch
  VITE_SCHEDULED_POSTS_UPDATE_WEBHOOK_URL=https://your-n8n-instance/webhook/scheduled-posts-update
  VITE_SCHEDULED_POSTS_SCHEDULE_WEBHOOK_URL=https://your-n8n-instance/webhook/scheduled-posts-schedule
  ```

- [ ] **Step 2: Add `ScheduledPost` types to `ui/src/types.ts`**

  Append to the end of `types.ts`:

  ```typescript
  // ─── Scheduled Posts tool types ───────────────────────────────────────────────

  export type ScheduledPostStatus = 'pending' | 'scheduled' | 'published' | 'error'

  export interface ScheduledPost {
    id: string
    date: string            // YYYY-MM-DD
    brand: string
    articleUrl: string
    articleTitle: string
    imageUrl: string        // full Cloudinary URL with transformations
    photoPublicId: string   // base image public ID (last path segment of imageUrl)
    title: string           // editable text overlay on image
    caption: string         // editable FB caption
    status: ScheduledPostStatus
    scheduled_time: string | null   // ISO 8601 or null
    scheduled_to: string | null     // 'facebook' or null
    error_message: string | null
  }

  export interface FetchScheduledPostsResponse {
    success: true
    posts: ScheduledPost[]
  }

  export interface ScheduledPostsError {
    success: false
    error: string
  }

  export interface UpdatePostPayload {
    postId: string
    updates: Partial<Pick<ScheduledPost, 'title' | 'caption' | 'imageUrl' | 'photoPublicId'>>
  }

  export interface SchedulePostPayload {
    postId: string
    scheduledTime: string   // ISO 8601
    platform: 'facebook'
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd /Users/ylyiyany/Documents/n8n-builder/ui && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add ui/src/types.ts ui/.env
  git commit -m "feat: add ScheduledPost types and env vars for scheduled posts tool"
  ```

---

### Task 7: `useScheduledPosts` hook

**Files:**
- Create: `ui/src/hooks/useScheduledPosts.ts`

This hook manages all API calls for the scheduled posts page: fetch, update, and schedule.

- [ ] **Step 1: Create `ui/src/hooks/useScheduledPosts.ts`**

  ```typescript
  import { useState, useEffect, useCallback } from 'react'
  import type {
    ScheduledPost,
    UpdatePostPayload,
    SchedulePostPayload,
  } from '../types'

  // ─── Cloudinary URL helpers ───────────────────────────────────────────────────
  // Paste the URL pattern comment block from Pre-Work Step 2 here.
  // Then implement buildCloudinaryUrl based on the actual URL structure.

  export function buildCloudinaryUrl(photoPublicId: string, title: string): string {
    // IMPORTANT: Fill in the actual transformation template from the n8n Code node
    // discovered in the Pre-Work step. The template below is a placeholder.
    //
    // Pattern: replace TITLE_PLACEHOLDER with double-encoded title, append photoPublicId.
    //
    // Example (adjust to match actual n8n Code node output):
    const encodedTitle = encodeURIComponent(encodeURIComponent(title))
    return [
      'https://res.cloudinary.com/dymmqtqyg/image/upload',
      'c_fill,g_face,w_1080,h_1350',
      'c_pad,w_1080,h_1350,g_north',
      'l_black_fade_pexvn5,c_fill,w_1080,h_1350/fl_layer_apply,g_south,y_0',
      `l_text:Montserrat_90_bold_normal_center_line_spacing_-20:${encodedTitle},co_rgb:FFFFFF,c_fit,w_900/fl_layer_apply,g_north,x_0,y_900`,
      'l_astro_ulagam_logo,w_150/fl_layer_apply,g_south,y_35',
      photoPublicId,
    ].join('/')
    // ⚠️ Replace the above with the exact template from the n8n Code node.
  }

  // ─── Webhook helpers ──────────────────────────────────────────────────────────

  async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } finally {
      clearTimeout(id)
    }
  }

  function getFetchUrl(): string {
    const url = (import.meta.env.VITE_SCHEDULED_POSTS_FETCH_WEBHOOK_URL as string | undefined)?.trim()
    if (!url) throw new Error('VITE_SCHEDULED_POSTS_FETCH_WEBHOOK_URL is not configured.')
    return url
  }

  function getUpdateUrl(): string {
    const url = (import.meta.env.VITE_SCHEDULED_POSTS_UPDATE_WEBHOOK_URL as string | undefined)?.trim()
    if (!url) throw new Error('VITE_SCHEDULED_POSTS_UPDATE_WEBHOOK_URL is not configured.')
    return url
  }

  function getScheduleUrl(): string {
    const url = (import.meta.env.VITE_SCHEDULED_POSTS_SCHEDULE_WEBHOOK_URL as string | undefined)?.trim()
    if (!url) throw new Error('VITE_SCHEDULED_POSTS_SCHEDULE_WEBHOOK_URL is not configured.')
    return url
  }

  // ─── Hook ────────────────────────────────────────────────────────────────────

  export function useScheduledPosts(date: string, brand: string) {
    const [posts, setPosts] = useState<ScheduledPost[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadPosts = useCallback(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ date, brand })
        const res = await fetchWithTimeout(`${getFetchUrl()}?${params}`)
        const data = await res.json()
        if (data.success) {
          setPosts(data.posts)
        } else {
          setError(data.error ?? 'Failed to load posts.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error.')
      } finally {
        setIsLoading(false)
      }
    }, [date, brand])

    useEffect(() => {
      loadPosts()
    }, [loadPosts])

    const savePost = useCallback(async (payload: UpdatePostPayload): Promise<boolean> => {
      try {
        const res = await fetchWithTimeout(getUpdateUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          setPosts(prev => prev.map(p =>
            p.id === payload.postId ? { ...p, ...payload.updates } : p
          ))
          return true
        }
        return false
      } catch {
        return false
      }
    }, [])

    const schedulePost = useCallback(async (payload: SchedulePostPayload): Promise<boolean> => {
      try {
        const res = await fetchWithTimeout(getScheduleUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          setPosts(prev => prev.map(p =>
            p.id === payload.postId
              ? { ...p, status: 'scheduled', scheduled_time: payload.scheduledTime, scheduled_to: payload.platform }
              : p
          ))
          return true
        }
        return false
      } catch {
        return false
      }
    }, [])

    return { posts, isLoading, error, loadPosts, savePost, schedulePost }
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd /Users/ylyiyany/Documents/n8n-builder/ui && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add ui/src/hooks/useScheduledPosts.ts
  git commit -m "feat: add useScheduledPosts hook with fetch/save/schedule operations"
  ```

---

### Task 8: `PostCard` component

**Files:**
- Create: `ui/src/components/PostCard.tsx`

Each card shows one generated post with View and Edit modes. The Cloudinary image updates in real-time when the title is edited.

- [ ] **Step 1: Create `ui/src/components/PostCard.tsx`**

  ```tsx
  import { useState, useRef } from 'react'
  import { toast } from '../hooks/useToast'
  import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
  import type { ScheduledPost, UpdatePostPayload, SchedulePostPayload } from '../types'

  // ─── Status badge ─────────────────────────────────────────────────────────────

  function StatusBadge({ post }: { post: ScheduledPost }) {
    if (post.status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          Error
        </span>
      )
    }
    if (post.status === 'scheduled' && post.scheduled_time) {
      const dt = new Date(post.scheduled_time)
      const formatted = dt.toLocaleString('en-MY', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      })
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Scheduled · {formatted}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 inline-block" />
        Pending
      </span>
    )
  }

  // ─── Schedule modal ───────────────────────────────────────────────────────────

  function ScheduleModal({
    onConfirm,
    onClose,
    isSubmitting,
  }: {
    onConfirm: (isoTime: string) => void
    onClose: () => void
    isSubmitting: boolean
  }) {
    const [scheduledFor, setScheduledFor] = useState('')

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
          <h3 className="font-semibold text-neutral-950 mb-1">Schedule to Facebook</h3>
          <p className="text-sm text-neutral-500 mb-4">Pick a date and time for this post to go live.</p>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={e => setScheduledFor(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={() => scheduledFor && onConfirm(new Date(scheduledFor).toISOString())}
              disabled={!scheduledFor || isSubmitting}
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Scheduling…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── PostCard ─────────────────────────────────────────────────────────────────

  interface PostCardProps {
    post: ScheduledPost
    onSave: (payload: UpdatePostPayload) => Promise<boolean>
    onSchedule: (payload: SchedulePostPayload) => Promise<boolean>
  }

  export function PostCard({ post, onSave, onSchedule }: PostCardProps) {
    const [mode, setMode] = useState<'view' | 'edit'>('view')
    const [editTitle, setEditTitle] = useState(post.title)
    const [editCaption, setEditCaption] = useState(post.caption)
    const [isSaving, setIsSaving] = useState(false)
    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [isScheduling, setIsScheduling] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    // Real-time Cloudinary preview URL — updates as user edits title
    const previewPublicId = uploadedPublicId ?? post.photoPublicId
    const previewUrl = mode === 'edit'
      ? buildCloudinaryUrl(previewPublicId, editTitle)
      : post.imageUrl

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleEdit() {
      setEditTitle(post.title)
      setEditCaption(post.caption)
      setUploadedPublicId(null)
      setMode('edit')
    }

    function handleCancel() {
      setEditTitle(post.title)
      setEditCaption(post.caption)
      setUploadedPublicId(null)
      setMode('view')
    }

    async function handleSave() {
      setIsSaving(true)
      const updates: UpdatePostPayload['updates'] = {
        title: editTitle,
        caption: editCaption,
      }
      if (uploadedPublicId) {
        updates.photoPublicId = uploadedPublicId
        updates.imageUrl = buildCloudinaryUrl(uploadedPublicId, editTitle)
      }
      const ok = await onSave({ postId: post.id, updates })
      setIsSaving(false)
      if (ok) {
        toast.success('Saved')
        setMode('view')
      } else {
        toast.error('Failed to save. Please try again.')
      }
    }

    async function handleUploadImage(file: File) {
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_ASTRO_ULAGAM_UPLOAD_PRESET as string | undefined
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
      if (!uploadPreset || !cloudName) {
        toast.error('Upload is not configured.')
        return
      }
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('upload_preset', uploadPreset)
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (data.public_id) {
          setUploadedPublicId(data.public_id)
        } else {
          toast.error('Upload failed.')
        }
      } catch {
        toast.error('Upload failed.')
      } finally {
        setIsUploading(false)
      }
    }

    async function handleScheduleConfirm(isoTime: string) {
      setIsScheduling(true)
      const ok = await onSchedule({
        postId: post.id,
        scheduledTime: isoTime,
        platform: 'facebook',
      })
      setIsScheduling(false)
      if (ok) {
        setShowScheduleModal(false)
        toast.success('Post scheduled!')
      } else {
        toast.error('Failed to schedule. Please try again.')
      }
    }

    async function handleDownload() {
      try {
        const res = await fetch(post.imageUrl)
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `astro-ulagam-${post.date}-${Date.now()}.jpg`
        a.click()
      } catch {
        toast.error('Download failed.')
      }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <>
        {showScheduleModal && (
          <ScheduleModal
            onConfirm={handleScheduleConfirm}
            onClose={() => setShowScheduleModal(false)}
            isSubmitting={isScheduling}
          />
        )}

        <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col">

          {/* Image preview */}
          <div className="relative w-full" style={{ aspectRatio: '4/5' }}>
            <img
              src={previewUrl}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white text-sm font-medium">Uploading…</span>
              </div>
            )}
          </div>

          {/* Card body */}
          <div className="p-4 flex flex-col gap-3 flex-1">

            {/* Status */}
            <StatusBadge post={post} />

            {mode === 'view' ? (
              <>
                {/* View mode: read-only text */}
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-0.5">Headline</p>
                  <p className="text-sm font-medium text-neutral-900 leading-snug">{post.title}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-0.5">Caption</p>
                  <p className="text-sm text-neutral-600 line-clamp-3">{post.caption}</p>
                </div>

                {/* View mode: actions */}
                <div className="flex flex-col gap-2 mt-auto pt-2">
                  {post.status === 'pending' && (
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      className="w-full py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
                    >
                      Schedule to FB
                    </button>
                  )}
                  {post.status === 'scheduled' && (
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      className="w-full py-2 rounded-lg text-sm font-semibold border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition"
                    >
                      Reschedule
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition"
                    >
                      Download
                    </button>
                    <button
                      onClick={handleEdit}
                      className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Edit mode: upload */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleUploadImage(e.target.files[0])}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full py-2 rounded-lg text-sm font-medium border border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition disabled:opacity-40"
                  >
                    {isUploading ? 'Uploading…' : uploadedPublicId ? '✓ New image selected' : 'Upload custom image'}
                  </button>
                </div>

                {/* Edit mode: headline */}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">
                    Headline <span className={`${editTitle.length > 80 ? 'text-red-500' : 'text-neutral-400'}`}>({editTitle.length}/80)</span>
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    placeholder="Post headline"
                  />
                </div>

                {/* Edit mode: caption */}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">
                    Caption <span className={`${editCaption.length > 600 ? 'text-red-500' : 'text-neutral-400'}`}>({editCaption.length}/600)</span>
                  </label>
                  <textarea
                    value={editCaption}
                    onChange={e => setEditCaption(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                    placeholder="Facebook caption"
                  />
                </div>

                {/* Edit mode: save/cancel */}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40"
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    )
  }
  ```

- [ ] **Step 2: Add env var for Astro Ulagam Cloudinary upload preset to `.env`**

  ```env
  VITE_CLOUDINARY_ASTRO_ULAGAM_UPLOAD_PRESET=your_preset_name_here
  ```

  Find the correct preset name in your Cloudinary dashboard (Settings → Upload → Upload presets). Use the same preset as the article-to-FB workflow uses for Astro Ulagam.

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd /Users/ylyiyany/Documents/n8n-builder/ui && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add ui/src/components/PostCard.tsx ui/.env
  git commit -m "feat: add PostCard component with view/edit modes and real-time Cloudinary preview"
  ```

---

### Task 9: `ScheduledPostsPage` component

**Files:**
- Create: `ui/src/components/ScheduledPostsPage.tsx`

- [ ] **Step 1: Create `ui/src/components/ScheduledPostsPage.tsx`**

  ```tsx
  import { useEffect } from 'react'
  import { useSearchParams } from 'react-router-dom'
  import { useScheduledPosts } from '../hooks/useScheduledPosts'
  import { PostCard } from './PostCard'
  import { Spinner } from './ds/Spinner'
  import { trackEvent } from '../utils/analytics'

  export function ScheduledPostsPage() {
    const [searchParams] = useSearchParams()

    const today = new Date().toISOString().split('T')[0]
    const date = searchParams.get('date') ?? today
    const brand = searchParams.get('brand') ?? 'Astro Ulagam'

    const { posts, isLoading, error, loadPosts, savePost, schedulePost } = useScheduledPosts(date, brand)

    useEffect(() => {
      trackEvent({ event_type: 'page_visit', tool_id: 'scheduled-posts', tool_label: 'Schedule Trending News' })
    }, [])

    const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-MY', {
      weekday: 'long', day: 'numeric', month: 'long'
    })

    return (
      <main className="pt-20 md:pt-10 px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
              Schedule Trending News
            </h1>
            <p className="text-neutral-500 mt-1 text-sm">
              {brand} · {dateLabel}
              {!isLoading && posts.length > 0 && (
                <span> · {posts.length} posts generated at 10:00 AM</span>
              )}
            </p>
            <div
              className="mt-3 h-[3px] rounded-full animate-stripe-grow"
              style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
            />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Spinner className="w-8 h-8 text-neutral-400" />
              <p className="text-sm text-neutral-500">Loading today's posts…</p>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <p className="text-sm text-neutral-500">{error}</p>
              <button
                onClick={loadPosts}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-2">
              <p className="text-sm font-medium text-neutral-700">No posts for today yet.</p>
              <p className="text-sm text-neutral-500">The workflow runs at 10:00 AM daily.</p>
            </div>
          )}

          {/* 3-column grid */}
          {!isLoading && !error && posts.length > 0 && (
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onSave={savePost}
                  onSchedule={schedulePost}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd /Users/ylyiyany/Documents/n8n-builder/ui && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add ui/src/components/ScheduledPostsPage.tsx
  git commit -m "feat: add ScheduledPostsPage with 3-column grid layout"
  ```

---

### Task 10: Route and Sidebar

**Files:**
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/components/Sidebar.tsx`

- [ ] **Step 1: Add route to `ui/src/App.tsx`**

  Add the import at the top of the file alongside other component imports:
  ```typescript
  import { ScheduledPostsPage } from './components/ScheduledPostsPage'
  ```

  Add `'scheduled-posts'` to the `ToolId` type (line 29):
  ```typescript
  type ToolId = 'home' | 'fb-post' | 'trending-news' | 'affiliate-links' | 'article-generator' | 'engagement-posts' | 'engagement-photos' | 'engagement-ucl' | 'engagement-worldcup' | 'scheduled-posts'
  ```

  Add to `pathToTool` (after line 40):
  ```typescript
  '/scheduled-posts': 'scheduled-posts',
  ```

  Add to `toolToPath` (after line 52):
  ```typescript
  'scheduled-posts': '/scheduled-posts',
  ```

  Add the route inside `<Routes>` (after the last engagement-photos route, before closing `</Routes>`):
  ```tsx
  <Route path="/scheduled-posts" element={
    <Layout {...layoutProps}>
      <ScheduledPostsPage />
    </Layout>
  } />
  ```

- [ ] **Step 2: Add sidebar entry to `ui/src/components/Sidebar.tsx`**

  Add `'scheduled-posts'` to the `ToolId` type (line 14):
  ```typescript
  type ToolId = 'home' | 'fb-post' | 'trending-news' | 'affiliate-links' | 'article-generator' | 'engagement-posts' | 'engagement-photos' | 'scheduled-posts'
  ```

  Add an import for a calendar icon at the top of the file alongside other icon imports:
  ```typescript
  import { IconCalendarClock } from '@tabler/icons-react'
  ```

  Add a new item in the `Social` section of `navSections` (after the `trending-news` entry):
  ```typescript
  { id: 'scheduled-posts', label: 'Schedule Trending News', icon: IconCalendarClock },
  ```

  Add to `TOOL_NAMES`:
  ```typescript
  'scheduled-posts': 'Schedule Trending News',
  ```

- [ ] **Step 3: Verify the app builds**

  ```bash
  cd /Users/ylyiyany/Documents/n8n-builder/ui && npm run build
  ```
  Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Run locally and verify the page loads**

  ```bash
  cd /Users/ylyiyany/Documents/n8n-builder/ui && npm run dev
  ```
  Open `http://localhost:5173/scheduled-posts`. Expected: page loads, shows loading state, fetches posts from webhook (or empty state if no posts yet for today).

- [ ] **Step 5: Commit**

  ```bash
  git add ui/src/App.tsx ui/src/components/Sidebar.tsx
  git commit -m "feat: add /scheduled-posts route and sidebar entry for Schedule Trending News"
  ```

---

## End-to-End Verification

Run through this checklist once all tasks are complete:

- [ ] Trigger the n8n scheduler workflow manually
- [ ] Verify rows appear in Google Sheets with `status: pending`
- [ ] Open `/scheduled-posts` — posts load in 3-column grid
- [ ] Click **Edit** on a card — fields become editable
- [ ] Change the headline — image preview updates in real-time (Cloudinary URL changes)
- [ ] Click **Save** — toast shows "Saved", card returns to View mode, Sheets row updated
- [ ] Click **Schedule to FB** — modal opens with date/time picker
- [ ] Pick a time and confirm — card shows "Scheduled · 7 Apr 2:30 PM", Sheets row shows `status: scheduled`
- [ ] Click **Reschedule** — modal opens again
- [ ] Click **Download** — image downloads as `.jpg`
- [ ] Upload a custom image in Edit mode — preview updates with new image before saving
- [ ] Refresh the page — all statuses persist from Google Sheets

---

## Notes

- **`buildCloudinaryUrl` in Task 7** contains a placeholder template. It MUST be replaced with the actual URL structure from the n8n Code node (Pre-Work step). The page will render wrong images until this is done.
- **Zernio integration:** When available, add a Zernio API call node in the n8n Schedule webhook (Task 5, Node 4) — after the Sheets update, before the webhook response.
- **Scaling to more brands:** The page already accepts `?brand=` query param. To add a brand picker, add a dropdown to `ScheduledPostsPage` and update the `useSearchParams` logic.
- **`VITE_CLOUDINARY_ASTRO_ULAGAM_UPLOAD_PRESET`:** Find the correct preset in Cloudinary dashboard before testing Task 8.
