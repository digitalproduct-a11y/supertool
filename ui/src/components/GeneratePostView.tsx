import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from '../hooks/useToast'
import { updateTitleInImageUrl } from '../utils/cloudinary'
import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
import { BRANDS, detectBrandFromUrl } from '../constants/brands'
import type { TitleMode, CaptionTitleMode } from '../types'
import { ProgressSteps } from './ProgressSteps'
import ImageUploadModal from './ImageUploadModal'
import { IconUpload } from '@tabler/icons-react'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'

// ─── API helper ───────────────────────────────────────────────────────────────

export async function callGenerateWebhook(body: Record<string, unknown>) {
  const webhookUrl = (import.meta.env.VITE_GENERATE_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('VITE_GENERATE_WEBHOOK_URL is not configured.')
  try { new URL(webhookUrl) } catch { throw new Error(`Invalid webhook URL: "${webhookUrl}"`) }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!text.trim()) throw new Error('Workflow returned an empty response.')
    return JSON.parse(text)
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedPost {
  imageUrl: string
  caption: string
  title: string
  originalTitle: string
  brand: string
  category?: string
  subtitle?: string
}

export interface GenerateSource {
  articleUrl: string
  brand: string
  articleTitle?: string
  backLabel: string
}

export interface GenerateViewProps {
  source: GenerateSource
  onBack: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function encodeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1200
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = objectUrl
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function ImageThumb({ url, alt, aspectRatio = 'square' }: { url?: string; alt: string; aspectRatio?: 'square' | 'video' }) {
  const [imgError, setImgError] = useState(false)
  const containerClass = aspectRatio === 'video'
    ? 'w-full aspect-video rounded-lg bg-neutral-100 flex items-center justify-center overflow-hidden'
    : 'w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0'
  const placeholder = (
    <div className={containerClass}>
      <svg className="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  )
  if (!url || imgError) return placeholder
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={aspectRatio === 'video' ? 'block w-full' : 'shrink-0'}>
      <img
        src={url}
        alt={alt}
        referrerPolicy="no-referrer"
        className={aspectRatio === 'video'
          ? 'w-full aspect-video object-cover rounded-lg border border-neutral-100 hover:opacity-90 transition'
          : 'w-16 h-16 rounded-lg object-cover border border-neutral-100 hover:opacity-90 transition'
        }
        onError={() => setImgError(true)}
      />
    </a>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy} title="Copy caption" className="shrink-0 text-neutral-400 hover:text-neutral-700 transition">
      {copied
        ? <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      }
    </button>
  )
}

// ─── Generate View ────────────────────────────────────────────────────────────

export function GenerateView({ source, onBack }: GenerateViewProps) {
  const detectedBrand = detectBrandFromUrl(source.articleUrl)
  const isBrandMismatch = !!detectedBrand && source.brand && detectedBrand !== source.brand

  const [brand, setBrand] = useState(source.brand || '')
  const [titleMode, setTitleMode] = useState<TitleMode>(isBrandMismatch ? 'ai' : 'original')
  const [captionTitleMode, setCaptionTitleMode] = useState<CaptionTitleMode>(isBrandMismatch ? 'ai' : 'original')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GeneratedPost | null>(null)
  const [customImage, setCustomImage] = useState<File | null>(null)
  const [localTitle, setLocalTitle] = useState('')
  const [committedLocalTitle, setCommittedLocalTitle] = useState('')
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [draftState, setDraftState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (!brand) return
    setIsGenerating(true)
    setError('')

    try {
      const customImageBase64 = customImage ? await encodeImage(customImage) : undefined
      const data = await callGenerateWebhook({
        url: source.articleUrl,
        brand,
        title_mode: titleMode,
        caption_title_mode: captionTitleMode,
        custom_image: customImageBase64,
      })
      if (data.success) {
        setResult({ imageUrl: data.imageUrl, caption: data.caption, title: data.title, originalTitle: data.originalTitle, brand: data.brand, category: data.category })
        setCaption(data.caption ?? '')
        setLocalTitle(data.title ?? '')
        setCommittedLocalTitle(data.title ?? '')
        setCustomImage(null)
      } else {
        setError(data.message || 'Generation failed.')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Request failed.'
      setError(errorMsg)
    } finally {
      setIsGenerating(false)
    }
  }, [source.articleUrl, brand, titleMode, captionTitleMode, customImage])

  useEffect(() => {
    setUploadedPublicId(null)
  }, [result?.imageUrl])

  const baseImageUrl = uploadedPublicId
    ? buildCloudinaryUrl(uploadedPublicId, committedLocalTitle || result?.title || '', result?.imageUrl || '')
    : result?.imageUrl

  const previewImageUrl = baseImageUrl
    ? updateTitleInImageUrl(baseImageUrl, result?.title || '', committedLocalTitle)
    : undefined

  async function handleDownload() {
    if (!result?.imageUrl) return
    const urlToDownload = previewImageUrl ?? result.imageUrl
    try {
      const res = await fetch(urlToDownload)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${result.brand}-${Date.now()}.jpg`
      a.click()
    } catch { /* ignore */ }
  }

  async function handlePostDraftClick(scheduledFor: string, passcode: string) {
    const brandLower = result?.brand.toLowerCase() ?? ''
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl || !result) {
      toast.error('Draft posting is not available right now.')
      setDraftState('error')
      return
    }
    setDraftState('posting')
    try {
      const latestBaseUrl = uploadedPublicId
        ? buildCloudinaryUrl(uploadedPublicId, localTitle || result.title || '', result.imageUrl || '')
        : result.imageUrl
      const latestImageUrl = updateTitleInImageUrl(latestBaseUrl, result.title || '', localTitle)
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url: latestImageUrl,
          fb_ai_caption: caption,
          brand: result.brand.toLowerCase(),
          scheduled_for: scheduledFor,
          passcode,
        }),
      })
      const data = await res.json() as { success?: boolean; status?: string; message?: string; post_id?: string }
      if (data.status === 'AUTH_ERROR') {
        clearCredentials(brandLower)
        setDraftState('idle')
        setShowScheduleModal(false)
        toast.error('Invalid passcode. Please try again.')
        return
      }
      if (data.status === 'BRAND_ERROR') {
        setDraftState('error')
        toast.error(data.message ?? 'Brand not permitted.')
        return
      }
      if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
        saveCredentials(brandLower, passcode)
        setDraftState('done')
        setShowScheduleModal(false)
        toast.success('Scheduled on Facebook!')
      } else {
        setDraftState('error')
        toast.error(data.message ?? "Couldn't post. Please try again.")
      }
    } catch {
      setDraftState('error')
      toast.error("Couldn't post. Please try again.")
    }
  }

  return (
    <div className="space-y-6">
      {showScheduleModal && (
        <ScheduleModal
          brand={result?.brand ?? ''}
          hasCredentials={!!getCredentials(result?.brand?.toLowerCase() ?? '')}
          isPosting={draftState === 'posting'}
          onConfirm={(sf, passcode) => void handlePostDraftClick(sf, passcode ?? getCredentials(result?.brand?.toLowerCase() ?? '')?.passcode ?? '')}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
      {/* Back nav */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {source.backLabel}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
        {/* ── Left: form ──────────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-6 space-y-5">
          {/* Article URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Article URL</label>
            <a
              href={source.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 hover:bg-neutral-100 transition break-all"
            >
              {source.articleUrl}
            </a>
          </div>

          {/* Brand */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
            <select
              value={brand}
              onChange={e => {
                const newBrand = e.target.value
                setBrand(newBrand)
                if (detectedBrand && newBrand !== detectedBrand) {
                  setTitleMode('ai')
                  setCaptionTitleMode('ai')
                } else {
                  setTitleMode('original')
                  setCaptionTitleMode('original')
                }
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
            >
              <option value="">Select brand</option>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Title mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Image Title</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {(['original', 'ai'] as TitleMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setTitleMode(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    titleMode === m
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {m === 'original' ? 'Original' : 'AI ✨'}
                </button>
              ))}
            </div>
          </div>

          {/* Caption title mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Caption Title</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {(['original', 'ai'] as CaptionTitleMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setCaptionTitleMode(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    captionTitleMode === m
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {m === 'original' ? 'Original' : 'AI ✨'}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!brand || isGenerating}
            className="w-full py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-xl text-sm font-semibold transition active:scale-[0.98]"
          >
            {isGenerating ? 'Generating…' : result ? 'Generate again' : 'Generate Facebook Post Asset'}
          </button>
        </div>

        {/* ── Right: preview ───────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 p-12 h-full">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2 text-center">Generating your post</h3>
                <p className="text-xs text-gray-400 text-center">This usually takes 30–60 seconds</p>
              </div>
              <ProgressSteps isComplete={false} />
            </div>
          ) : result ? (
            <div className="p-5 space-y-4">
              {showImageUploadModal && (
                <ImageUploadModal
                  onSelect={({ publicId }) => {
                    setUploadedPublicId(publicId)
                    setShowImageUploadModal(false)
                  }}
                  onClose={() => setShowImageUploadModal(false)}
                />
              )}

              <div className="relative bg-neutral-50 aspect-[4/5] rounded-xl overflow-hidden border border-gray-200 w-full">
                <img src={previewImageUrl ?? result.imageUrl} alt={result.title} className="w-full h-full object-cover" />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowImageUploadModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition-colors"
                >
                  <IconUpload size={16} />
                  Upload Custom Image
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Title</label>
                    <span className="text-xs text-gray-400">{localTitle.length}</span>
                  </div>
                  <input
                    type="text"
                    value={localTitle}
                    onChange={e => setLocalTitle(e.target.value)}
                    onBlur={() => setCommittedLocalTitle(localTitle)}
                    placeholder="Enter title..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Caption</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{caption.length}/600</span>
                      <CopyButton text={caption} />
                    </div>
                  </div>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value.slice(0, 600))}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 font-sans leading-relaxed transition"
                  />
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    disabled={draftState === 'posting'}
                    className="w-full py-3 px-4 font-medium rounded-xl transition text-sm bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white"
                  >
                    {draftState === 'posting' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Scheduling…
                      </span>
                    ) : 'Schedule on FB'}
                  </button>
                  {draftState === 'done' && (
                    <div className="text-center space-y-1 mt-1">
                      <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
                      <p className="text-xs text-neutral-400">
                        To view or delete your scheduled post, check{' '}
                        <Link to="/post-queue" className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
                          here
                        </Link>.
                      </p>
                    </div>
                  )}
                  {draftState === 'error' && (
                    <p className="text-xs text-red-500 text-center mt-1">✗ Failed to schedule. Try again.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-neutral-500">Select a brand and click<br />"Generate post" to create the FB post</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
