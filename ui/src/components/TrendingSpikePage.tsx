import { useState, useCallback, useEffect } from 'react'
import { toast } from '../hooks/useToast'
import { updateTitleInImageUrl } from '../utils/cloudinary'
import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
import { BRANDS, detectBrandFromUrl } from '../constants/brands'
import type { TitleMode, CaptionTitleMode } from '../types'
import { ProgressSteps } from './ProgressSteps'
import { Spinner } from './ds/Spinner'
import { GuideModal } from './ds/GuideModal'
import ImageUploadModal from './ImageUploadModal'
import { IconUpload } from '@tabler/icons-react'
import { FBCredentialsModal } from './FBCredentialsModal'
import { getCredentials, saveCredentials, clearCredentials, type FBCredentials } from '../utils/fbCredentials'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpikeInboxItem {
  id: string
  articleUrl: string
  brand: string
  articleTitle: string
  concurrents: string
  receivedAt: string
}

interface TrendingItem {
  id: string
  url: string
  source: string
  brand: string
  category: string
  type: string
  status: 'idle' | 'generating' | 'done' | 'error'
  imageUrl?: string
  title?: string
  caption?: string
  errorMessage?: string
  publishedAt?: string
}

interface GeneratedPost {
  imageUrl: string
  caption: string
  title: string
  originalTitle: string
  brand: string
  category?: string
  subtitle?: string
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function callWebhook(body: Record<string, unknown>) {
  const webhookUrl = (import.meta.env.VITE_TRENDING_SPIKE_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('VITE_TRENDING_SPIKE_WEBHOOK_URL is not configured.')
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

// ─── Generate webhook helper ───────────────────────────────────────────────

async function callGenerateWebhook(body: Record<string, unknown>) {
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

// ─── Brand name formatter ─────────────────────────────────────────────────────

const ALL_CAPS_BRANDS = new Set(['xuan'])

function formatBrandName(brand: string): string {
  return brand.split(' ').map(word =>
    ALL_CAPS_BRANDS.has(word.toLowerCase())
      ? word.toUpperCase()
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

// ─── Caching utilities ─────────────────────────────────────────────────────────

const TRENDING_CACHE_KEY = 'trending_spike_cache'
const REFRESH_HOUR = 10

function isCacheValid(lastFetchTime: number): boolean {
  const now = new Date()
  const lastFetch = new Date(lastFetchTime)
  const today = now.toDateString()
  const lastFetchDate = lastFetch.toDateString()

  // Cache is valid if:
  // 1. It's the same calendar day AND
  // 2. Either we haven't reached 10am yet (use yesterday's data),
  //    OR we have reached 10am and the cache was fetched after 10am today
  if (today === lastFetchDate) {
    const nowHour = now.getHours()
    const lastFetchHour = lastFetch.getHours()

    if (nowHour < REFRESH_HOUR) {
      // Before 10am - cache valid if it was fetched today (any time)
      return true
    } else {
      // After 10am - cache valid only if it was fetched after 10am today
      return lastFetchHour >= REFRESH_HOUR
    }
  }

  return false
}

function getCachedTrendingData(): { items: TrendingItem[]; timestamp: number } | null {
  try {
    const cached = localStorage.getItem(TRENDING_CACHE_KEY)
    if (!cached) return null

    const { items, timestamp } = JSON.parse(cached)
    return isCacheValid(timestamp) ? { items, timestamp } : null
  } catch {
    return null
  }
}

function setCacheTrendingData(items: TrendingItem[]) {
  try {
    localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({
      items,
      timestamp: Date.now(),
    }))
  } catch (err) {
    console.error('Failed to cache trending data:', err)
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ImageThumb({ url, alt, aspectRatio = 'square' }: { url?: string; alt: string; aspectRatio?: 'square' | 'video' }) {
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


async function encodeImage(file: File): Promise<string> {
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

// ─── Schedule Time Modal ─────────────────────────────────────────────────────

function ScheduleTimeModal({
  brand,
  isPosting,
  onConfirm,
  onClose,
}: {
  brand: string
  isPosting: boolean
  onConfirm: (scheduledFor: string) => void
  onClose: () => void
}) {
  const [scheduledFor, setScheduledFor] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-950">Schedule on FB</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-neutral-500">Posting for <span className="font-medium text-neutral-800">{brand}</span></p>
        <input
          type="datetime-local"
          value={scheduledFor}
          onChange={e => setScheduledFor(e.target.value)}
          min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-700"
        />
        <button
          onClick={() => {
            if (!scheduledFor) {
              toast.error('Please pick a date and time.')
              return
            }
            onConfirm(new Date(scheduledFor).toISOString())
          }}
          disabled={isPosting || !scheduledFor}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isPosting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Scheduling…
            </span>
          ) : 'Schedule'}
        </button>
      </div>
    </div>
  )
}

// ─── Generate View ────────────────────────────────────────────────────────────

interface GenerateSource {
  articleUrl: string
  brand: string
  articleTitle?: string
  backLabel: string
}

interface GenerateViewProps {
  source: GenerateSource
  onBack: () => void
}

function GenerateView({ source, onBack }: GenerateViewProps) {
  // Check if URL domain matches the source brand
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
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [draftState, setDraftState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showCredModal, setShowCredModal] = useState(false)
  const [pendingSchedule, setPendingSchedule] = useState(false)
  const [pendingScheduleFor, setPendingScheduleFor] = useState<string | undefined>(undefined)

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

  // Reset uploaded image when new result is generated
  useEffect(() => {
    setUploadedPublicId(null)
  }, [result?.imageUrl])

  // Derive preview URL reactively (like ResultPreview does)
  const baseImageUrl = uploadedPublicId
    ? buildCloudinaryUrl(uploadedPublicId, localTitle || result?.title || '', result?.imageUrl || '')
    : result?.imageUrl

  const previewImageUrl = baseImageUrl
    ? updateTitleInImageUrl(baseImageUrl, result?.title || '', localTitle)
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

  async function handlePostDraftClick(creds?: FBCredentials, scheduleFor?: string) {
    const brand = result?.brand.toLowerCase() ?? ''
    const resolvedCreds = creds ?? getCredentials(brand)
    if (!resolvedCreds) {
      setPendingSchedule(true)
      setPendingScheduleFor(scheduleFor)
      setShowCredModal(true)
      return
    }
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl || !result) {
      toast.error('Draft posting is not available right now.')
      setDraftState('error')
      return
    }
    setDraftState('posting')
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url: result.imageUrl,
          fb_ai_caption: caption,
          brand: result.brand.toLowerCase(),
          ...(scheduleFor ? { scheduled_for: scheduleFor } : {}),
          passcode: resolvedCreds.passcode,
        }),
      })
      const data = await res.json() as { success?: boolean; status?: string; message?: string; post_id?: string }
      if (data.status === 'AUTH_ERROR') {
        clearCredentials(brand)
        setPendingSchedule(true)
        setShowCredModal(true)
        setDraftState('idle')
        return
      }
      if (data.status === 'BRAND_ERROR') {
        setDraftState('error')
        toast.error(data.message ?? 'Brand not permitted.')
        return
      }
      if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
        saveCredentials(brand, resolvedCreds.passcode)
        setDraftState('done')
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

  function onCredentialsSaved(creds: FBCredentials) {
    setShowCredModal(false)
    if (pendingSchedule) {
      const sf = pendingScheduleFor
      setPendingSchedule(false)
      setPendingScheduleFor(undefined)
      void handlePostDraftClick(creds, sf)
    }
  }

  return (
    <div className="space-y-6">
      {showCredModal && (
        <FBCredentialsModal
          brand={result?.brand ?? ''}
          onSave={onCredentialsSaved}
          onClose={() => { setShowCredModal(false); setPendingSchedule(false) }}
        />
      )}
      {showScheduleModal && (
        <ScheduleTimeModal
          brand={result?.brand ?? ''}
          isPosting={draftState === 'posting'}
          onConfirm={(sf) => { setShowScheduleModal(false); void handlePostDraftClick(undefined, sf) }}
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
                // If manually selected brand doesn't match URL domain, pre-select AI; otherwise Original
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
              {/* Image with modal */}
              {showImageUploadModal && (
                <ImageUploadModal
                  onSelect={({ publicId }) => {
                    setUploadedPublicId(publicId)
                    setShowImageUploadModal(false)
                  }}
                  onClose={() => setShowImageUploadModal(false)}
                />
              )}

              {/* Image */}
              <div className="relative bg-neutral-50 aspect-[4/5] rounded-xl overflow-hidden border border-gray-200 w-full">
                <img src={previewImageUrl ?? result.imageUrl} alt={result.title} className="w-full h-full object-cover" />
              </div>

              {/* Buttons */}
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

              {/* Fields */}
              <div className="space-y-4">

                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Title</label>
                    <span className="text-xs text-gray-400">{localTitle.length}</span>
                  </div>
                  <input
                    type="text"
                    value={localTitle}
                    onChange={e => {
                      const v = e.target.value
                      setLocalTitle(v)
                    }}
                    placeholder="Enter title..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                  />
                </div>

                {/* Caption */}
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

                {/* Schedule on FB */}
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
                    <p className="text-xs text-green-600 text-center mt-1">✓ Scheduled on Facebook</p>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrendingSpikePage() {
  const [activeTab, setActiveTab] = useState<'spike' | 'trending'>('trending')

  useEffect(() => {}, [])

  // Spike tab state
  const [spikeView, setSpikeView] = useState<'list' | 'generate'>('list')
  const [selectedSpike, setSelectedSpike] = useState<SpikeInboxItem | null>(null)
  const [spikeInbox, setSpikeInbox] = useState<SpikeInboxItem[]>([])
  const [isLoadingInbox, setIsLoadingInbox] = useState(false)

  const [hasUnreadSpikes, setHasUnreadSpikes] = useState(false)

  // Trending tab state
  const [trendingView, setTrendingView] = useState<'list' | 'generate'>('list')
  const [selectedTrending, setSelectedTrending] = useState<TrendingItem | null>(null)
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([])
  const [isFetchingTrending, setIsFetchingTrending] = useState(false)
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())

  // ── Spike inbox: load ─────────────────────────────────────────────────────
  const handleLoadInbox = useCallback(async () => {
    setIsLoadingInbox(true)
    try {
      const data = await callWebhook({ type: 'get-spike-inbox' })
      if (data.success && Array.isArray(data.spikes)) {
        setSpikeInbox(data.spikes.map((s: SpikeInboxItem & { id?: string }) => ({
          id: s.id || crypto.randomUUID(),
          articleUrl: s.articleUrl || '',
          brand: s.brand || '',
          articleTitle: s.articleTitle || '',
          concurrents: s.concurrents || '',
          receivedAt: s.receivedAt || '',
        })))
        // Set unread indicator if spikes loaded and we're not on spike tab
        if (data.spikes.length > 0 && activeTab !== 'spike') {
          setHasUnreadSpikes(true)
        }
      } else {
        toast.error(data.message || 'Failed to load spike inbox.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setIsLoadingInbox(false)
    }
  }, [activeTab])

  // Fetch trending articles once on page mount
  useEffect(() => {
    handleFetchTrending()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load inbox when spike tab is active
  useEffect(() => {
    if (activeTab === 'spike' && spikeView === 'list' && spikeInbox.length === 0 && !isLoadingInbox) {
      handleLoadInbox()
    }
  }, [activeTab, spikeView]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGeneratePost(spike: SpikeInboxItem) {
    // Pre-fill brand from URL if not set
    const detectedBrand = spike.brand || detectBrandFromUrl(spike.articleUrl) || ''
    setSelectedSpike({ ...spike, brand: detectedBrand })
    setSpikeView('generate')
  }

  function handleBackToList() {
    setSpikeView('list')
    setSelectedSpike(null)
  }

  function handleTrendingGeneratePost(item: TrendingItem) {
    setSelectedTrending(item)
    setTrendingView('generate')
  }

  function handleBackToTrendingList() {
    setTrendingView('list')
    setSelectedTrending(null)
  }

  // ── Trending: fetch with cache ──────────────────────────────────────────────
  const handleFetchTrending = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless forced)
    if (!forceRefresh) {
      const cached = getCachedTrendingData()
      if (cached) {
        setTrendingItems(cached.items)
        return
      }
    }

    setIsFetchingTrending(true)
    try {
      const data = await callWebhook({ type: 'fetch-trending' })
      if (data.success && Array.isArray(data.articles)) {
        const items = data.articles.map((a: { url: string; source: string; brand?: string; category: string; type: string; title?: string; image?: string; caption?: string; publishedAt?: string }) => ({
          id: crypto.randomUUID(),
          url: a.url,
          source: a.source || a.category || 'Unknown',
          brand: a.brand || a.source || '',
          category: a.category || '',
          type: a.type || '',
          title: a.title || '',
          imageUrl: (a.image && !a.image.includes('sponsor-logos')) ? a.image : '',
          caption: a.caption || '',
          publishedAt: a.publishedAt || '',
          status: 'idle' as const,
        }))
        setTrendingItems(items)
        setCacheTrendingData(items)
      } else {
        toast.error('Failed to fetch trending articles.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setIsFetchingTrending(false)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-28">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Trending Spike to FB Post</h1>
              <p className="text-neutral-500 mt-1 text-sm">Generate Facebook images &amp; captions from spike or trending articles</p>
            </div>
            <GuideModal title="How to use Trending Spike to FB Post">
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden bg-neutral-100 aspect-video">
                  <iframe
                    src="https://drive.google.com/file/d/1nExBvjJeMHR0cCkyYrIl3r2LAo4zIUzA/preview"
                    className="w-full h-full"
                    allow="autoplay"
                    title="Trending News to FB Photo walkthrough video"
                  />
                </div>
                <ol className="space-y-3 list-decimal list-inside text-sm text-neutral-700">
                  <li><strong>Select an article</strong> — Pick one article you want to create a Facebook post for.</li>
                  <li><strong>Select a brand</strong> — Choose the brand the post is for.</li>
                  <li><strong>Choose Image Title mode</strong> — Choose whether to use the original article headline, an AI-rewritten title, or a custom title on the image.</li>
                  <li><strong>Choose Caption Title mode</strong> — Choose whether the caption uses the original article headline or an AI-rewritten version.</li>
                  <li><strong>Click 'Generate Facebook Post Asset'</strong> — The system will generate the image and caption, which will appear on the right.</li>
                  <li><strong>Download &amp; copy</strong> — Download the image and copy the caption.</li>
                </ol>
                <div className="mt-4 p-3 bg-neutral-100 border border-neutral-300 rounded-lg">
                  <p className="text-xs font-semibold text-neutral-800 mb-1">💡 Tip</p>
                  <p className="text-xs text-neutral-700">Use the Trending tab for articles from other monitoring sources. Use the Spike tab for real-time Chartbeat alerts.</p>
                </div>
              </div>
            </GuideModal>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Tabs — hide when in generate view */}
        {spikeView === 'list' && trendingView === 'list' && (
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
              {(['trending', 'spike'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); if (tab === 'spike') setHasUnreadSpikes(false) }}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-white text-neutral-950 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {tab === 'trending' ? (
                    '📈 Trending News'
                  ) : (
                    <span className="flex items-center gap-1.5">
                      ⚡ Spike News
                      {hasUnreadSpikes && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {activeTab === 'trending' && (
              <button
                onClick={() => handleFetchTrending(true)}
                disabled={isFetchingTrending}
                className="p-2 bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Refresh trending articles"
              >
                <svg className={`w-4 h-4 ${isFetchingTrending ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* ── SPIKE TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'spike' && spikeView === 'generate' && selectedSpike && (
          <GenerateView
            source={{
              articleUrl: selectedSpike.articleUrl,
              brand: selectedSpike.brand,
              articleTitle: selectedSpike.articleTitle,
              backLabel: 'Back to spike list',
            }}
            onBack={handleBackToList}
          />
        )}

        {activeTab === 'spike' && spikeView === 'list' && (
          <div className="space-y-6">
            {/* Header bar */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-700">Chartbeat Spike Alerts</h2>
                  <p className="text-xs text-neutral-400 mt-1">Articles currently experiencing a traffic spike — act fast and turn them into FB posts while they're trending.</p>
                </div>
                <button
                  onClick={handleLoadInbox}
                  disabled={isLoadingInbox}
                  className="px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-xl text-sm font-semibold transition whitespace-nowrap active:scale-[0.97]"
                >
                  {isLoadingInbox ? (
                    <span className="flex items-center gap-2"><Spinner size="sm" /> Loading…</span>
                  ) : '↻ Refresh'}
                </button>
              </div>
            </div>

            {/* Loading skeleton */}
            {isLoadingInbox && spikeInbox.length === 0 && (
              <div className="glass-card rounded-2xl p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 skeleton-shimmer rounded w-1/4" />
                      <div className="h-3 skeleton-shimmer rounded w-3/4" />
                      <div className="h-3 skeleton-shimmer rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Inbox table */}
            {spikeInbox.length > 0 && (
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-100">
                  <h2 className="text-sm font-semibold text-neutral-700">{spikeInbox.length} spike{spikeInbox.length > 1 ? 's' : ''} in inbox</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                        <th className="px-6 py-3 whitespace-nowrap">Received</th>
                        <th className="px-4 py-3">Article</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3 whitespace-nowrap">Concurrent viewers</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {spikeInbox.map(item => (
                        <tr key={item.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                          <td className="px-6 py-4 text-neutral-400 text-xs whitespace-nowrap">
                            {item.receivedAt
                              ? new Date(item.receivedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                          <td className="px-4 py-4 max-w-[280px]">
                            {item.articleTitle ? (
                              <a href={item.articleUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-800 hover:text-neutral-500 font-medium line-clamp-2 leading-snug transition block">
                                {item.articleTitle}
                              </a>
                            ) : (
                              <a href={item.articleUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600 text-xs line-clamp-2 break-all transition">
                                {item.articleUrl}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {item.brand ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-medium whitespace-nowrap">
                                {item.brand}
                              </span>
                            ) : (
                              <span className="text-neutral-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-neutral-600 text-sm font-medium">
                            {item.concurrents || '—'}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleGeneratePost(item)}
                              className="px-3.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition active:scale-[0.97] whitespace-nowrap"
                            >
                              Generate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state */}
            {spikeInbox.length === 0 && !isLoadingInbox && (
              <div className="glass-card rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-600">No spike articles yet</p>
                <p className="text-xs text-neutral-400 mt-1">No spike alerts at the moment — check back when articles are trending</p>
              </div>
            )}
          </div>
        )}

        {/* ── TRENDING TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'trending' && trendingView === 'generate' && selectedTrending && (
          <GenerateView
            source={{
              articleUrl: selectedTrending.url,
              brand: selectedTrending.brand,
              articleTitle: selectedTrending.title,
              backLabel: 'Back to trending',
            }}
            onBack={handleBackToTrendingList}
          />
        )}

        {activeTab === 'trending' && trendingView === 'list' && (
          <div className="space-y-6">
            {/* Info banner */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">Refreshes daily at 10AM</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Trending stories are automatically pulled from all Astro brands every morning — come back daily for fresh content.</p>
                </div>
              </div>
            </div>

            {/* Brand filter */}
            {trendingItems.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Brand chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1">
                    {Array.from(new Set(trendingItems.map(i => i.brand).filter(Boolean))).sort().map(brand => {
                      const active = selectedSources.has(brand)
                      return (
                        <button
                          key={brand}
                          onClick={() => setSelectedSources(prev => {
                            const next = new Set(prev)
                            active ? next.delete(brand) : next.add(brand)
                            return next
                          })}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${
                            active
                              ? 'bg-white text-neutral-950 shadow-sm'
                              : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                        >
                          {formatBrandName(brand)}
                        </button>
                      )
                    })}
                  </div>
                  {selectedSources.size > 0 && (
                    <button onClick={() => setSelectedSources(new Set())} className="text-xs text-neutral-400 hover:text-neutral-600 transition px-1">
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Skeleton while fetching */}
            {isFetchingTrending && trendingItems.length === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="glass-card rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/40">
                      <div className="h-3 skeleton-shimmer rounded w-20" />
                    </div>
                    <div className="p-3 space-y-3">
                      {[1, 2, 3, 4, 5].map(j => (
                        <div key={j} className="flex gap-2.5">
                          <div className="w-16 h-16 rounded-lg skeleton-shimmer shrink-0" />
                          <div className="flex-1 space-y-1.5 py-1">
                            <div className="h-2.5 skeleton-shimmer rounded w-full" />
                            <div className="h-2.5 skeleton-shimmer rounded w-3/4" />
                            <div className="h-2.5 skeleton-shimmer rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Trending articles — 3-column layout */}
            {trendingItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {(['News', 'Sport', 'Entertainment'] as const).map(type => {
                  let items = trendingItems.filter(i => {
                    if (i.type.toLowerCase() !== type.toLowerCase()) return false
                    if (selectedSources.size > 0 && !selectedSources.has(i.brand)) return false
                    return true
                  })
                  if (type === 'Entertainment') {
                    const entertainmentOrder = ['Gempak', 'Rojak Daily', 'XUAN', 'Astro Ulagam']
                    items = [...items].sort((a, b) => {
                      const ai = entertainmentOrder.findIndex(s => s.toLowerCase() === a.source.toLowerCase())
                      const bi = entertainmentOrder.findIndex(s => s.toLowerCase() === b.source.toLowerCase())
                      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
                    })
                  }
                  // Sort newest first within each column
                  items = [...items].sort((a, b) => {
                    const ta = a.publishedAt ?? ''
                    const tb = b.publishedAt ?? ''
                    return tb.localeCompare(ta)
                  })
                  if (items.length === 0) return null
                  const emoji = type === 'News' ? '📰' : type === 'Sport' ? '⚽' : '🎬'
                  return (
                    <div key={type} className="glass-card rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-neutral-700">{emoji} {type}</h2>
                        <span className="text-xs text-neutral-400">{items.length}</span>
                      </div>
                      <div className="divide-y divide-neutral-50">
                        {items.map(item => (
                          <div key={item.id} className="p-3 hover:bg-neutral-50/50 transition-colors">
                            <div className="flex gap-2.5">
                              <div className="w-24 shrink-0">
                                <ImageThumb url={item.imageUrl} alt={item.title || item.url} aspectRatio="video" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-1">
                                  <span className="text-neutral-800 font-medium text-xs line-clamp-2 leading-snug flex-1">
                                    {item.title || item.url}
                                  </span>
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 text-neutral-300 hover:text-neutral-600 transition mt-0.5"
                                    title="Open article"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                </div>
                                <div className="flex items-center justify-between mt-1.5 gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[10px] text-neutral-400 font-medium capitalize block truncate">{item.source}</span>
                                    {item.publishedAt && (
                                      <span className="text-[10px] text-neutral-300 block truncate">{item.publishedAt}</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleTrendingGeneratePost(item)}
                                    className="shrink-0 px-2.5 py-1 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-[10px] font-semibold transition active:scale-[0.97]"
                                  >
                                    Generate
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Empty state */}
            {trendingItems.length === 0 && !isFetchingTrending && (
              <div className="glass-card rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-600">No articles yet</p>
                <p className="text-xs text-neutral-400 mt-1">No trending articles found. Try refreshing the page.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
