# Carousel Image Picker Modal — Design Spec
**Date:** 2026-04-28  
**Feature:** Article-to-Carousel — rich image picker replacing plain file input

---

## Overview

When a user wants to replace a slide image in the carousel result, instead of a plain file picker, a modal opens showing: images extracted from the article body, Pexels images from the carousel result, and a custom upload zone. Modelled after the EPL `PhotoPickerModal`.

---

## Data Shape Changes

### `CarouselResult` (types.ts)
Add one new field:
```ts
articleImages: string[]   // raw image URLs extracted from the article body by n8n
```

The `CarouselImage` type is unchanged. Pexels images are already present in `result.images` (type `'pexels'`).

### n8n workflow
The carousel n8n workflow must extract `<img>` URLs from the article body HTML and return them as `articleImages` in the webhook response. No frontend-only extraction.

---

## New Component: `CarouselImagePickerModal`

**File:** `src/components/CarouselImagePickerModal.tsx`

### Props
```ts
interface CarouselImagePickerModalProps {
  articleImages: string[]
  pexelsImages: CarouselImage[]   // max 10, type === 'pexels' sliced from result.images
  onSelect: (payload: { kind: 'file'; file: File } | { kind: 'url'; url: string }) => void
  onClose: () => void
}
```

### Internal State
- `selectedUrl: string | null` — which grid image is highlighted
- `stagedFile: File | null` — file staged from upload drag-drop zone
- `isDragging: boolean`
- Selecting a grid image clears `stagedFile`; staging a file clears `selectedUrl`

### Layout
Fixed overlay (`bg-black/30 z-50`), white card, `max-w-lg w-full max-h-[80vh] flex flex-col`.

**Header:**  
"Change Image" title. Close × button.

**Scrollable body (`flex-1 overflow-y-auto p-6 space-y-6`):**

1. **"From Article" section** — rendered only if `articleImages.length > 0`
   - Label: `FROM ARTICLE` (uppercase, xs, gray)
   - 2-column image grid
   - Click to select: highlights with border + "Selected" badge (top-left, blue bg, white text)

2. **"From Pexels" section** — rendered only if `pexelsImages.length > 0`
   - Label: `FROM PEXELS`
   - 2-column image grid, same selection behaviour
   - Images are the `.src` URLs from each `CarouselImage`
   - Shared selection state with article images (only one image selected at a time across both grids)

3. **"Upload your own" section** — always shown
   - Label: `UPLOAD YOUR OWN`
   - Drag & drop zone: "Click to upload or drag & drop" / "PNG, JPG, GIF"
   - When file staged: small preview thumbnail + "Change Photo" button
   - Staging a file clears any grid selection

**Footer (`border-t px-4 py-3 flex gap-3`):**
- Cancel button (left, outlined)
- "Select Image" primary button (right, `bg-neutral-950`, disabled unless `selectedUrl` or `stagedFile` is set)

---

## New Utility: `uploadUrlToCloudinary`

**File:** `src/utils/cloudinary.ts` (append)

```ts
export async function uploadUrlToCloudinary(url: string): Promise<string>
```

Fetches `url` as a blob, then uploads using the same `VITE_CLOUDINARY_TEMP_UPLOADS_PRESET` as `uploadToCloudinary`. Returns `public_id`.

---

## Changes to `CarouselResultPreview`

### Trigger changes
- Remove hidden `<input type="file">` and `replaceTargetIdRef`
- Add `showImagePicker: boolean` + `pickerTargetId: string | null` state
- "Upload custom image" dashed button → renamed **"Change Image"**, opens modal
- Thumbnail strip hover "Replace" icon → also opens modal

### `handlePickerSelect` (new handler)
Called with `{ kind: 'file', file: File } | { kind: 'url', url: string }`:

```
if kind === 'file':
  blob preview → setReplacements(isUploading: true)
  background: uploadToCloudinary(file) → replaceBaseImage → setReplacements(cloudinaryUrl)

if kind === 'url':
  set replacement previewUrl = url (instant preview, no blob needed)
  setReplacements(isUploading: true)
  background: uploadUrlToCloudinary(url) → replaceBaseImage → setReplacements(cloudinaryUrl)
```

Error handling: on failure, `toast.error(...)` and set `isUploading: false` (same as existing pattern).

### Passing props to modal
```tsx
<CarouselImagePickerModal
  articleImages={result.articleImages ?? []}
  pexelsImages={result.images.filter(img => img.type === 'pexels').slice(0, 10)}
  onSelect={handlePickerSelect}
  onClose={() => setShowImagePicker(false)}
/>
```

---

## Types.ts Changes

```ts
// In CarouselResult:
articleImages: string[]
```

---

## Out of Scope
- Fetching new Pexels images on demand (only images already in the carousel result are shown)
- Persisting article images between sessions
- Any changes to `ImageUploadModal` or `PhotoPickerModal`
