import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronLeft, IconExternalLink, IconCopy, IconCheck, IconDownload, IconUpload } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'
import { trackButtonClick, trackToolSubmit } from '../utils/analytics'
import { COMPETITOR_BRANDS } from '../constants/rssFeedsByBrand'
import { updateTitleInImageUrl, uploadToCloudinary, uploadedImageUrl } from '../utils/imageProvider'
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
  const autoGenerateFired = useRef(false)

  const [editableTitle, setEditableTitle] = useState('')
  const [committedTitle, setCommittedTitle] = useState('')

  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [caption, setCaption] = useState('')
  const [copied, setCopied] = useState(false)

  const [scheduleState, setScheduleState] = useState<ScheduleState>('idle')
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  const [showCropPicker, setShowCropPicker] = useState(false)
  const [adjustedImageUrl, setAdjustedImageUrl] = useState<string | null>(null)
  const [adjustedAtTitle, setAdjustedAtTitle] = useState<string>('')
  const [cropLoading, setCropLoading] = useState(false)

  useEffect(() => { setUploadedPublicId(null); setAdjustedImageUrl(null); setAdjustedAtTitle('') }, [generated?.imageUrl])

  const baseImageUrl = uploadedPublicId
    ? buildCloudinaryUrl(uploadedPublicId, committedTitle || generated?.title || '', generated?.imageUrl || '')
    : generated?.imageUrl ?? null

  const previewImageUrl = baseImageUrl
    ? updateTitleInImageUrl(baseImageUrl, generated?.title ?? '', committedTitle)
    : null

  const displayImageUrl = adjustedImageUrl
    ? updateTitleInImageUrl(adjustedImageUrl, adjustedAtTitle || (generated?.title ?? ''), committedTitle)
    : previewImageUrl

  const cropSourceUrl = uploadedPublicId
    ? uploadedImageUrl(uploadedPublicId)
    : generated?.cloudinary_url || previewImageUrl || null

  const handleGenerate = async () => {
    const [, brandSlug, ...toolParts] = window.location.pathname.split('/')
    trackToolSubmit(toolParts.join('/') || 'unknown', brandSlug ?? 'unknown')
    setGenerateState('generating')
    try {
      const result = await generatePost(article.url, brand, titleMode, undefined, isCompetitor)
      const titleToUse = result.title || article.title
      setGenerated({ ...result, title: titleToUse })
      setCaption(result.caption)
      setEditableTitle(titleToUse)
      setCommittedTitle(titleToUse)
      setGenerateState('done')
    } catch (err) {
      setGenerateState('error')
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (autoGenerate && !autoGenerateFired.current) { autoGenerateFired.current = true; void handleGenerate() } }, [])

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      trackButtonClick('caption_copied')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleCropDone = async (cropRegion: { x: number; y: number; width: number; height: number }) => {
    if (!previewImageUrl) return
    setCropLoading(true)
    try {
      const newUrl = await applyFocalCrop(previewImageUrl, cropRegion)
      setAdjustedImageUrl(newUrl)
      setAdjustedAtTitle(committedTitle)
      setShowCropPicker(false)
      toast.success('Crop adjusted!')
    } catch {
      toast.error('Failed to adjust crop')
    } finally {
      setCropLoading(false)
    }
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLoading(true)
    try {
      const publicId = await uploadToCloudinary(file)
      setUploadedPublicId(publicId)
      setAdjustedImageUrl(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadLoading(false)
      e.target.value = ''
    }
  }

  const handleDownload = async () => {
    const url = displayImageUrl
    if (!url) return
    trackButtonClick('download_image')
    const filename = `${brand.toLowerCase().replace(/\s+/g, '-')}-post.jpg`
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
    }
  }

  const handleSchedule = async (scheduledFor: string, passcode: string) => {
    if (!generated || !previewImageUrl) return
    setScheduleState('posting')
    const finalPasscode = passcode || getCredentials(brand.toLowerCase())?.passcode || ''
    // Re-derive the URL from editableTitle (latest typed value, even if user hasn't blurred)
    const latestBaseUrl = uploadedPublicId
      ? buildCloudinaryUrl(uploadedPublicId, generated.title || '', generated.imageUrl || '')
      : generated.imageUrl || ''
    const latestImageUrl = adjustedImageUrl
      ? updateTitleInImageUrl(adjustedImageUrl, adjustedAtTitle || generated.title || '', editableTitle)
      : updateTitleInImageUrl(latestBaseUrl, generated.title || '', editableTitle)
    const response = await callScheduleWebhook(latestImageUrl || displayImageUrl || previewImageUrl, caption, brand, scheduledFor, finalPasscode)
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
                <img src={displayImageUrl ?? undefined} alt="Generated post" className="w-full h-auto block" />
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
                {/* Adjust Image — full width, only when image is available */}
                {previewImageUrl && (
                  <button
                    onClick={() => { setShowCropPicker(true); trackButtonClick('adjust_image'); }}
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
                  <button
                    onClick={() => { fileInputRef.current?.click(); trackButtonClick('upload_custom_image'); }}
                    disabled={uploadLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <IconUpload className="w-4 h-4" />
                    {uploadLoading ? 'Uploading…' : 'Upload Custom Image'}
                  </button>
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
      {showCropPicker && cropSourceUrl && previewImageUrl && createPortal(
        <FabricCropPicker
          sourceImageUrl={cropSourceUrl}
          aspectRatio={1080 / 1350}
          onDone={handleCropDone}
          onCancel={() => setShowCropPicker(false)}
        />,
        document.body
      )}
    </div>
  )
}
