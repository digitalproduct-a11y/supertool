# Article Generate View Unification

**Date:** 2026-05-08  
**Scope:** Latest News tab + Trending tab + n8n competitor output  
**Status:** Approved

---

## Problem

Three divergences causing UX friction:

1. **Trending tab** shows unnecessary Brand selector, Image Title mode, and Caption Title mode toggles — fields the user doesn't need to configure since brand is already known from the trending data.
2. **Latest News tab** requires two clicks to generate a post for a single article (select article → click "Generate Post"). Should be one click.
3. Button labels are inconsistent across `GeneratePostView`, `LatestNewsTab`, and bulk views:
   - "Adjust crop" vs "Adjust Image"
   - Buttons are stacked vertically, not side by side

---

## Solution

### 1. New shared component: `ArticleGenerateView`

**File:** `src/components/ArticleGenerateView.tsx`

Extracted from LatestNewsTab's local `GenerateView`. Used by both Latest News and Trending. Replaces:
- `GenerateView` (local) in `LatestNewsTab.tsx`
- `GenerateView` (from `GeneratePostView.tsx`) in `TrendingSpikePage.tsx`

**Props:**
```ts
interface ArticleGenerateViewProps {
  article: {
    url: string
    title: string
    sourceBrand: string
    publishedAt: string
  }
  brand: string           // pre-set, no selector shown
  isCompetitor?: boolean
  onBack: () => void
  backLabel?: string      // defaults to "Back"
  autoGenerate?: boolean  // if true, calls handleGenerate on mount
}
```

**Left panel (before generation):**
- Article info box: title, source brand, relative time, "Read article" link
- Generate / Retry button

**Left panel (after generation):**
- Article info box (unchanged)
- Editable image title input
- Caption textarea with character count + copy button
- Schedule on FB button

**Right panel (before generation):**
- Empty image placeholder with ghost icon

**Right panel (after generation):**
- Generated image preview
- **"Adjust Image"** — full width; opens `FabricCropPicker`; adjusts crop via `applyFocalCrop`; only shown when `cloudinary_url` is present
- Two buttons, **side by side**:
  - **"Upload Custom Image"** — opens `ImageUploadModal` (Cloudinary library picker); replaces image via `buildCloudinaryUrl`; hidden for competitor articles
  - **"Download"** — downloads the current image

> **Label standard:** All crop/adjust buttons across the app are labeled **"Adjust Image"**. All Cloudinary library upload buttons are labeled **"Upload Custom Image"**.

---

### 2. Trending tab — use `ArticleGenerateView`

**File:** `src/pages/TrendingSpikePage.tsx`

- Remove import of `GenerateView` and `GenerateSource` from `GeneratePostView.tsx`
- Import `ArticleGenerateView` instead
- Build `article` prop from `selectedTrending`:
  ```ts
  {
    url: selectedTrending.url,
    title: selectedTrending.title ?? '',
    sourceBrand: selectedTrending.brand,
    publishedAt: selectedTrending.publishedAt ?? '',
  }
  ```
- Pass `brand={selectedTrending.brand}`, `autoGenerate={true}`, `backLabel="Back to trending"`
- Remove the `generateSource` and `GenerateSource` type usage

---

### 3. Latest News tab — dual interaction: single-click auto-generate + bulk mode retained

**File:** `src/components/LatestNewsTab.tsx`

Two interaction paths coexist:

**Path A — Single article (click card body):**
- Clicking anywhere on the article card body (title, image, description) calls `setSingleTarget(article); setView('single')`
- `ArticleGenerateView` is mounted with `autoGenerate={true}` — generation starts immediately, no extra button click
- Remove the "Generate Post →" button in the card footer (redundant now); keep "Read article" link

**Path B — Bulk (check checkbox → floating bar):**
- Checkbox overlay on thumbnail remains — clicking the checkbox toggles `selectedUrls` multi-select
- Floating bulk action bar remains when `selectedUrls.size > 0`
- Bulk view, `BulkItemPlaceholder`, `bulkResults`, and all related state remain unchanged

**What changes:**
- Card click target is split: checkbox click = select, everything else = single generate
- Remove "Generate Post →" footer button (card body click replaces it)
- Replace local `GenerateView` with `ArticleGenerateView`, passing `autoGenerate={true}`

**What stays the same:**
- `selectedUrls`, `bulkResults`, `handleBulkGenerate`, bulk view, `BulkItemPlaceholder` — all unchanged
- Floating bulk action bar — unchanged

---

### 4. Standardise button labels across the app

Update all occurrences of **"Adjust crop"** → **"Adjust Image"** in:
- `src/components/GeneratePostView.tsx` (line ~434)
- `src/components/LatestNewsTab.tsx` (line ~522, now moved to `ArticleGenerateView`)

These are the only two places; the new `ArticleGenerateView` already uses the correct labels from spec.

---

### 5. n8n: Competitor fallback image

**Workflow:** `9qmcYfdZ2Tpt2XUq` — `Competitor Output` node

Update `fb_ai_image` assignment from `""` to:
```
https://res.cloudinary.com/dymmqtqyg/image/upload/placeholder_img_cveevd
```

This is the same `DEFAULT_PHOTO` used in `IdeaCard.tsx` for the EPL engagement page. Prevents the frontend `generatePost` function from throwing "No image in response" on competitor articles.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/ArticleGenerateView.tsx` | **New** — shared generate view |
| `src/pages/TrendingSpikePage.tsx` | Use `ArticleGenerateView`, remove old `GenerateView` usage |
| `src/components/LatestNewsTab.tsx` | Remove multi-select/bulk, use `ArticleGenerateView`, single-click to generate |
| `src/components/GeneratePostView.tsx` | Rename "Adjust crop" → "Adjust Image" |
| n8n workflow `9qmcYfdZ2Tpt2XUq` | `Competitor Output.fb_ai_image` = Cloudinary placeholder URL |

---

## What Is NOT Changed

- Article-to-FB (`ArticleGeneratorPage`, `InputForm`, `PreviewPanel`) — unchanged
- Bulk generation flow — retained; checkbox multi-select and bulk view unchanged
- Trending tab's fetch logic, caching, brand sidebar — unchanged
- Latest News sidebar (brand filter) — unchanged
- Schedule on FB flow — unchanged

---

## Behaviour Summary

| Scenario | Before | After |
|---|---|---|
| Trending → Generate | Click article → form with Brand + 2 mode pickers + Generate | Click article → generation starts immediately (auto-brand, no pickers) |
| Latest News → 1 article | Click checkbox → floating bar → click Generate | Click article card body → generation starts immediately |
| Latest News → multi-select | Supported | Unchanged — checkbox still works for bulk |
| Competitor article image | Empty (causes error) | Cloudinary placeholder (`placeholder_img_cveevd`) |
| "Adjust crop" label | Inconsistent | Standardised to "Adjust Image" everywhere |
| Upload Custom Image + Adjust Image | Stacked vertically | Side by side |
