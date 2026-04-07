# Schedule Trending News — Design Specification

**Date:** 2026-04-06  
**Author:** Claude  
**Status:** Design Review  

## Context

The existing n8n-builder has two separate workflows:
1. **Trending News Flow** — fetches trending articles from 7-8 news sources daily
2. **Article to FB Posts Flow** — converts any article URL into a Facebook post (image + caption)

**Goal:** Combine these two flows into a **scheduled, automated system** called "Schedule Trending News" that:
- Runs automatically at **10:00 AM daily**
- Fetches trending news for a specific brand (Astro Ulagam, starting; scaling to all brands later)
- Auto-generates Facebook post images + captions for each article
- Stores results in **Google Sheets** as the single source of truth
- Provides a **web UI** for users to review, edit, and schedule posts to Facebook

**Outcome:** Users receive a notification at 10 AM with a link to a page showing today's 15–25 auto-generated posts. They can edit image text and caption in real-time, then either download the image or schedule it to post on Facebook at a specific time.

---

## System Architecture

### Three Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│  1. n8n Workflow (10:00 AM daily)                               │
│     - Fetch trending news for Astro Ulagam                      │
│     - Generate FB post (image + caption) for each article        │
│     - Write results to Google Sheets                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Google Sheets (Data Store)                                  │
│     - Single source of truth for all post data                  │
│     - Columns: date, brand, articleUrl, imageUrl, title,        │
│       caption, status, scheduled_time, etc.                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. UI Page (`/scheduled-posts`)                                │
│     - 3-column grid of posts                                    │
│     - View/Edit modes per card                                  │
│     - Real-time Cloudinary preview                              │
│     - Save changes, Schedule to FB, Download                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. n8n Workflow (10:00 AM Scheduler)

### Trigger
- **Type:** Cron schedule
- **Time:** 10:00 UTC daily (every day, no day-of-week restriction)

### Nodes

#### Node 1: Fetch Trending News
- **Call:** Existing trending news webhook/flow
- **Input:** `{ brand: "Astro Ulagam" }`
- **Output:** Array of 15–25 articles with: `{ url, title, source, publishedAt, ... }`
- **Note:** Filter to Astro Ulagam-specific news sources only (Tamil/Indian news sources relevant to the brand)

#### Node 2: Loop Through Articles
- **For each article:** Call article-to-FB-posts generator webhook

#### Node 3: Generate FB Post
- **Call:** `VITE_GENERATE_WEBHOOK_URL` (same webhook as TrendingSpikePage)
- **Input:** 
  ```json
  {
    "url": "https://...",
    "brand": "Astro Ulagam",
    "mode": "own_brand",
    "title_mode": "ai",
    "caption_title_mode": "ai"
  }
  ```
- **Output:** 
  ```json
  {
    "success": true,
    "imageUrl": "https://res.cloudinary.com/...",
    "caption": "Post caption text",
    "title": "Post headline text",
    "originalTitle": "Original article title"
  }
  ```
- **Error Handling:** If generation fails, catch error and continue; log to Sheets with `status: "error"` + error message

#### Node 4: Write to Google Sheets
- **Append mode:** Each generated post becomes one row
- **Columns:**
  | Column | Type | Example |
  |--------|------|---------|
  | `date` | TEXT | 2026-04-06 |
  | `brand` | TEXT | Astro Ulagam |
  | `articleUrl` | TEXT | https://... |
  | `articleTitle` | TEXT | Breaking news headline |
  | `imageUrl` | TEXT | https://res.cloudinary.com/... |
  | `title` | TEXT | Post headline (text overlay) |
  | `caption` | TEXT | Facebook caption text |
  | `status` | TEXT | pending \| scheduled \| published \| error |
  | `scheduled_time` | TEXT | 2026-04-07T14:30:00Z (ISO, null if not scheduled) |
  | `scheduled_to` | TEXT | facebook (or future: instagram, tiktok) |
  | `error_message` | TEXT | (null if success, error text if failed) |

#### Node 5: Send Notification (Future)
- **Type:** Email / WhatsApp / Telegram
- **Message:** "18 posts ready for Astro Ulagam. Review and schedule: [link to /scheduled-posts]"
- **Scope:** Out of scope for initial launch; design for future integration

---

## 2. Google Sheets Schema

**Sheet Name:** `scheduled_posts`

**Columns (in order):**
1. `date` — Date workflow ran (YYYY-MM-DD)
2. `brand` — Brand name (Astro Ulagam)
3. `articleUrl` — Link to original article
4. `articleTitle` — Original article headline
5. `imageUrl` — Cloudinary URL with text layers (e.g., `l_text:Montserrat_90_bold:{title}...`)
6. `title` — Text overlay on image (editable by user)
7. `caption` — Facebook caption text (editable by user)
8. `status` — pending | scheduled | published | error
9. `scheduled_time` — ISO 8601 timestamp (null until scheduled)
10. `scheduled_to` — Platform (facebook)
11. `error_message` — Error text if generation failed (null otherwise)

**Initial State:** All rows have `status: "pending"`, `scheduled_time: null`, `scheduled_to: null`

**Data Flow:**
- **n8n writes** at 10:00 AM daily
- **UI reads** on page load (fetch today's rows)
- **UI writes** when user saves edits or schedules post (webhook → Sheets update)

---

## 3. UI Page: `/scheduled-posts`

### Layout

**Header**
```
Astro Ulagam — Sunday, 6 April
18 posts generated at 10:00 AM
```

**Main Content: 3-Column Grid**
```
┌──────────────┬──────────────┬──────────────┐
│   Card 1     │   Card 2     │   Card 3     │
├──────────────┼──────────────┼──────────────┤
│   Card 4     │   Card 5     │   Card 6     │
└──────────────┴──────────────┴──────────────┘
(continues as needed for 15–25 posts)
```

### Card Component

#### View Mode (Default)
```
┌─────────────────────────────┐
│  Image Preview              │  ← Cloudinary image (1080×1350)
│  (1080×1350)                │
│                             │
├─────────────────────────────┤
│ Headline Text (Read-only)   │
│ Caption Text (Read-only)    │
│ Status: "Pending"           │  ← Status badge
├─────────────────────────────┤
│ [Download] [Schedule to FB] │  ← Buttons
│ [Edit]                      │
└─────────────────────────────┘
```

**State Logic:**
- If `status === "pending"` → show Download + Schedule to FB + Edit buttons
- If `status === "scheduled"` → show "Scheduled for 7 Apr 2:30 PM" + Reschedule button + Edit button
- If `status === "error"` → show error message + Retry button + Edit button

#### Edit Mode (After Clicking Edit)
```
┌─────────────────────────────┐
│  Image Preview (Live)       │  ← Updates in real-time
│  (1080×1350)                │     as you edit text
│                             │
├─────────────────────────────┤
│ [Upload Image]              │  ← Button to replace base image
├─────────────────────────────┤
│ Headline: [____________]    │  ← Character counter
│ (35 characters max)         │
├─────────────────────────────┤
│ Caption:                    │
│ [____________________]      │  ← Textarea with counter
│ (600 characters max)        │
├─────────────────────────────┤
│ [Save] [Cancel]             │  ← Buttons
└─────────────────────────────┘
```

**Real-Time Preview:**
- When user edits `title` field → Cloudinary URL params update → image re-renders instantly
- Same pattern as `IdeaCard.tsx` from EngagementPhotosPage
- No API call until Save is clicked

### Responsive Behavior
- **Desktop:** 3 columns
- **Tablet:** 2 columns
- **Mobile:** 1 column

---

## 4. Webhooks & API Flows

### Webhook 1: Fetch Today's Posts

**Endpoint:** `GET /webhook/scheduled-posts`

**Query Params:**
```
?date=2026-04-06&brand=Astro%20Ulagam
```

**Triggered By:** Page load (`useEffect`)

**n8n Behavior:**
1. Read Google Sheets
2. Filter rows where `date === queryDate AND brand === queryBrand`
3. Return JSON array

**Response:**
```json
{
  "success": true,
  "posts": [
    {
      "id": "row_1", 
      "date": "2026-04-06",
      "brand": "Astro Ulagam",
      "articleUrl": "https://...",
      "articleTitle": "Breaking news",
      "imageUrl": "https://res.cloudinary.com/...",
      "title": "Post headline",
      "caption": "Facebook caption",
      "status": "pending",
      "scheduled_time": null,
      "scheduled_to": null,
      "error_message": null
    },
    ...
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Sheets not reachable"
}
```

---

### Webhook 2: Save Post Edits

**Endpoint:** `POST /webhook/scheduled-posts/update`

**Payload:**
```json
{
  "postId": "row_1",
  "updates": {
    "title": "Updated headline text",
    "caption": "Updated caption",
    "imageUrl": "https://res.cloudinary.com/... (new)"
  }
}
```

**Triggered By:** User clicks [Save] in Edit mode

**n8n Behavior:**
1. Find Google Sheets row by `postId` (row number or unique key)
2. Update columns: `title`, `caption`, `imageUrl`
3. Return updated row

**Response:**
```json
{
  "success": true,
  "post": { /* full row data */ }
}
```

---

### Webhook 3: Schedule Post to Facebook

**Endpoint:** `POST /webhook/scheduled-posts/schedule`

**Payload:**
```json
{
  "postId": "row_1",
  "scheduledTime": "2026-04-07T14:30:00Z",
  "platform": "facebook"
}
```

**Triggered By:** User clicks [Schedule to FB] button, picks date/time in modal, confirms

**n8n Behavior:**
1. Find Google Sheets row by `postId`
2. Update columns: `status = "scheduled"`, `scheduled_time`, `scheduled_to`
3. (Future) Call Zernio API to register scheduled post
4. Return updated row

**Response:**
```json
{
  "success": true,
  "status": "scheduled",
  "scheduled_time": "2026-04-07T14:30:00Z",
  "scheduled_to": "facebook"
}
```

---

### Webhook 4: Download Post Image

**Endpoint:** `GET /webhook/scheduled-posts/download?postId=row_1`

**Triggered By:** User clicks [Download] button

**Browser Behavior:**
1. Fetch image from `imageUrl` (Cloudinary URL)
2. Convert to blob
3. Trigger download with filename: `Astro-Ulagam-2026-04-06-{timestamp}.jpg`

**Note:** This is a standard browser download, no webhook needed. The `imageUrl` from Sheets already points to the finalized Cloudinary image.

---

## 5. Real-Time Cloudinary Preview

### URL Pattern

The `imageUrl` returned by the generate webhook already contains Cloudinary transformations, e.g.:

```
https://res.cloudinary.com/dymmqtqyg/image/upload/
  c_fill,g_face,w_1080,h_1350/
  c_pad,w_1080,h_1350,g_north/
  l_black_fade_pexvn5,c_fill,w_1080,h_1350/fl_layer_apply,g_south,y_0/
  l_text:Montserrat_90_bold_normal_center_line_spacing_-20:{TITLE_ENCODED},co_rgb:FFFFFF,c_fit,w_900/fl_layer_apply,g_north,x_0,y_900/
  l_text:Montserrat_38_normal_center_line_spacing_0:{CAPTION_ENCODED},co_rgb:FFFFFF,c_fit,w_850/fl_layer_apply,g_north,x_0,y_1100/
  l_{BRAND_LOGO_ID},w_150/fl_layer_apply,g_south,y_35/
  {PHOTO_PUBLIC_ID}
```

### Live Update on Edit

When user edits the `title` field in Edit mode:
1. Extract current URL from state
2. Replace `{TITLE_ENCODED}` with new value (double-encoded: `encodeURIComponent(encodeURIComponent(newTitle))`)
3. Update image `src` attribute → Cloudinary re-renders in real-time
4. User sees preview update instantly, no API call

**Example:**
- User types: "Breaking News Headline"
- Encoded: `Breaking%20News%20Headline` → `Breaking%2520News%2520Headline`
- New URL: `...l_text:Montserrat_90_bold:Breaking%2520News%2520Headline,...`
- Image updates instantly

---

## 6. Error Handling

### In n8n Workflow (10:00 AM)
- If **article generation fails** (timeout, API error, etc.) → write row with `status: "error"` + `error_message: "Generation timeout after 3 min"` → user sees error badge on card with [Retry] button
- If **Sheets write fails** → log to n8n execution; user can manually check n8n dashboard

### In UI
- **Fetch error:** Toast notification "Failed to load posts. Retry?", [Retry] button
- **Save error:** Toast "Failed to save. Retry?", [Retry] button
- **Schedule error:** Toast "Failed to schedule. Please try again."

### Retry Flow
- **In n8n:** User clicks [Retry] on error card → calls webhook to re-run generate + update Sheets row
- **In UI:** Manual [Retry] button on error badge

---

## 7. Notification Flow (Future)

After 10:00 AM workflow completes successfully:
- **Send notification** (email / WhatsApp / Telegram) to user
- **Message template:** "18 posts ready for Astro Ulagam. Review and schedule: [link]"
- **Link:** `https://your-domain.com/scheduled-posts?date=2026-04-06&brand=Astro%20Ulagam`
- User clicks → page loads with today's batch ready to edit/schedule

**Scope:** Out of scope for MVP; design provided for future sprint.

---

## 8. UI Implementation Notes

### Component Structure

```
ScheduledPostsPage
├── Header (brand, date, post count)
├── Grid (3 columns)
│   └── PostCard (repeating)
│       ├── View Mode (default)
│       │   ├── CloudinaryImage
│       │   ├── HeadlineText (read-only)
│       │   ├── CaptionText (read-only)
│       │   ├── StatusBadge
│       │   └── ActionButtons (Download, Schedule, Edit)
│       └── Edit Mode (conditional)
│           ├── CloudinaryImage (live-updating)
│           ├── UploadImageButton
│           ├── HeadlineInput (with real-time URL update)
│           ├── CaptionTextarea
│           └── ActionButtons (Save, Cancel)
├── ScheduleModal (date/time picker + confirm)
└── ErrorToast
```

### Hooks
- `useScheduledPosts()` — fetch posts from webhook, manage grid state
- `usePostCard()` — per-card state (view/edit mode, form data, real-time URL updates)
- `useToast()` — reuse existing toast hook

### Reusable Patterns
- **CloudinaryImage component** — (new) renders `<img src={cloudinaryUrl} />`, updates when URL changes
- **EditableTextField** — (reuse from IdeaCard.tsx) text input with character counter + real-time preview
- **EditableTextarea** — (reuse from IdeaCard.tsx) caption textarea with counter
- **StatusBadge** — (new) shows status + scheduled time or error message

### Environment Variables
```env
# Already configured (reuse from other tools)
VITE_GENERATE_WEBHOOK_URL

# New (for scheduled posts workflow)
VITE_SCHEDULED_POSTS_FETCH_WEBHOOK_URL
VITE_SCHEDULED_POSTS_UPDATE_WEBHOOK_URL
VITE_SCHEDULED_POSTS_SCHEDULE_WEBHOOK_URL
```

---

## 9. Verification & Testing

### Manual Testing Checklist
1. **Workflow at 10:00 AM**
   - [ ] n8n workflow triggers automatically
   - [ ] Fetches 15–25 Astro Ulagam trending articles
   - [ ] Generates FB post for each article (imageUrl, caption, title)
   - [ ] Writes rows to Google Sheets with `status: "pending"`
   - [ ] Handles errors gracefully (failed generations marked as `status: "error"`)

2. **UI Page Load**
   - [ ] Opens `/scheduled-posts?date=2026-04-06&brand=Astro%20Ulagam`
   - [ ] Fetches 15–25 posts from Sheets
   - [ ] 3-column grid displays all posts
   - [ ] Cards show in View mode (read-only text, buttons)

3. **Edit Flow**
   - [ ] Click [Edit] → card switches to Edit mode
   - [ ] Edit headline → Cloudinary URL updates → image re-renders in real-time
   - [ ] Edit caption → no URL change, just textarea update
   - [ ] Upload image → replaces base Cloudinary image
   - [ ] Click [Save] → webhook POSTs updates → Sheets row updates → toast shows "Saved"
   - [ ] Click [Cancel] → discards edits, returns to View mode

4. **Schedule Flow**
   - [ ] Click [Schedule to FB] → modal opens (date/time picker)
   - [ ] User picks date/time → clicks Confirm
   - [ ] Webhook POSTs `{ postId, scheduledTime, platform }`
   - [ ] Sheets row updates: `status: "scheduled"`, `scheduled_time: "..."`
   - [ ] Card returns to View mode, shows "Scheduled for 7 Apr 2:30 PM"
   - [ ] Click [Reschedule] → modal opens again for new time

5. **Download Flow**
   - [ ] Click [Download] → browser downloads image as `Astro-Ulagam-2026-04-06-{timestamp}.jpg`

6. **Error Handling**
   - [ ] If article generation fails → row shows `status: "error"` with error message
   - [ ] Click [Retry] → re-runs generate, updates Sheets
   - [ ] If Sheets fetch fails → UI shows "Data unavailable" + [Retry] button

---

## 10. Scaling (Future)

**Phase 2 (once working with Astro Ulagam):**
- Add brand selector dropdown on `/scheduled-posts`
- Run n8n workflow for **all 33 brands** at 10:00 AM (or offset schedule per brand)
- UI filters Sheets by selected brand + date
- Same card/edit/schedule flow for all brands

**Phase 3:**
- Integrate Zernio API for actual Facebook scheduled posting
- Track published posts in Sheets (`status: "published"`)
- Analytics dashboard (how many posts scheduled/published per brand per day)

---

## Summary

| Component | Technology | Purpose |
|-----------|----------|---------|
| **Scheduler** | n8n Cron | Triggers at 10:00 AM daily |
| **News Source** | Trending News flow | Fetches 15–25 articles per brand |
| **Generation** | Article-to-FB webhook | Converts article → FB post (image + caption) |
| **Data Store** | Google Sheets | Single source of truth for all post state |
| **UI Page** | React (`/scheduled-posts`) | 3-column grid, View/Edit per card, real-time preview |
| **Webhooks** | n8n | Fetch, Update, Schedule operations |
| **Notification** | (Future) Email/WhatsApp | Alert user when posts are ready |

---

## Acceptance Criteria (MVP)

- [ ] n8n workflow runs at 10:00 AM, generates 15–25 posts for Astro Ulagam, writes to Sheets
- [ ] UI page `/scheduled-posts` loads and displays posts in 3-column grid
- [ ] Users can edit headline/caption in real-time with Cloudinary preview
- [ ] Users can upload custom images to replace base Cloudinary image
- [ ] Users can save edits (persists to Sheets via webhook)
- [ ] Users can schedule posts to Facebook with date/time (persists status to Sheets)
- [ ] Users can download final image
- [ ] Error handling: generation failures show error badge with retry option
- [ ] All credentials stay server-side (webhooks handle Sheets access)
