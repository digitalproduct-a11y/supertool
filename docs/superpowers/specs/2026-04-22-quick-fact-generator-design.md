# Design Spec: Quick Fact Generator

**Date:** 2026-04-22
**Branch:** `feature/quick-fact-generator`
**Status:** Approved

---

## Overview

Quick Fact Generator is a new page in the super-tool that turns any article URL into a "key facts" Facebook photo post. The user pastes a URL, selects a brand, and receives an AI-generated image (logo + article photo + bullet-point facts overlay) with an editable caption — ready to download or schedule directly to Facebook.

This lives under a new **"Content Ideas"** section in the sidebar, separate from the existing article-to-FB and trending tools.

---

## User Flow

1. User navigates to `/quick-fact` via the sidebar
2. Pastes an article URL, selects a brand from the existing brand list
3. Clicks "Generate" — a **skeleton loader** appears (shimmer card matching result panel proportions)
4. Result renders:
   - Image preview (4:5 aspect ratio)
   - Editable title field (updates image on blur)
   - Editable bullet point fields (1 per fact, 3–5 total) + "Update Image" button
   - Editable caption textarea (600 char limit, copy button)
   - Download button
   - Schedule on FB button (same `ScheduleModal` flow as other tools)
5. **Error state:** red error card with message + retry button

---

## Image Template

Single Cloudinary template (1080×1350px) used for all brands — only the logo layer changes.

```
┌─────────────────────────┐
│  [Brand Logo]  top-left │
│                         │
│   Article photo         │
│   (top ~60% of image)   │
│                         │
├─────────────────────────┤
│  Dark overlay           │
│                         │
│  TITLE TEXT             │
│  • Fact 1               │
│  • Fact 2               │
│  • Fact 3 (up to 5)     │
└─────────────────────────┘
```

- Brand logo: swapped via `BRAND_LOGO_IDS` from `constants/brands.ts`
- Article image: scraped from the article by the n8n workflow, uploaded to Cloudinary
- Title + each fact are separate Cloudinary text layers so they can be replaced client-side by encoding new text into the URL

---

## Webhook Contract

**Env var:** `VITE_QUICK_FACT_WEBHOOK_URL`

**Request** (POST):
```json
{ "url": "https://...", "brand": "Astro Awani" }
```

**Success response:**
```json
{
  "success": true,
  "imageUrl": "https://res.cloudinary.com/dymmqtqyg/image/upload/...",
  "title": "3 Fakta Penting: ...",
  "facts": ["Fact 1", "Fact 2", "Fact 3"],
  "caption": "FB post caption...",
  "brand": "Astro Awani"
}
```

**Error response:**
```json
{ "success": false, "message": "Could not fetch article. Please check the URL." }
```

The webhook URL is stored in `.env` as `VITE_QUICK_FACT_WEBHOOK_URL`.

---

## n8n Workflow

New dedicated workflow: **"Quick Fact Generator"** (separate from the existing 60-node GEN workflow).

**Steps:**
1. **Webhook trigger** — `POST { url, brand }`
2. **DataTable lookup** — fetch brand logo public ID and language (BM / EN / Tamil)
3. **Fetch & parse article** — HTTP Request → HTML extract (same pattern as existing GEN workflow)
4. **AI generation (OpenAI)** — structured output:
   - `title`: short punchy headline (e.g. "3 Fakta Penting: …")
   - `facts`: array of 3–5 strings (AI decides the count based on content)
   - `caption`: Facebook post body text (matching brand language)
5. **Build Cloudinary URL** — single template with article image + brand logo + title text layer + per-fact text layers
6. **Respond to Webhook** — return the full response object

---

## Frontend Architecture

### New file

| File | Purpose |
|------|---------|
| `super-tool/ui/src/components/QuickFactPage.tsx` | Full page: input form, skeleton loader, result panel, error state |

### Modified files

| File | Change |
|------|--------|
| `super-tool/ui/src/App.tsx` | Add `'quick-fact'` to `ToolId`, route path, `TOOL_NAMES`, `<Route>`, wire `handlePostDraft` prop |
| `super-tool/ui/src/components/Sidebar.tsx` | Add "Content Ideas" section with Quick Fact Generator nav item |
| `super-tool/ui/src/types.ts` | Add `QuickFactResult` interface |
| `super-tool/ui/src/utils/cloudinary.ts` | Add `updateFactInImageUrl(imageUrl, factIndex, oldText, newText)` |

### Reused unchanged

- `ScheduleModal` — schedule to FB
- `ImageUploadModal` — custom image upload (if needed)
- `getCredentials` / `saveCredentials` / `clearCredentials` (`utils/fbCredentials.ts`)
- `BRANDS`, `BRAND_LOGO_IDS` (`constants/brands.ts`)
- `updateTitleInImageUrl` (`utils/cloudinary.ts`)
- `handlePostDraft` / `callZernioWebhook` in App.tsx (passed as prop)

---

## QuickFactPage Component Design

```
State: 'idle' | 'loading' | 'result' | 'error'

QuickFactPage
├── [idle]    Input form card
│             └── URL input + Brand selector + Generate button
├── [loading] Skeleton loader
│             └── Shimmer card: 4:5 image placeholder + 3 text line placeholders + button placeholder
├── [result]  Result panel
│             ├── Image preview (aspect-ratio 4:5)
│             ├── Title field (editable; updates image URL on blur via updateTitleInImageUrl)
│             ├── Bullet point fields (one per fact, editable)
│             │   └── "Update Image" button → rebuilds URL via updateFactInImageUrl for each changed fact
│             ├── Caption textarea (editable, 600 char limit, copy button)
│             ├── Download button
│             └── Schedule on FB button → ScheduleModal (same flow as other tools)
└── [error]   Red error card with message + "Try Again" button (resets to idle)
```

### Skeleton loader

Matches result panel proportions:
- 4:5 aspect-ratio image block (shimmer animation via `animate-pulse`)
- 1 wide text line (title placeholder)
- 3 narrower text lines (bullet placeholders)
- 1 button-height block

---

## New Type

```typescript
// types.ts
export interface QuickFactResult {
  success: true
  imageUrl: string
  title: string
  facts: string[]
  caption: string
  brand: string
}
```

---

## Sidebar Entry

```
Content Ideas
└── Quick Fact  (icon: IconBulb or IconListCheck)
```

Route: `/quick-fact` → `ToolId: 'quick-fact'`

---

## `updateFactInImageUrl` Utility

Replaces the encoded text for a specific bullet-point text layer in the Cloudinary URL.
The exact layer naming convention (e.g., position or label index) will be determined when the n8n workflow is built and the Cloudinary URL structure is known.

Signature:
```typescript
export function updateFactInImageUrl(
  imageUrl: string,
  factIndex: number,   // 0-based index of the fact to replace
  oldText: string,
  newText: string
): string
```

---

## Verification Checklist

1. Navigate to `/quick-fact` — input form renders
2. Paste a valid article URL + select brand → click Generate → skeleton loader appears
3. Result renders: image, editable title, editable bullets, editable caption
4. Edit title → blur → image URL updates, preview refreshes
5. Edit a bullet → click "Update Image" → image URL rebuilds, preview refreshes
6. Click Download → image downloads
7. Click Schedule on FB → ScheduleModal appears → submits to `VITE_POST_DRAFT_WEBHOOK_URL`
8. Paste an invalid URL → error card renders with message + retry
