# Image Skeleton Loading State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a shimmer overlay over the existing image while a custom upload or crop adjustment is loading, so the user always sees the old image for context.

**Architecture:** Add a local `imageTransitioning` boolean state to each affected component. Derive a `showShimmer` flag that combines existing loading states (`cropLoading`, `uploadLoading`) with `imageTransitioning`. Render the existing `.image-upload-shimmer` CSS class as an absolute overlay inside the image container. Clear `imageTransitioning` via the `<img>` element's `onLoad` event.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS, existing `.image-upload-shimmer` CSS class in `src/index.css`

---

## Files Modified

| File | Change |
|---|---|
| `src/components/ResultPreview.tsx` | Add `imageTransitioning` state; set it in `onSelect` and `handleCropDone`; add shimmer overlay + opacity transition to image |
| `src/components/ArticleGenerateView.tsx` | Add `imageTransitioning` state; set it in `handleFileInputChange` and `handleCropDone`; add shimmer overlay + opacity transition to image |

No new files. No CSS changes needed — `.image-upload-shimmer` already exists in `src/index.css:56`.

---

## Task 1: Shimmer overlay in ResultPreview

**Files:**
- Modify: `src/components/ResultPreview.tsx`

### Step 1.1 — Add `imageTransitioning` state

- [ ] In `ResultPreview.tsx`, after the `cropLoading` state declaration on line 40, add:

```tsx
const [imageTransitioning, setImageTransitioning] = useState(false)
```

The block around line 38–40 currently reads:
```tsx
const [showCropPicker, setShowCropPicker] = useState(false)
const [adjustedImageUrl, setAdjustedImageUrl] = useState<string | null>(null)
const [cropLoading, setCropLoading] = useState(false)
```

After the edit it should read:
```tsx
const [showCropPicker, setShowCropPicker] = useState(false)
const [adjustedImageUrl, setAdjustedImageUrl] = useState<string | null>(null)
const [cropLoading, setCropLoading] = useState(false)
const [imageTransitioning, setImageTransitioning] = useState(false)
```

### Step 1.2 — Derive `showShimmer`

- [ ] Directly below those state declarations (after line 40 / the new line 41), add:

```tsx
const showShimmer = cropLoading || imageTransitioning
```

### Step 1.3 — Set `imageTransitioning` in `handleCropDone`

- [ ] In `handleCropDone` (line 123), the `try` block currently ends with:

```tsx
      setAdjustedImageUrl(newUrl)
      setShowCropPicker(false)
      toast.success('Crop adjusted!')
```

Change it to:

```tsx
      setAdjustedImageUrl(newUrl)
      setImageTransitioning(true)
      setShowCropPicker(false)
      toast.success('Crop adjusted!')
```

### Step 1.4 — Set `imageTransitioning` in the `ImageUploadModal` `onSelect` callback

- [ ] Find the `onSelect` callback inside the `<ImageUploadModal>` render (around line 210). It currently reads:

```tsx
onSelect={({ publicId }) => {
  setUploadedPublicId(publicId)
  setShowImageUploadModal(false)
  toast.success('Image uploaded!')
}}
```

Change it to:

```tsx
onSelect={({ publicId }) => {
  setUploadedPublicId(publicId)
  setImageTransitioning(true)
  setShowImageUploadModal(false)
  toast.success('Image uploaded!')
}}
```

### Step 1.5 — Add shimmer overlay and opacity transition to the image container

- [ ] Find the image container `<div>` around line 220:

```tsx
<div className="relative bg-neutral-50 rounded-xl overflow-hidden border border-gray-200 aspect-[4/5] w-full">
```

Inside the `<>` fragment (around line 235–243), the `<img>` currently reads:

```tsx
<img
  src={adjustedImageUrl || replacementPreviewUrl || previewImageUrl}
  alt="Generated Facebook image"
  className="w-full h-full object-cover"
  onError={(e) => {
    ;(e.target as HTMLImageElement).src = ''
  }}
/>
```

Replace it with:

```tsx
<img
  src={adjustedImageUrl || replacementPreviewUrl || previewImageUrl}
  alt="Generated Facebook image"
  className={`w-full h-full object-cover transition-opacity duration-300 ${showShimmer ? 'opacity-60' : 'opacity-100'}`}
  onLoad={() => setImageTransitioning(false)}
  onError={(e) => {
    ;(e.target as HTMLImageElement).src = ''
    setImageTransitioning(false)
  }}
/>
```

Then, immediately after that `<img>`, add the shimmer overlay:

```tsx
{showShimmer && (
  <div className="absolute inset-0 image-upload-shimmer pointer-events-none" />
)}
```

### Step 1.6 — Commit

- [ ] Stage and commit:

```bash
git add super-tool/ui/src/components/ResultPreview.tsx
git commit -m "feat: shimmer loading overlay for image upload and crop in ResultPreview"
```

---

## Task 2: Shimmer overlay in ArticleGenerateView

**Files:**
- Modify: `src/components/ArticleGenerateView.tsx`

### Step 2.1 — Add `imageTransitioning` state

- [ ] In `ArticleGenerateView.tsx`, after the `cropLoading` state declaration on line 161:

```tsx
const [showCropPicker, setShowCropPicker] = useState(false)
const [adjustedImageUrl, setAdjustedImageUrl] = useState<string | null>(null)
const [adjustedAtTitle, setAdjustedAtTitle] = useState<string>('')
const [cropLoading, setCropLoading] = useState(false)
```

Add after `cropLoading`:

```tsx
const [imageTransitioning, setImageTransitioning] = useState(false)
```

### Step 2.2 — Derive `showShimmer`

- [ ] Directly below those declarations, add:

```tsx
const showShimmer = uploadLoading || cropLoading || imageTransitioning
```

### Step 2.3 — Set `imageTransitioning` in `handleCropDone`

- [ ] In `handleCropDone` (line 211), the `try` block currently ends with:

```tsx
      setAdjustedImageUrl(newUrl)
      setAdjustedAtTitle(committedTitle)
      setShowCropPicker(false)
      toast.success('Crop adjusted!')
```

Change it to:

```tsx
      setAdjustedImageUrl(newUrl)
      setImageTransitioning(true)
      setAdjustedAtTitle(committedTitle)
      setShowCropPicker(false)
      toast.success('Crop adjusted!')
```

### Step 2.4 — Set `imageTransitioning` in `handleFileInputChange`

- [ ] In `handleFileInputChange` (line 227), the `try` block currently reads:

```tsx
      const publicId = await uploadToCloudinary(file)
      setUploadedPublicId(publicId)
      setAdjustedImageUrl(null)
```

Change it to:

```tsx
      const publicId = await uploadToCloudinary(file)
      setUploadedPublicId(publicId)
      setImageTransitioning(true)
      setAdjustedImageUrl(null)
```

### Step 2.5 — Update image container to `relative` and add shimmer overlay

- [ ] Find the image display block around line 413–424. The container currently reads:

```tsx
<div className="rounded-xl overflow-hidden bg-neutral-100">
  <img src={displayImageUrl ?? undefined} alt="Generated post" className="w-full h-auto block" />
</div>
```

Replace it with:

```tsx
<div className="relative rounded-xl overflow-hidden bg-neutral-100">
  <img
    src={displayImageUrl ?? undefined}
    alt="Generated post"
    className={`w-full h-auto block transition-opacity duration-300 ${showShimmer ? 'opacity-60' : 'opacity-100'}`}
    onLoad={() => setImageTransitioning(false)}
  />
  {showShimmer && (
    <div className="absolute inset-0 image-upload-shimmer pointer-events-none" />
  )}
</div>
```

### Step 2.6 — Commit

- [ ] Stage and commit:

```bash
git add super-tool/ui/src/components/ArticleGenerateView.tsx
git commit -m "feat: shimmer loading overlay for image upload and crop in ArticleGenerateView"
```

---

## Task 3: Verify end-to-end

### Step 3.1 — Start dev server

- [ ] From `super-tool/ui/`:

```bash
npm run dev
```

Open the app in the browser.

### Step 3.2 — Verify ResultPreview (Article to FB Photos)

- [ ] Generate a post on the "Article to FB Photos" page
- [ ] Click **Upload Custom Image** → pick any image file
  - Expected: shimmer sweeps over old image while Cloudinary upload runs; new image fades in when done
- [ ] Click **Adjust Image** → drag crop region → confirm
  - Expected: shimmer sweeps over image while crop applies; updated image fades in when done
- [ ] Confirm: old image never disappears during either flow, no layout shift

### Step 3.3 — Verify ArticleGenerateView (Trending / Latest News)

- [ ] Open the **Trending** or **Latest News** tab, generate a post for any article
- [ ] Click **Upload Custom Image** → pick any image file
  - Expected: shimmer starts as soon as Cloudinary upload begins (`uploadLoading = true`), continues through image render, disappears on `onLoad`
- [ ] Click **Adjust Image** → drag crop region → confirm
  - Expected: shimmer shows while applying, disappears when new image loads
- [ ] Confirm: old image always visible during transitions

### Step 3.4 — Check edge cases

- [ ] Upload a file that fails (e.g. disconnect network mid-upload)
  - Expected: shimmer disappears, toast error shown, old image remains
- [ ] Confirm shimmer does NOT appear on initial page load or generation (only on upload/adjust)
