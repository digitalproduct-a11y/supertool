# Article Generate View Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace divergent generate views in Trending and Latest News tabs with a single shared `ArticleGenerateView` component, fix competitor fallback image, and standardise button labels.

**Architecture:** Extract the generate view from `LatestNewsTab.tsx` into `ArticleGenerateView.tsx`; export `generatePost` so Latest News bulk flow can still import it; both Trending and Latest News single-card flows use `autoGenerate={true}`.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind CSS, n8n REST API (for Task 1)

---

## File Map

| File | Action |
|---|---|
| `src/components/ArticleGenerateView.tsx` | **Create** — shared generate view component |
| `src/components/LatestNewsTab.tsx` | **Modify** — remove local GenerateView, add card-click handler, import shared component |
| `src/pages/TrendingSpikePage.tsx` | **Modify** — swap GenerateView from GeneratePostView with ArticleGenerateView |
| `src/components/GeneratePostView.tsx` | **Modify** — rename "Adjust crop" → "Adjust Image" |
| n8n workflow `9qmcYfdZ2Tpt2XUq` | **Modify** — set `Competitor Output.fb_ai_image` to Cloudinary placeholder |

---

## Task 1: n8n — Fix competitor fallback image

**Files:**
- n8n workflow `9qmcYfdZ2Tpt2XUq` (GEN: FB Image & Caption - Fabric)

- [ ] **Step 1: Fetch the workflow**

  Use the n8n MCP tool:
  ```
  n8n_get_workflow({ id: "9qmcYfdZ2Tpt2XUq" })
  ```
  Locate the node named `Competitor Output`. It has an assignment field `fb_ai_image` currently set to `""`.

- [ ] **Step 2: Update the node via partial workflow update**

  Use `n8n_update_partial_workflow` to patch only the `Competitor Output` node's `fb_ai_image` assignment value from `""` to:
  ```
  https://res.cloudinary.com/dymmqtqyg/image/upload/placeholder_img_cveevd
  ```

  The assignment entry in the node's `parameters.assignments.assignments` array looks like:
  ```json
  {
    "id": "<existing-id>",
    "name": "fb_ai_image",
    "value": "",
    "type": "string"
  }
  ```
  Change `"value"` to `"https://res.cloudinary.com/dymmqtqyg/image/upload/placeholder_img_cveevd"`.

- [ ] **Step 3: Verify**

  Fetch the workflow again and confirm `Competitor Output.fb_ai_image` is the Cloudinary URL, not an empty string.

---

## Task 2: Create `ArticleGenerateView.tsx`

**Files:**
- Create: `src/components/ArticleGenerateView.tsx`

This is extracted and adapted from the local `GenerateView` inside `LatestNewsTab.tsx` (lines 265–599). Key changes from the original:
- Props: `backLabel`, `autoGenerate`, optional `isCompetitor`
- `autoGenerate` triggers generation on mount via `useEffect`
- Layout: left panel has article info + title + caption + Schedule on FB; right panel has image + Adjust Image + Upload Custom Image | Download side by side
- `generatePost` is **exported** so LatestNewsTab bulk flow can import it
- `ImageUploadModal` rendered as a portal (consistent with other modals)

- [ ] **Step 1: Create the file**

  Create `src/components/ArticleGenerateView.tsx` with this content:

  ```tsx
  import { useState, useEffect } from 'react'
  import { createPortal } from 'react-dom'
  import { IconChevronLeft, IconExternalLink, IconCopy, IconCheck, IconDownload, IconUpload } from '@tabler/icons-react'
  import { toast } from '../hooks/useToast'
  import { ScheduleModal } from './ScheduleModal'
  import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'
  import { COMPETITOR_BRANDS } from '../constants/rssFeedsByBrand'
  import { updateTitleInImageUrl } from '../utils/cloudinary'
  import ImageUploadModal from './ImageUploadModal'
  import { encodeImage } from './GeneratePostView'
  import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
  import { applyFocalCrop } from '../features/photo/cropUtils'
  import { FabricCropPicker } from '../features/photo/FabricCropPicker'

  type GenerateState = 'idle' | 'generating' | 'done' | 'error'
  type ScheduleState = 'idle' | 'posting' | 'done' | 'error'

  interface GeneratedPost {
    imageUrl: string
    caption: string
    title: string
    originalTitle: string
    cloudinary_url?: string
  }

  export async function generatePost(
    articleUrl: string,
    brand: string,
    titleMode: 'original' | 'ai',
    customImageBase64?: string,
    isCompetitor?: boolean,
  ): Promise<GeneratedPost> {
    const webhookUrl = (import.meta.env.VITE_GENERATE_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl) throw new Error('Generate webhook not configured.')
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: articleUrl,
        brand,
        title_mode: titleMode,
        caption_title_mode: titleMode,
        ...(isCompetitor ? { is_competitor: true } : {}),
        ...(customImageBase64 ? { custom_image: customImageBase64 } : {}),
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { imageUrl?: string; caption?: string; title?: string; originalTitle?: string; cloudinary_url?: string; error?: string }
    if (data.error) throw new Error(data.error)
    if (!data.imageUrl) throw new Error('No image in response')
    return {
      imageUrl: data.imageUrl,
      caption: data.caption ?? '',
      title: data.title ?? '',
      originalTitle: data.originalTitle ?? data.title ?? '',
      cloudinary_url: data.cloudinary_url,
    }
  }

  async function callScheduleWebhook(
    imageUrl: string,
    caption: string,
    brand: string,
    scheduledFor: string | undefined,
    passcode: string,
  ): Promise<{ success: boolean; message: string; status?: string }> {
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl) return { success: false, message: 'Webhook not configured.' }
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url: imageUrl,
          fb_ai_caption: caption,
          brand: brand.toLowerCase(),
          ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
          passcode,
        }),
      })
      const data = await res.json() as { success?: boolean; status?: string; message?: string }
      if (data.status === 'AUTH_ERROR') {
        clearCredentials(brand.toLowerCase())
        return { success: false, message: data.message ?? 'Invalid passcode.', status: 'AUTH_ERROR' }
      }
      if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
        saveCredentials(brand.toLowerCase(), passcode)
        return { success: true, message: data.message ?? 'Scheduled!' }
      }
      return { success: false, message: data.message ?? 'Something went wrong.' }
    } catch {
      return { success: false, message: 'Network error. Please try again.' }
    }
  }

  function relativeTime(isoStr: string): string {
    const diff = Date.now() - new Date(isoStr).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`
  }

  interface ArticleGenerateViewProps {
    article: {
      url: string
      title: string
      sourceBrand: string
      publishedAt: string
    }
    brand: string
    isCompetitor?: boolean
    onBack: () => void
    backLabel?: string
    autoGenerate?: boolean
  }

  export function ArticleGenerateView({
    article,
    brand,
    isCompetitor: isCompetitorProp,
    onBack,
    backLabel = 'Back',
    autoGenerate = false,
  }: ArticleGenerateViewProps) {
    const isCompetitor = isCompetitorProp ?? COMPETITOR_BRANDS.includes(article.sourceBrand)
    const isBrandMismatch = article.sourceBrand.toLowerCase() !== brand.toLowerCase()
    const titleMode = isBrandMismatch || isCompetitor ? 'ai' : 'original'

    const [generateState, setGenerateState] = useState<GenerateState>('idle')
    const [generated, setGenerated] = useState<GeneratedPost | null>(null)

    const [editableTitle, setEditableTitle] = useState('')
    const [committedTitle, setCommittedTitle] = useState('')

    const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
    const [showImageUploadModal, setShowImageUploadModal] = useState(false)

    const [caption, setCaption] = useState('')
    const [copied, setCopied] = useState(false)

    const [scheduleState, setScheduleState] = useState<ScheduleState>('idle')
    const [showScheduleModal, setShowScheduleModal] = useState(false)

    const [showCropPicker, setShowCropPicker] = useState(false)
    const [adjustedImageUrl, setAdjustedImageUrl] = useState<string | null>(null)
    const [cropLoading, setCropLoading] = useState(false)

    useEffect(() => { setUploadedPublicId(null); setAdjustedImageUrl(null) }, [generated?.imageUrl])

    const baseImageUrl = uploadedPublicId
      ? buildCloudinaryUrl(uploadedPublicId, committedTitle || generated?.title || '', generated?.imageUrl || '')
      : generated?.imageUrl ?? null

    const previewImageUrl = baseImageUrl
      ? updateTitleInImageUrl(baseImageUrl, generated?.title ?? '', committedTitle)
      : null

    const handleGenerate = async () => {
      setGenerateState('generating')
      try {
        const result = await generatePost(article.url, brand, titleMode, undefined, isCompetitor)
        setGenerated(result)
        setCaption(result.caption)
        setEditableTitle(result.title)
        setCommittedTitle(result.title)
        setGenerateState('done')
      } catch (err) {
        setGenerateState('error')
        toast.error(err instanceof Error ? err.message : 'Generation failed')
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (autoGenerate) { void handleGenerate() } }, [])

    const handleCopyCaption = async () => {
      try {
        await navigator.clipboard.writeText(caption)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        toast.error('Failed to copy')
      }
    }

    const handleCropDone = async (cropRegion: { x: number; y: number; width: number; height: number }) => {
      if (!generated?.cloudinary_url) return
      setCropLoading(true)
      try {
        const newUrl = await applyFocalCrop(previewImageUrl ?? generated.imageUrl, generated.cloudinary_url, cropRegion)
        setAdjustedImageUrl(newUrl)
        setShowCropPicker(false)
        toast.success('Crop adjusted!')
      } catch {
        toast.error('Failed to adjust crop')
      } finally {
        setCropLoading(false)
      }
    }

    const handleDownload = () => {
      if (!previewImageUrl) return
      const a = document.createElement('a')
      a.href = adjustedImageUrl ?? previewImageUrl
      a.download = `${brand.toLowerCase().replace(/\s+/g, '-')}-post.jpg`
      a.target = '_blank'
      a.click()
    }

    const handleSchedule = async (scheduledFor: string, passcode: string) => {
      if (!generated || !previewImageUrl) return
      setScheduleState('posting')
      const finalPasscode = passcode || getCredentials(brand.toLowerCase())?.passcode || ''
      const response = await callScheduleWebhook(adjustedImageUrl ?? previewImageUrl, caption, brand, scheduledFor, finalPasscode)
      if (response.status === 'AUTH_ERROR') {
        setShowScheduleModal(true)
        setScheduleState('idle')
        toast.error('Invalid passcode. Please try again.')
      } else if (response.success) {
        setScheduleState('done')
        setShowScheduleModal(false)
        toast.success('Scheduled on Facebook!')
      } else {
        setScheduleState('error')
        toast.error(response.message || "Couldn't schedule. Please try again.")
      }
    }

    return (
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-10">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Back */}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950 transition"
          >
            <IconChevronLeft className="w-4 h-4" />
            {backLabel}
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">

            {/* ── Left panel ── */}
            <div className="glass-card rounded-2xl p-6 space-y-5">

              {/* Article info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Article</label>
                <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-3.5">
                  <p className="text-[11px] text-neutral-400 mb-1">
                    {article.sourceBrand} · {relativeTime(article.publishedAt)}
                    {isBrandMismatch && (
                      <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">AI title</span>
                    )}
                  </p>
                  <p className="text-sm font-semibold text-neutral-950 leading-snug line-clamp-3">{article.title}</p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition mt-1.5"
                  >
                    Read article <IconExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Image title — shown after generation */}
              {generateState === 'done' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image Title</label>
                  <input
                    type="text"
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    onBlur={() => setCommittedTitle(editableTitle)}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    placeholder="Edit image title…"
                  />
                  <p className="text-xs text-neutral-400 mt-1 text-right">{editableTitle.length}</p>
                </div>
              )}

              {/* Caption — shown after generation */}
              {generateState === 'done' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Caption</label>
                    <button
                      onClick={handleCopyCaption}
                      className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-950 transition px-2 py-1 rounded-lg hover:bg-neutral-100"
                    >
                      {copied ? (
                        <><IconCheck className="w-3.5 h-3.5 text-green-500" /><span className="text-green-500">Copied</span></>
                      ) : (
                        <><IconCopy className="w-3.5 h-3.5" />Copy</>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none leading-relaxed"
                    rows={7}
                  />
                  <p className="text-xs text-neutral-400 text-right">{caption.length} chars</p>
                </div>
              )}

              {/* Generate / Retry — shown before generation */}
              {(generateState === 'idle' || generateState === 'error') && (
                <div className="space-y-2">
                  {generateState === 'error' && (
                    <p className="text-xs text-red-500 text-center">Generation failed. Try again.</p>
                  )}
                  <button
                    onClick={handleGenerate}
                    className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    {generateState === 'error' ? 'Retry' : 'Generate Post'}
                  </button>
                </div>
              )}

              {generateState === 'generating' && (
                <div className="py-6 flex flex-col items-center gap-3 text-center">
                  <p className="text-sm font-semibold text-neutral-800">Generating your post…</p>
                  <p className="text-xs text-neutral-400">This usually takes around 30 seconds</p>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}

              {/* Schedule on FB — shown after generation */}
              {generateState === 'done' && (
                <div>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    disabled={scheduleState === 'posting'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    {scheduleState === 'posting' ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Scheduling…
                      </>
                    ) : 'Schedule on FB'}
                  </button>
                  {scheduleState === 'done' && <p className="text-xs text-green-600 text-center mt-1">✓ Scheduled on Facebook!</p>}
                  {scheduleState === 'error' && <p className="text-xs text-red-500 text-center mt-1">✗ Failed to schedule. Try again.</p>}
                </div>
              )}
            </div>

            {/* ── Right panel ── */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              {previewImageUrl ? (
                <div className="rounded-xl overflow-hidden bg-neutral-100">
                  <img src={adjustedImageUrl ?? previewImageUrl} alt="Generated post" className="w-full h-auto block" />
                </div>
              ) : (
                <div className="rounded-xl bg-neutral-100 aspect-square flex flex-col items-center justify-center gap-2">
                  <svg className="w-8 h-8 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-neutral-400">Generated image will appear here</p>
                </div>
              )}

              {generateState === 'done' && (
                <>
                  {/* Adjust Image — full width, only when cloudinary_url present */}
                  {generated?.cloudinary_url && (
                    <button
                      onClick={() => setShowCropPicker(true)}
                      disabled={cropLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-gray-400 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {cropLoading ? 'Adjusting...' : 'Adjust Image'}
                    </button>
                  )}

                  {/* Upload Custom Image | Download — side by side */}
                  <div className="flex gap-3">
                    {!isCompetitor && (
                      <button
                        onClick={() => setShowImageUploadModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <IconUpload className="w-4 h-4" />
                        Upload Custom Image
                      </button>
                    )}
                    <button
                      onClick={handleDownload}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      <IconDownload className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {showScheduleModal && generated && createPortal(
          <ScheduleModal
            brand={brand}
            hasCredentials={!!getCredentials(brand.toLowerCase())}
            isPosting={scheduleState === 'posting'}
            onConfirm={(sf, passcode) => void handleSchedule(sf ?? '', passcode ?? '')}
            onClose={() => setShowScheduleModal(false)}
          />,
          document.body
        )}
        {showImageUploadModal && createPortal(
          <ImageUploadModal
            onSelect={({ publicId }) => {
              setUploadedPublicId(publicId)
              setShowImageUploadModal(false)
            }}
            onClose={() => setShowImageUploadModal(false)}
          />,
          document.body
        )}
        {showCropPicker && generated?.cloudinary_url && createPortal(
          <FabricCropPicker
            sourceImageUrl={generated.cloudinary_url}
            aspectRatio={1080 / 1350}
            onDone={handleCropDone}
            onCancel={() => setShowCropPicker(false)}
          />,
          document.body
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the file compiles**

  Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit 2>&1 | head -30`

  Expected: No errors related to `ArticleGenerateView.tsx`. Ignore pre-existing errors elsewhere.

---

## Task 3: Update `LatestNewsTab.tsx`

**Files:**
- Modify: `src/components/LatestNewsTab.tsx`

Three changes: (a) remove local `GenerateView`/`generatePost`/`callScheduleWebhook`, (b) import shared component, (c) wire up card-body click → single auto-generate.

- [ ] **Step 1: Replace imports**

  In the import block at the top of `LatestNewsTab.tsx`, make these changes:

  **Remove** these imports (only used inside the local GenerateView):
  ```ts
  import { ScheduleModal } from './ScheduleModal'
  import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'
  import { updateTitleInImageUrl } from '../utils/cloudinary'
  import ImageUploadModal from './ImageUploadModal'
  import { encodeImage } from './GeneratePostView'
  import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
  import { applyFocalCrop } from '../features/photo/cropUtils'
  import { FabricCropPicker } from '../features/photo/FabricCropPicker'
  ```

  From the tabler icons import, **remove** `IconChevronRight, IconCopy, IconCheck, IconDownload, IconUpload` (only used inside the removed GenerateView). Keep `IconRefresh, IconExternalLink, IconChevronLeft, IconSearch`.

  **Add** this import:
  ```ts
  import { ArticleGenerateView, generatePost } from './ArticleGenerateView'
  ```

  Final tabler icons line should be:
  ```ts
  import { IconRefresh, IconExternalLink, IconChevronLeft, IconSearch } from '@tabler/icons-react'
  ```

- [ ] **Step 2: Remove local function and component definitions**

  Delete lines 140–599 (the `generatePost` async function, `callScheduleWebhook` async function, and the entire local `GenerateView` component). These are now in `ArticleGenerateView.tsx`.

  Also remove the `GenerateState` and `ScheduleState` type aliases (lines 54–55) — they were only used in GenerateView.

- [ ] **Step 3: Update the single-view render**

  Find the single view render (currently around line 839–847 after removals):
  ```tsx
  if (view === 'single' && singleTarget) {
    return (
      <GenerateView
        article={singleTarget}
        brand={brand}
        onBack={handleBack}
      />
    )
  }
  ```

  Replace with:
  ```tsx
  if (view === 'single' && singleTarget) {
    return (
      <ArticleGenerateView
        article={singleTarget}
        brand={brand}
        autoGenerate={true}
        onBack={handleBack}
      />
    )
  }
  ```

- [ ] **Step 4: Add card-body click handler and remove Generate Post button**

  Find the article card in the browse view. The outer div currently has no `onClick`. Make these changes:

  **Outer card div** — add `onClick` and `cursor-pointer`:
  ```tsx
  <div
    key={`${article.url}-${idx}`}
    onClick={() => { setSingleTarget(article); setView('single') }}
    className={`rounded-xl border overflow-hidden transition-all cursor-pointer ${
      selected ? 'border-neutral-400 bg-neutral-50' : 'bg-white border-neutral-100 hover:border-neutral-200 hover:shadow-sm'
    }`}
  >
  ```

  **Checkbox button** — add `e.stopPropagation()`:
  ```tsx
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); toggleUrl(article.url) }}
    className={...}
  >
  ```

  **Card footer** — remove the "Generate Post →" button; add `e.stopPropagation()` to the "Read article" link; remove `justify-between` from the footer div:
  ```tsx
  <div className="border-t border-neutral-100 px-4 py-2.5">
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition"
    >
      Read article <IconExternalLink className="w-3 h-3" />
    </a>
  </div>
  ```

- [ ] **Step 5: Verify TypeScript**

  Run: `cd /Users/limyeanfen/Documents/N8N\ Digital\ Workflows/super-tool/ui && npx tsc --noEmit 2>&1 | head -30`

  Expected: No new errors introduced.

- [ ] **Step 6: Manual smoke test**

  Start dev server: `npm run dev -- --mode staging`

  - Open Latest News tab → click any article card body (not the checkbox, not "Read article") → generation should start immediately (no extra button click)
  - Open Latest News tab → click article checkbox → bulk bar appears → click "Generate" → bulk view works
  - In single view: confirm left panel shows article info → (generating state) → title + caption + Schedule on FB; right panel shows image → Adjust Image → Upload Custom Image | Download

---

## Task 4: Update `TrendingSpikePage.tsx`

**Files:**
- Modify: `src/pages/TrendingSpikePage.tsx`

- [ ] **Step 1: Swap imports**

  Remove:
  ```ts
  import { GenerateView } from '../components/GeneratePostView'
  import type { GenerateSource } from '../components/GeneratePostView'
  ```

  Add:
  ```ts
  import { ArticleGenerateView } from '../components/ArticleGenerateView'
  ```

- [ ] **Step 2: Remove `generateSource`**

  Delete this block (around lines 197–204):
  ```ts
  const generateSource: GenerateSource | null = selectedTrending
    ? {
        articleUrl: selectedTrending.url,
        brand: selectedTrending.brand,
        articleTitle: selectedTrending.title,
        backLabel: 'Back to trending',
      }
    : null
  ```

- [ ] **Step 3: Replace the generate view render**

  Find:
  ```tsx
  {/* Generate view */}
  {view === 'generate' && generateSource && (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-10">
      <div className="max-w-5xl mx-auto">
        <GenerateView source={generateSource} onBack={handleBackToList} />
      </div>
    </div>
  )}
  ```

  Replace with:
  ```tsx
  {/* Generate view */}
  {view === 'generate' && selectedTrending && (
    <ArticleGenerateView
      article={{
        url: selectedTrending.url,
        title: selectedTrending.title ?? '',
        sourceBrand: selectedTrending.brand,
        publishedAt: selectedTrending.publishedAt ?? '',
      }}
      brand={selectedTrending.brand}
      autoGenerate={true}
      backLabel="Back to trending"
      onBack={handleBackToList}
    />
  )}
  ```

  Note: The wrapping `div` is removed — `ArticleGenerateView` handles its own padding/scroll.

- [ ] **Step 4: Verify TypeScript**

  Run: `npx tsc --noEmit 2>&1 | head -30`

  Expected: No errors.

- [ ] **Step 5: Manual smoke test**

  - Open Trending tab → click any article → generation starts immediately (no brand selector, no mode pickers shown)
  - Back button shows "Back to trending"
  - After generation: left panel has title + caption + Schedule on FB; right panel has image + Adjust Image + Upload Custom Image | Download

---

## Task 5: Rename "Adjust crop" → "Adjust Image" in `GeneratePostView.tsx`

**Files:**
- Modify: `src/components/GeneratePostView.tsx:438`

- [ ] **Step 1: Update the label**

  Find (line ~438):
  ```tsx
  {cropLoading ? 'Adjusting crop...' : 'Adjust crop'}
  ```

  Replace with:
  ```tsx
  {cropLoading ? 'Adjusting...' : 'Adjust Image'}
  ```

- [ ] **Step 2: Verify**

  Open the article-to-fb page in the browser, generate a post, confirm the button now reads "Adjust Image" (not "Adjust crop").

---

## Self-Review Checklist

**Spec coverage:**
- [x] Task 1 — competitor fallback image (`Competitor Output` node)
- [x] Task 2 — `ArticleGenerateView` shared component with correct layout
- [x] Task 3 — LatestNewsTab: card-click → auto-generate, bulk mode retained
- [x] Task 4 — TrendingSpikePage: uses `ArticleGenerateView`, auto-generate
- [x] Task 5 — "Adjust crop" → "Adjust Image" in GeneratePostView

**What is NOT changed (confirmed):**
- Bulk generation flow in LatestNewsTab — unchanged
- Trending fetch logic, brand sidebar — unchanged
- Latest News sidebar (brand filter) — unchanged
- ArticleGeneratorPage, InputForm, PreviewPanel — unchanged
