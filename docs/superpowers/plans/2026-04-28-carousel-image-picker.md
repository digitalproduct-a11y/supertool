# Carousel Image Picker Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain file picker on the article-to-carousel page with a rich modal that shows article body images and Pexels images alongside a custom upload zone.

**Architecture:** Add `articleImages: string[]` to `CarouselResult` (populated by n8n), add two Cloudinary utilities (`uploadUrlToCloudinary`, `extractBaseImageUrl`), create `CarouselImagePickerModal`, then wire it into `CarouselResultPreview` replacing the existing hidden file input.

**Tech Stack:** React, TypeScript, Tailwind CSS, Cloudinary unsigned upload API, Vite (`npx tsc --noEmit` for type checking)

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/types.ts` | Add `articleImages: string[]` to `CarouselResult` |
| Modify | `src/utils/cloudinary.ts` | Append `uploadUrlToCloudinary` and `extractBaseImageUrl` |
| Create | `src/components/CarouselImagePickerModal.tsx` | New modal component |
| Modify | `src/components/CarouselResultPreview.tsx` | Wire modal in, remove file input, add `handlePickerSelect` |

---

## Task 1: Add `articleImages` to `CarouselResult`

**Files:**
- Modify: `src/types.ts` (line ~239, inside `CarouselResult`)

- [ ] **Step 1: Add the field**

In `src/types.ts`, find the `CarouselResult` interface and add `articleImages`:

```ts
export interface CarouselResult {
  success: true
  title: string
  originalTitle: string
  brand: string
  caption: string
  images: CarouselImage[]
  articleImages: string[]   // raw image URLs extracted from article body by n8n
}
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui"
npx tsc --noEmit
```

Expected: TypeScript will now complain about places that construct a `CarouselResult` or `CarouselResponse` without `articleImages`. In `App.tsx` the result comes from an API response so it's typed via `as CarouselResponse` — check if any object literal constructions need updating. If `tsc` reports errors on `CarouselResult` object literals, add `articleImages: []` to them. The main App.tsx carousel handler casts the fetch response directly, so no literal construction should need updating.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add articleImages field to CarouselResult type"
```

---

## Task 2: Add `uploadUrlToCloudinary` and `extractBaseImageUrl` utilities

**Files:**
- Modify: `src/utils/cloudinary.ts` (append to end of file)

- [ ] **Step 1: Append the two utilities**

Open `src/utils/cloudinary.ts` and append at the end:

```ts
/**
 * Extracts the raw base image URL from a Cloudinary /image/fetch/ URL.
 * Pexels images in the carousel are served as Cloudinary fetch URLs; this
 * recovers the original Pexels URL so we can re-upload without double-overlays.
 * Returns null if the URL is not a Cloudinary fetch URL.
 */
export function extractBaseImageUrl(cloudinaryUrl: string): string | null {
  const fetchPrefix = '/image/fetch/'
  const prefixIdx = cloudinaryUrl.indexOf(fetchPrefix)
  if (prefixIdx === -1) return null

  const afterPrefix = cloudinaryUrl.substring(prefixIdx + fetchPrefix.length)
  const segments = afterPrefix.split('/')

  // The last segment with a comma is the final transform layer.
  // The encoded source URL follows it as a single segment (/ chars are %2F).
  let lastTransformIdx = -1
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].includes(',')) lastTransformIdx = i
  }

  if (lastTransformIdx < 0 || lastTransformIdx >= segments.length - 1) return null

  return decodeURIComponent(segments[lastTransformIdx + 1])
}

/**
 * Uploads an image from a URL to Cloudinary using the temp uploads preset.
 * Cloudinary fetches the URL server-side (avoids browser CORS issues).
 * Returns the public_id on success.
 */
export async function uploadUrlToCloudinary(url: string): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_TEMP_UPLOADS_PRESET as string | undefined

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary configuration missing')
  }

  const formData = new FormData()
  formData.append('file', url)          // Cloudinary accepts a URL string as the file param
  formData.append('upload_preset', uploadPreset)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`)
  }

  const data = await res.json()
  return data.public_id as string
}
```

- [ ] **Step 2: Verify types**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui"
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/cloudinary.ts
git commit -m "feat: add uploadUrlToCloudinary and extractBaseImageUrl utilities"
```

---

## Task 3: Create `CarouselImagePickerModal`

**Files:**
- Create: `src/components/CarouselImagePickerModal.tsx`

- [ ] **Step 1: Create the file**

Create `src/components/CarouselImagePickerModal.tsx` with the full implementation:

```tsx
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { CarouselImage } from '../types'

interface CarouselImagePickerModalProps {
  articleImages: string[]
  pexelsImages: CarouselImage[]   // max 10, type === 'pexels' from result.images
  onSelect: (payload: { kind: 'file'; file: File } | { kind: 'url'; url: string }) => void
  onClose: () => void
}

export function CarouselImagePickerModal({
  articleImages,
  pexelsImages,
  onSelect,
  onClose,
}: CarouselImagePickerModalProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleGridSelect = (url: string) => {
    setSelectedUrl(url)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setStagedFile(null)
  }

  const handleFileStage = (file: File) => {
    setSelectedUrl(null)
    setStagedFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleFileStage(file)
  }

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    onClose()
  }

  const handleConfirm = () => {
    if (selectedUrl) {
      onSelect({ kind: 'url', url: selectedUrl })
    } else if (stagedFile) {
      onSelect({ kind: 'file', file: stagedFile })
    }
    // Note: do NOT revoke previewUrl here — the caller still needs to display
    // it as an instant preview until the Cloudinary upload completes.
    onClose()
  }

  const canConfirm = selectedUrl !== null || stagedFile !== null

  return createPortal(
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-[0_2px_24px_rgba(0,0,0,0.12)]">

        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">Change Image</h2>
            <p className="text-sm text-gray-600 mt-1">Pick an image or upload your own</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-900 text-2xl leading-none transition"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Article images */}
          {articleImages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">From Article</p>
              <div className="grid grid-cols-2 gap-3">
                {articleImages.map((url) => (
                  <div key={url} className="relative">
                    <button
                      onClick={() => handleGridSelect(url)}
                      className={`w-full block rounded-lg overflow-hidden border-2 transition ${
                        selectedUrl === url ? 'border-blue-600' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={url} alt="Article image" className="w-full h-auto" />
                    </button>
                    {selectedUrl === url && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
                        Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pexels images */}
          {pexelsImages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">From Pexels</p>
              <div className="grid grid-cols-2 gap-3">
                {pexelsImages.map((img) => (
                  <div key={img.id} className="relative">
                    <button
                      onClick={() => handleGridSelect(img.src)}
                      className={`w-full block rounded-lg overflow-hidden border-2 transition ${
                        selectedUrl === img.src ? 'border-blue-600' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={img.src} alt={img.alt} className="w-full h-auto" />
                    </button>
                    {selectedUrl === img.src && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
                        Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload section */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">Upload Your Own</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileStage(file)
                e.target.value = ''
              }}
            />
            {!previewUrl ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-neutral-900 bg-neutral-50'
                    : 'border-neutral-300 hover:border-neutral-400'
                }`}
              >
                <p className="text-sm font-medium text-neutral-900 mb-1">Click to upload or drag & drop</p>
                <p className="text-xs text-neutral-500">PNG, JPG, GIF</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-100 rounded-lg overflow-hidden">
                  <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-48 object-contain" />
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2 text-xs text-neutral-600 hover:text-neutral-900 border border-gray-300 rounded-lg transition"
                >
                  Change Photo
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 flex gap-3 flex-shrink-0">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-neutral-600 hover:text-neutral-900 border border-gray-300 rounded-lg text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 px-4 py-2 bg-neutral-950 hover:bg-neutral-800 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-lg text-xs font-medium transition active:scale-[0.98]"
          >
            Select Image
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: Verify types**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CarouselImagePickerModal.tsx
git commit -m "feat: add CarouselImagePickerModal component"
```

---

## Task 4: Wire `CarouselImagePickerModal` into `CarouselResultPreview`

**Files:**
- Modify: `src/components/CarouselResultPreview.tsx`

This task has multiple sub-steps. Apply them in order to `src/components/CarouselResultPreview.tsx`.

- [ ] **Step 1: Update the `ImageReplacement` interface**

Find this interface near the top of the file (~line 11) and make `file` optional:

```ts
interface ImageReplacement {
  file?: File              // present for file uploads, absent for URL picks
  previewUrl: string       // blob URL (file uploads) or raw URL (url picks) for instant preview
  cloudinaryUrl?: string   // final URL with overlays applied
  isUploading?: boolean
}
```

- [ ] **Step 2: Update the import line for cloudinary utils and add modal import**

Replace the existing cloudinary import (~line 7):

```ts
import { updateTitleInImageUrl, replaceBaseImage, uploadToCloudinary, uploadUrlToCloudinary, extractBaseImageUrl } from '../utils/cloudinary'
```

Add the modal import after the existing component imports:

```ts
import { CarouselImagePickerModal } from './CarouselImagePickerModal'
```

- [ ] **Step 3: Replace `fileInputRef` / `replaceTargetIdRef` with picker state**

Remove these two lines (~lines 41–42):

```ts
const fileInputRef = useRef<HTMLInputElement>(null)
const replaceTargetIdRef = useRef<string | null>(null)
```

Add these two state variables instead (alongside the other `useState` declarations):

```ts
const [showImagePicker, setShowImagePicker] = useState(false)
const [pickerTargetId, setPickerTargetId] = useState<string | null>(null)
```

- [ ] **Step 4: Replace `openReplace` + `handleFileChange` with `openPicker` + `handlePickerSelect`**

Remove the `openReplace` function (~lines 132–135):

```ts
function openReplace(imageId: string) {
  replaceTargetIdRef.current = imageId
  fileInputRef.current?.click()
}
```

Remove the `handleFileChange` function (~lines 137–181).

Add these two functions in their place:

```ts
function openPicker(imageId: string) {
  setPickerTargetId(imageId)
  setShowImagePicker(true)
}

function handlePickerSelect(payload: { kind: 'file'; file: File } | { kind: 'url'; url: string }) {
  const targetId = pickerTargetId
  setShowImagePicker(false)
  setPickerTargetId(null)
  if (!targetId) return

  const originalImage = result.images.find(img => img.id === targetId)
  if (!originalImage) return

  if (payload.kind === 'file') {
    const file = payload.file
    const previewUrl = URL.createObjectURL(file)
    setReplacements(prev => {
      const next = new Map(prev)
      const old = next.get(targetId)
      if (old?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(old.previewUrl)
      next.set(targetId, { file, previewUrl, isUploading: true })
      return next
    })
    uploadToCloudinary(file)
      .then(publicId => {
        const cloudinaryUrl = replaceBaseImage(originalImage.src, publicId)
        setReplacements(prev => {
          const next = new Map(prev)
          const current = next.get(targetId)
          if (current) next.set(targetId, { ...current, cloudinaryUrl, isUploading: false })
          return next
        })
      })
      .catch(() => {
        toast.error('Image upload failed. Overlays won\'t be applied.')
        setReplacements(prev => {
          const next = new Map(prev)
          const current = next.get(targetId)
          if (current) next.set(targetId, { ...current, isUploading: false })
          return next
        })
      })
  } else {
    // URL pick — use raw Pexels URL if this is a Cloudinary fetch URL, to avoid double-overlays
    const rawUrl = extractBaseImageUrl(payload.url) ?? payload.url
    setReplacements(prev => {
      const next = new Map(prev)
      const old = next.get(targetId)
      if (old?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(old.previewUrl)
      next.set(targetId, { previewUrl: payload.url, isUploading: true })
      return next
    })
    uploadUrlToCloudinary(rawUrl)
      .then(publicId => {
        const cloudinaryUrl = replaceBaseImage(originalImage.src, publicId)
        setReplacements(prev => {
          const next = new Map(prev)
          const current = next.get(targetId)
          if (current) next.set(targetId, { ...current, cloudinaryUrl, isUploading: false })
          return next
        })
      })
      .catch(() => {
        toast.error('Image upload failed. Overlays won\'t be applied.')
        setReplacements(prev => {
          const next = new Map(prev)
          const current = next.get(targetId)
          if (current) next.set(targetId, { ...current, isUploading: false })
          return next
        })
      })
  }
}
```

- [ ] **Step 5: Update `downloadImage` and `handleDownloadZip` for optional `file`**

In `downloadImage` (~line 115), find:

```ts
if (replacement && !replacement.cloudinaryUrl) {
  blob = replacement.file
} else {
```

Replace with:

```ts
if (replacement && !replacement.cloudinaryUrl) {
  if (replacement.file) {
    blob = replacement.file
  } else {
    const res = await fetch(replacement.previewUrl)
    blob = await res.blob()
  }
} else {
```

In `handleDownloadZip` (~line 221), find the same pattern:

```ts
if (replacement && !replacement.cloudinaryUrl) {
  blob = replacement.file
} else {
```

Replace with the same fix:

```ts
if (replacement && !replacement.cloudinaryUrl) {
  if (replacement.file) {
    blob = replacement.file
  } else {
    const res = await fetch(replacement.previewUrl)
    blob = await res.blob()
  }
} else {
```

- [ ] **Step 6: Remove the hidden file input from JSX**

Find and remove this block (~lines 308–315):

```tsx
{/* Hidden file input for image replacement */}
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  className="hidden"
  onChange={handleFileChange}
/>
```

- [ ] **Step 7: Update the per-slide "Upload custom image" button**

Find (~line 382):

```tsx
<button
  onClick={() => openReplace(currentImage.id)}
  className="w-full py-2 rounded-lg text-sm font-medium border border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition flex items-center justify-center gap-2"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
  Upload custom image
</button>
```

Replace with:

```tsx
<button
  onClick={() => openPicker(currentImage.id)}
  className="w-full py-2 rounded-lg text-sm font-medium border border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition flex items-center justify-center gap-2"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
  Change Image
</button>
```

- [ ] **Step 8: Update thumbnail strip hover "Replace" button**

Find this button inside the thumbnail strip hover overlay (~line 472):

```tsx
<button
  onClick={(e) => { e.stopPropagation(); openReplace(img.id) }}
  title="Replace"
  className="w-6 h-6 rounded bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
>
```

Replace `openReplace(img.id)` with `openPicker(img.id)`:

```tsx
<button
  onClick={(e) => { e.stopPropagation(); openPicker(img.id) }}
  title="Replace"
  className="w-6 h-6 rounded bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
>
```

- [ ] **Step 9: Render the modal**

At the very end of the returned JSX, just before the final closing `</div>`, add:

```tsx
{showImagePicker && pickerTargetId && (
  <CarouselImagePickerModal
    articleImages={result.articleImages ?? []}
    pexelsImages={result.images.filter(img => img.type === 'pexels').slice(0, 10)}
    onSelect={handlePickerSelect}
    onClose={() => { setShowImagePicker(false); setPickerTargetId(null) }}
  />
)}
```

- [ ] **Step 10: Verify types**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui"
npx tsc --noEmit
```

Expected: no errors. If TypeScript complains about `useRef` no longer being used, remove it from the React import at the top of the file.

- [ ] **Step 11: Run dev server and manually test**

```bash
cd "/Users/limyeanfen/Documents/N8N Digital Workflows/super-tool/ui"
npm run dev
```

Open `http://localhost:5173/article-to-carousel` in the browser. Generate a carousel from an article URL. Then:

1. Click "Change Image" on the main slide viewer → modal opens
2. If article has images, "From Article" section shows with 2-col grid
3. "From Pexels" section shows Pexels images from the carousel (max 10)
4. Click a grid image → gets blue "Selected" border badge; footer "Select Image" button enables
5. Click "Select Image" → modal closes; slide updates with new image; loading spinner appears while overlays are applied
6. Drag a file onto the upload zone → preview appears; "Select Image" button enables
7. Click "Select Image" with file staged → modal closes; slide updates with instant blob preview; overlays applied in background
8. Hover a thumbnail in the strip → "Replace" icon opens the same modal
9. "Cancel" and × both close modal without making changes

- [ ] **Step 12: Commit**

```bash
git add src/components/CarouselResultPreview.tsx
git commit -m "feat: replace file input with CarouselImagePickerModal on article-to-carousel page"
```

---

## Notes

- The n8n carousel workflow must be updated separately to extract `<img>` URLs from the article HTML and return them as `articleImages` in the webhook response. The frontend uses `result.articleImages ?? []` defensively so existing carousels (without `articleImages`) still work.
- `uploadUrlToCloudinary` passes the URL directly to Cloudinary's upload API as the `file` parameter — Cloudinary fetches it server-side, avoiding CORS issues with third-party image URLs.
- For Pexels images (Cloudinary `/image/fetch/` URLs), `extractBaseImageUrl` recovers the raw Pexels URL before uploading, so the overlays from the original slide are not baked into the new base image.
