# Image Skeleton Loading State — Design Spec

**Date:** 2026-05-09
**Status:** Approved

---

## Context

When editors upload a custom image or apply a crop/focal-point adjustment, the image preview area currently shows no visual feedback — the old image just sits there until the new one silently swaps in. This creates uncertainty about whether the action registered. The goal is to add a clear "loading in place" skeleton state that keeps the old image visible for context while signalling that an update is in progress.

---

## Scope

Two components:
- `super-tool/ui/src/components/ResultPreview.tsx` — Article post generator
- `super-tool/ui/src/components/ArticleGenerateView.tsx` — Trending/Latest news generator

Triggers:
- Custom image upload (user picks a file)
- Crop / adjust image applied

---

## Approach: Shimmer Overlay on Old Image

The old image stays fully visible. A translucent shimmer gradient sweeps over it while loading. The image dims to 60% opacity during this period. When the new image finishes loading in the browser, the overlay disappears and opacity returns to 100%.

No new CSS is needed — `index.css` already defines `.image-upload-shimmer` (line 56), an animated white shimmer sweep at 1.4s cadence. It was built for this purpose but never wired up.

---

## State Design

### New state variable: `imageTransitioning: boolean`

Added to both components. Purpose: tracks the gap between "new URL assigned to `src`" and "browser has finished loading the new image".

**Set to `true` when:**
- After `setUploadedPublicId(publicId)` — new custom image URL computed
- After `setAdjustedImageUrl(newUrl)` — crop adjustment URL computed

**Set to `false` when:**
- `onLoad` fires on the `<img>` element

### Derived shimmer flag

```ts
// ArticleGenerateView
const showShimmer = uploadLoading || cropLoading || imageTransitioning

// ResultPreview
const showShimmer = cropLoading || imageTransitioning
```

`uploadLoading` in `ArticleGenerateView` already covers the Cloudinary upload phase. `imageTransitioning` covers the subsequent browser render phase. Together they give continuous feedback from file-pick to image-visible.

In `ResultPreview`, upload happens inside `ImageUploadModal`; the parent only learns via `onSelect`. So `imageTransitioning` is set in the `onSelect` callback and cleared by `onLoad`.

---

## UI Changes

Both image containers follow the same pattern:

```tsx
<div className="relative ...">
  <img
    src={...existing src expression...}
    className={`w-full h-full object-cover transition-opacity duration-300 ${
      showShimmer ? 'opacity-60' : 'opacity-100'
    }`}
    onLoad={() => setImageTransitioning(false)}
    onError={...existing onError...}
  />
  {showShimmer && (
    <div className="absolute inset-0 image-upload-shimmer pointer-events-none" />
  )}
</div>
```

---

## File Changes

### `ResultPreview.tsx`
- **Line ~40**: Add `const [imageTransitioning, setImageTransitioning] = useState(false)`
- **`onSelect` callback (~line 211)**: call `setImageTransitioning(true)` before closing modal
- **`handleCropDone` (~line 170)**: call `setImageTransitioning(true)` after `setAdjustedImageUrl(newUrl)`
- **Image `<img>` element (~line 236)**: add `onLoad`, `className` with opacity transition
- **Image container (~line 220)**: add shimmer overlay div

### `ArticleGenerateView.tsx`
- **Line ~161**: Add `const [imageTransitioning, setImageTransitioning] = useState(false)`
- **`handleFileInputChange` (~line 232)**: call `setImageTransitioning(true)` after `setUploadedPublicId(publicId)`
- **`handleCropDone` (~line 214)**: call `setImageTransitioning(true)` after `setAdjustedImageUrl(newUrl)`
- **Image `<img>` element (~line 415)**: add `onLoad`, `className` with opacity transition
- **Image container (~line 414)**: add `relative` to the container div's className, then add shimmer overlay div inside it

---

## Verification

1. Run `npm run dev` in `super-tool/ui/`
2. Open Article to FB Photos tool — generate a post
3. Click "Upload Custom Image" → pick a file → confirm shimmer appears over old image while uploading
4. Click "Adjust Image" → set crop region → confirm shimmer appears while adjustment applies
5. Confirm new image appears cleanly after shimmer disappears
6. Repeat steps 3–5 on the Trending/Latest news tab (ArticleGenerateView)
7. Confirm no layout shift, no blank flash, old image always visible during loading
