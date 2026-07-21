import { useState, useCallback, useRef, useEffect } from 'react'
import { trackToolSubmit, trackButtonClick, extractDomain } from '../utils/analytics'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useBlocker, Link } from 'react-router-dom'
import { BackButton } from '../components/ds'
import { useBrand } from '../context/BrandContext'
import { BRANDS, DOMAIN_TO_BRAND, detectBrandFromUrl, getBrandHex, getBrandFontUse, getBrandLanguage, BRAND_LOGO_IDS, type BrandLanguage } from '../constants/brands'
import { toast } from '../hooks/useToast'
import { ScheduleModal } from '../components/ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'
import {
  updateTitleInImageUrl,
  updateFactInImageUrl,
  uploadToCloudinary,
  uploadedImageUrl,
  replaceBaseImage,
  IMAGE_PROVIDER,
} from '../utils/imageProvider'
import { applyFocalCrop } from '../features/photo/cropUtils'
import { FabricCropPicker } from '../features/photo/FabricCropPicker'
import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
import { QuoteCanvas, type QuoteCanvasHandle, type QuoteData } from '../features/quote/QuoteCanvas'
import { ImageCropAdjuster, type CropRegion } from '../features/quote/ImageCropAdjuster'
import { TABLOID_QUOTE_CANVAS_CONFIG } from '../config/quoteCanvasConfig'
import type { QuickFactItem, CarouselResult, CarouselImage, QuickFactData } from '../types'
import { CarouselResultPreview } from '../features/carousel/CarouselResultPreview'
import { QuickFactCarouselView } from '../features/quickfact/QuickFactCarouselView'
import { useBrandNavigate, useBrandPath } from '../hooks/useBrandNavigate'
import { logHistoryEvent } from '../services/historyLog'
import {
  DEFAULT_PHOTO_TEMPLATE,
  getPhotoTemplatesForBrand,
  getDefaultTemplateForBrand,
} from '../config/photoTemplates'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PostType = 'photo' | 'carousel' | 'quickfact' | 'quote'
type TitleMode = 'original' | 'ai'
type CaptionTitleMode = 'original' | 'ai'
type Language = 'malay' | 'english'

export const POST_TYPE_LABELS: Record<PostType, string> = {
  photo: 'Photo Post',
  carousel: 'Carousel Post',
  quickfact: 'Quick Fact Post',
  quote: 'Quote Post',
}
export const ALL_TYPES: PostType[] = ['photo', 'carousel', 'quickfact', 'quote']

interface PhotoConfig    { titleMode: TitleMode; captionTitleMode: CaptionTitleMode; template: string }
interface CarouselConfig { titleMode: TitleMode; captionTitleMode: CaptionTitleMode }
interface QuickFactConfig { template: 'carousel' | 'single' }
interface QuoteConfig   { captionTitleMode: CaptionTitleMode; language: Language }

interface Configs {
  photo: PhotoConfig
  carousel: CarouselConfig
  quickfact: QuickFactConfig
  quote: QuoteConfig
}

export interface ResultCard {
  type: PostType
  status: 'generating' | 'done' | 'error'
  caption: string
  errorMessage?: string
  scheduledFor: string
  imageUrl: string
  photoTitle?: string
  cloudinaryUrl?: string
  carouselImages: string[]
  carouselResult?: CarouselResult
  quickFactTitle?: string
  quickFactFacts?: QuickFactItem[]
  quickFactKeyPhrase?: string
  // Present only for the CMS Quick Fact carousel (workflow uYavn7y5GXBezjkw).
  // When set, the Quick Fact views render the Fabric carousel instead of the
  // legacy single composite image.
  quickFactData?: QuickFactData
  quoteData?: QuoteData
  quotePexelsUrls?: string[]
  quoteFontUse?: string
}

// ── Schedule slots ────────────────────────────────────────────────────────────

function getScheduledSlots(count: number): string[] {
  const base = new Date(Date.now() + 30 * 60 * 1000)
  base.setSeconds(0, 0)
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(base.getTime() + i * 30 * 60 * 1000)
    return t.toISOString().slice(0, 16)
  })
}

// ── Post to Facebook ──────────────────────────────────────────────────────────

interface ScheduleLogMeta {
  toolPostType: string
  articleUrl?: string
  title?: string
  editedFields?: string[]
}

async function postToFacebook(
  imageUrl: string,
  caption: string,
  brand: string,
  scheduledFor: string,
  passcode: string,
  meta: ScheduleLogMeta,
): Promise<{ authError: boolean }> {
  const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('Post webhook not configured')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fb_ai_image_url: imageUrl,
      fb_ai_caption: caption,
      brand: brand.toLowerCase(),
      scheduled_for: scheduledFor,
      passcode,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as { status?: string }
  if (json.status === 'AUTH_ERROR') return { authError: true }
  logHistoryEvent({
    eventType: 'scheduled', brand, toolPostType: meta.toolPostType, sourcePage: 'article_to_social',
    articleUrl: meta.articleUrl, title: meta.title, caption, imageUrl,
    scheduledFor, editedFields: meta.editedFields, status: 'success',
  })
  return { authError: false }
}

async function scheduleCarousel(
  imageUrls: string[], caption: string, brand: string,
  scheduledFor?: string, passcode?: string, meta?: ScheduleLogMeta,
): Promise<{ success: boolean; message: string; status?: string }> {
  const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) return { success: false, message: 'Webhook not configured.' }
  const creds = passcode ? { passcode } : getCredentials(brand.toLowerCase())
  if (!creds) return { success: false, message: 'credentials_required' }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fb_ai_image_url: imageUrls[0],
        carousel_images: imageUrls,
        fb_ai_caption: caption,
        brand: brand.toLowerCase(),
        ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        passcode: creds.passcode,
      }),
    })
    const data = await res.json() as { success?: boolean; status?: string; message?: string }
    if (data.status === 'AUTH_ERROR') return { success: false, message: data.message ?? 'Invalid passcode.', status: 'AUTH_ERROR' }
    if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
      logHistoryEvent({
        eventType: 'scheduled', brand, toolPostType: 'carousel', sourcePage: 'article_to_social',
        articleUrl: meta?.articleUrl, title: meta?.title, caption, imageUrl: imageUrls[0],
        scheduledFor, editedFields: meta?.editedFields, status: 'success',
      })
      return { success: true, message: 'Scheduled!' }
    }
    return { success: false, message: data.message ?? 'Something went wrong.' }
  } catch {
    return { success: false, message: 'Network error. Please try again.' }
  }
}

// ── Webhook callers ───────────────────────────────────────────────────────────

async function generatePhoto(
  url: string, brand: string, cfg: PhotoConfig,
): Promise<{ imageUrl: string; caption: string; photoTitle: string; cloudinaryUrl?: string }> {
  const webhookUrl = (
    (IMAGE_PROVIDER === 'imagekit'
      ? import.meta.env.VITE_GENERATE_WEBHOOK_URL_IMAGEKIT
      : import.meta.env.VITE_GENERATE_WEBHOOK_URL) as string | undefined
  )?.trim()
  if (!webhookUrl) throw new Error('Photo webhook not configured')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        brand,
        title_mode: cfg.titleMode,
        caption_title_mode: cfg.captionTitleMode,
        template: cfg.template,
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    if (!text.trim()) throw new Error('Empty response from server — the photo workflow may have errored or be misconfigured. Check n8n executions.')
    const data = JSON.parse(text) as Record<string, unknown>
    if (data.success === false) throw new Error((data.message as string) ?? 'Generation failed')
    return {
      imageUrl: (data.imageUrl as string) ?? '',
      caption: (data.caption as string) ?? '',
      photoTitle: (data.title as string) ?? '',
      cloudinaryUrl: (data.cloudinary_url as string | undefined),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function generateCarousel(
  url: string, brand: string, cfg: CarouselConfig,
): Promise<{ imageUrl: string; carouselImages: string[]; caption: string; carouselResult: CarouselResult }> {
  const webhookUrl = (
    (IMAGE_PROVIDER === 'imagekit'
      ? import.meta.env.VITE_CAROUSEL_WEBHOOK_URL_IMAGEKIT
      : import.meta.env.VITE_CAROUSEL_WEBHOOK_URL) as string | undefined
  )?.trim()
  if (!webhookUrl) throw new Error('Carousel webhook not configured')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, brand, title_mode: cfg.titleMode, caption_title_mode: cfg.captionTitleMode }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as Record<string, unknown>
    if (data.success === false) throw new Error((data.message as string) ?? 'Generation failed')
    const carouselResult: CarouselResult = {
      success: true,
      title: (data.title as string) ?? '',
      originalTitle: (data.originalTitle as string) ?? '',
      brand,
      caption: (data.caption as string) ?? '',
      images: (data.images as CarouselImage[]) ?? [],
      articleImages: (data.articleImages as string[]) ?? [],
    }
    return {
      imageUrl: carouselResult.images[0]?.src ?? '',
      carouselImages: carouselResult.images.map(img => img.src),
      caption: carouselResult.caption,
      carouselResult,
    }
  } finally {
    clearTimeout(timeout)
  }
}

interface QuickFactResponse {
  imageUrl: string
  caption: string
  quickFactTitle: string
  quickFactFacts: QuickFactItem[]
  quickFactKeyPhrase: string
  cloudinaryUrl?: string
  // Carousel-only extras (present once the URL workflow returns them). heroPublicId
  // is the CORS-safe Cloudinary id for the raw hero; summary/sectionLabel are optional.
  quickFactSummary?: string
  heroPublicId?: string
  heroUrl?: string
  sectionLabel?: string
}

async function generateQuickFact(
  url: string, brand: string,
): Promise<QuickFactResponse> {
  const webhookUrl = (
    (IMAGE_PROVIDER === 'imagekit'
      ? import.meta.env.VITE_QUICK_FACT_WEBHOOK_URL_IMAGEKIT
      : import.meta.env.VITE_QUICK_FACT_WEBHOOK_URL) as string | undefined
  )?.trim()
  if (!webhookUrl) throw new Error('Quick Fact webhook not configured')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, brand }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    if (!text.trim()) throw new Error('Empty response from server')
    const data = JSON.parse(text) as Record<string, unknown>
    if (data.success === false) throw new Error((data.message as string) ?? 'Generation failed')
    return {
      imageUrl: (data.imageUrl as string) ?? '',
      caption: (data.caption as string) ?? '',
      quickFactTitle: (data.title as string) ?? '',
      quickFactFacts: (data.facts as QuickFactItem[]) ?? [],
      quickFactKeyPhrase: (data.keyPhrase as string) ?? '',
      cloudinaryUrl: (data.cloudinary_url as string | undefined),
      quickFactSummary: (data.summary as string | undefined),
      heroPublicId: (data.heroPublicId as string | undefined),
      heroUrl: (data.heroUrl as string | undefined),
      sectionLabel: (data.sectionLabel as string | undefined),
    }
  } finally {
    clearTimeout(timeout)
  }
}

// Cover-chip noun + date locale per brand language, used when the URL workflow
// doesn't supply its own sectionLabel/category (the CMS workflow does).
const QUICK_FACT_LANG_META: Record<BrandLanguage, { category: string; sectionLabel: string }> = {
  BM: { category: 'Malay', sectionLabel: 'FAKTA RINGKAS' },
  EN: { category: 'English', sectionLabel: 'QUICK FACTS' },
  ZH: { category: 'Chinese', sectionLabel: '快速事实' },
}

// Assemble the QuickFactData the Fabric carousel needs from the URL webhook
// response + client-side brand lookups. Brand tokens (hex/logo/font/language)
// come from constants/brands.ts so the URL workflow stays minimal.
function buildQuickFactData(brand: string, resp: QuickFactResponse): QuickFactData {
  const lang = getBrandLanguage(brand)
  const meta = QUICK_FACT_LANG_META[lang]
  return {
    title: resp.quickFactTitle,
    sectionLabel: resp.sectionLabel || meta.sectionLabel,
    keyPhrase: resp.quickFactKeyPhrase,
    caption: resp.caption,
    summary: resp.quickFactSummary ?? '',
    facts: resp.quickFactFacts ?? [],
    heroPublicId: resp.heroPublicId ?? '',
    heroUrl: resp.heroUrl ?? '',
    brand,
    brandHex: getBrandHex(brand),
    logoPublicId: (BRAND_LOGO_IDS as Record<string, string>)[brand] ?? '',
    fontUse: getBrandFontUse(brand) ?? '',
    category: meta.category,
    language: lang,
  }
}

async function generateQuote(
  url: string, brand: string, cfg: QuoteConfig,
): Promise<{ imageUrl: string; caption: string; quoteData: QuoteData; quotePexelsUrls: string[]; quoteFontUse?: string }> {
  const webhookUrl = (
    (IMAGE_PROVIDER === 'imagekit'
      ? import.meta.env.VITE_QUOTE_WEBHOOK_URL_IMAGEKIT
      : import.meta.env.VITE_QUOTE_WEBHOOK_URL) as string | undefined
  )?.trim()
  if (!webhookUrl) throw new Error('Quote webhook not configured')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, brand, caption_title_mode: cfg.captionTitleMode, language: cfg.language }),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const errData = JSON.parse(text) as Record<string, unknown>
        if (errData?.error === 'no_quote_found') message = 'No quote found for this article'
        else if (typeof errData?.message === 'string') message = errData.message as string
      } catch { /* non-JSON body (e.g. true 404) — keep HTTP status */ }
      throw new Error(message)
    }
    if (!text.trim()) throw new Error('Empty response from server')
    const data = JSON.parse(text) as Record<string, unknown>
    if (data.success === false) throw new Error((data.message as string) ?? 'Generation failed')
    const pexelsUrls = (data.pexels_image_urls as string[] | undefined) ??
      [data.pexels_image_left_url, data.pexels_image_right_url].filter(Boolean) as string[]
    return {
      imageUrl: (data.image_url as string) || pexelsUrls[0] || '',
      caption: (data.fb_caption as string) ?? '',
      quoteData: {
        quote_text: (data.quote_text as string) ?? '',
        quote_punch: (data.quote_punch as string) ?? '',
        quote_author: (data.quote_author as string) ?? '',
        quote_author_title: (data.quote_author_title as string | undefined),
      },
      quotePexelsUrls: pexelsUrls,
      quoteFontUse: (data.font_use as string | undefined),
    }
  } finally {
    clearTimeout(timeout)
  }
}


export function Spin({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function CopyBtn({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          trackButtonClick('caption_copied')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      title="Copy caption"
      className={`shrink-0 text-neutral-400 hover:text-neutral-700 transition ${className}`}
    >
      {copied
        ? <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      }
    </button>
  )
}

function StatusBadge({ status }: { status: ResultCard['status'] }) {
  if (status === 'generating') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Spin className="w-3.5 h-3.5" />
        Generating…
      </span>
    )
  }
  if (status === 'done') return null
  return <span className="text-xs font-medium text-red-500">Failed</span>
}

function ScheduledSuccessMessage() {
  const postQueuePath = useBrandPath('/post-queue')
  return (
    <div className="text-center space-y-1">
      <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
      <p className="text-xs text-neutral-400">
        To view or delete your scheduled post, check{' '}
        <Link to={postQueuePath} className="text-neutral-600 underline hover:text-neutral-900 transition-colors">here</Link>.
      </p>
    </div>
  )
}

function SchedulePostButton({ isPosting, postStatus, postError, onOpen }: {
  isPosting: boolean
  postStatus: 'idle' | 'posted' | 'error'
  postError: string
  scheduledFor: string
  onOpen: () => void
}) {
  if (postStatus === 'posted') {
    return <ScheduledSuccessMessage />
  }
  return (
    <div>
      <button
        onClick={onOpen}
        disabled={isPosting}
        className="w-full py-3 px-4 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-xl text-sm font-semibold transition active:scale-[0.98]"
      >
        {isPosting ? (
          <span className="flex items-center justify-center gap-2"><Spin />Scheduling…</span>
        ) : 'Schedule on FB'}
      </button>
      {postStatus === 'error' && postError && (
        <p className="text-xs text-red-500 mt-1.5 text-center">{postError}</p>
      )}
    </div>
  )
}

async function downloadImage(imageUrl: string, filename: string) {
  try {
    const res = await fetch(imageUrl)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  } catch {
    toast.error('Download failed')
  }
}

function getCropSourceUrl(imageUrl: string, uploadedPublicId: string | null): string {
  if (uploadedPublicId) return uploadedImageUrl(uploadedPublicId)
  // ImageKit: the raw base image is the URL without its `?tr` chain (CORS-safe, no overlays).
  if (imageUrl.includes('ik.imagekit.io')) return imageUrl.split('?')[0]
  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim() ?? ''
  const fetchPrefix = '/image/fetch/'
  const fetchIdx = imageUrl.indexOf(fetchPrefix)
  if (fetchIdx !== -1) {
    const base = imageUrl.substring(0, fetchIdx)
    const segs = imageUrl.substring(fetchIdx + fetchPrefix.length).split('/')
    let lastTransform = -1
    for (let i = 0; i < segs.length; i++) if (segs[i].includes(',')) lastTransform = i
    const encodedSrc = lastTransform >= 0 ? segs[lastTransform + 1] : segs[segs.length - 1]
    return `${base}/image/fetch/${encodedSrc}`
  }
  const uploadPrefix = '/image/upload/'
  const uploadIdx = imageUrl.indexOf(uploadPrefix)
  if (uploadIdx !== -1) {
    const after = imageUrl.substring(uploadIdx + uploadPrefix.length)
    const segs = after.split('/')
    let lastTransform = -1
    for (let i = 0; i < segs.length; i++) if (segs[i].includes(',')) lastTransform = i
    const publicIdSeg = lastTransform >= 0 ? segs.slice(lastTransform + 1).join('/') : after
    return `https://res.cloudinary.com/${cloudName}/image/upload/${publicIdSeg}`
  }
  return imageUrl
}

const IcoAdjust = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)
const IcoUpload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
)
const IcoDownload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)
const IcoRefresh = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

// ── Main component ────────────────────────────────────────────────────────────

export function ArticleToSocialPage() {
  const { selectedBrand, isAdmin } = useBrand()
  const location = useLocation()
  const navigate = useNavigate()
  const brandNavigate = useBrandNavigate()

  const [articleUrl, setArticleUrl] = useState<string>(
    (location.state as { articleUrl?: string } | null)?.articleUrl ?? ''
  )
  const [adminBrand, setAdminBrand] = useState<string>(BRANDS[0])
  const [selectedTypes, setSelectedTypes] = useState<Set<PostType>>(() => {
    const st = location.state as { postType?: PostType } | null
    if (st?.postType && ALL_TYPES.includes(st.postType)) return new Set([st.postType])
    return new Set<PostType>(['photo'])
  })

  const [configs, setConfigs] = useState<Configs>({
    photo:    { titleMode: 'original', captionTitleMode: 'original', template: DEFAULT_PHOTO_TEMPLATE },
    carousel: { titleMode: 'original', captionTitleMode: 'original' },
    quickfact: { template: 'single' },
    quote:    { captionTitleMode: 'original', language: 'malay' },
  })

  const [stage, setStage] = useState<'input' | 'results'>('input')
  const [results, setResults] = useState<ResultCard[]>([])

  const effectiveBrand = isAdmin ? adminBrand : (selectedBrand ?? '')
  const orderedTypes = ALL_TYPES.filter(t => selectedTypes.has(t))

  // Auto-select title/caption mode based on domain: own domain → Original, external/competitor → AI
  useEffect(() => {
    if (!articleUrl.trim()) return
    const detected = detectBrandFromUrl(articleUrl)
    const mode: TitleMode = (detected && detected.toLowerCase() === effectiveBrand.toLowerCase()) ? 'original' : 'ai'
    setConfigs(prev => ({
      ...prev,
      photo:    { ...prev.photo,    titleMode: mode, captionTitleMode: mode },
      carousel: { ...prev.carousel, titleMode: mode, captionTitleMode: mode },
      quote:    { ...prev.quote,    captionTitleMode: mode },
    }))
  }, [articleUrl, effectiveBrand])

  // Reset photo template when brand changes — use brand's first template, or generic default
  useEffect(() => {
    setConfigs(prev => ({
      ...prev,
      photo: { ...prev.photo, template: getDefaultTemplateForBrand(effectiveBrand) },
    }))
  }, [effectiveBrand])
  const isBulk = orderedTypes.length > 1

  // Block navigation away from preview page
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      stage === 'results' &&
      currentLocation.pathname !== nextLocation.pathname
  )

  // Prevent browser close/refresh when on preview page
  useEffect(() => {
    if (stage !== 'results') return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [stage])

  function toggleType(type: PostType) {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function updateCard(type: PostType, patch: Partial<ResultCard>) {
    setResults(prev => prev.map(r => r.type === type ? { ...r, ...patch } : r))
  }

  const handleGenerate = useCallback(async () => {
    if (!articleUrl.trim() || orderedTypes.length === 0) return
    const [, brandSlug, ...toolParts] = window.location.pathname.split('/')
    trackToolSubmit(toolParts.join('/') || 'unknown', brandSlug ?? 'unknown', extractDomain(articleUrl))
    const slots = getScheduledSlots(orderedTypes.length)
    const initialCards: ResultCard[] = orderedTypes.map((type, i) => ({
      type, status: 'generating', imageUrl: '', carouselImages: [], caption: '', scheduledFor: slots[i],
    }))
    setResults(initialCards)
    setStage('results')
    navigate('?preview=1', { replace: false })

    const url = articleUrl.trim()
    const brand = effectiveBrand
    const generators = orderedTypes.map(type => {
      switch (type) {
        case 'photo':    return generatePhoto(url, brand, configs.photo)
        case 'carousel': return generateCarousel(url, brand, configs.carousel)
        case 'quickfact': return generateQuickFact(url, brand)
        case 'quote':    return generateQuote(url, brand, configs.quote)
      }
    })

    const settled = await Promise.allSettled(generators)
    settled.forEach((result, i) => {
      const type = orderedTypes[i]
      if (result.status === 'fulfilled') {
        const val = result.value
        let title = ''
        if (type === 'photo') {
          const v = val as Awaited<ReturnType<typeof generatePhoto>>
          title = v.photoTitle
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, caption: v.caption, photoTitle: v.photoTitle, cloudinaryUrl: v.cloudinaryUrl })
        } else if (type === 'carousel') {
          const v = val as Awaited<ReturnType<typeof generateCarousel>>
          title = v.carouselResult.title
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, carouselImages: v.carouselImages, caption: v.caption, carouselResult: v.carouselResult })
        } else if (type === 'quickfact') {
          const v = val as Awaited<ReturnType<typeof generateQuickFact>>
          title = v.quickFactTitle
          const quickFactData = configs.quickfact.template === 'carousel' ? buildQuickFactData(brand, v) : undefined
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, caption: v.caption, quickFactTitle: v.quickFactTitle, quickFactFacts: v.quickFactFacts, quickFactKeyPhrase: v.quickFactKeyPhrase, cloudinaryUrl: v.cloudinaryUrl, quickFactData })
        } else if (type === 'quote') {
          const v = val as Awaited<ReturnType<typeof generateQuote>>
          title = v.quoteData.quote_text
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, caption: v.caption, quoteData: v.quoteData, quotePexelsUrls: v.quotePexelsUrls, quoteFontUse: v.quoteFontUse })
        }
        const out = val as { caption?: string; imageUrl?: string }
        logHistoryEvent({
          eventType: 'generated', brand, toolPostType: type, sourcePage: 'article_to_social',
          articleUrl: url, title, caption: out.caption ?? '', imageUrl: out.imageUrl ?? '', status: 'success',
        })
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : 'Generation failed'
        updateCard(type, { status: 'error', errorMessage: msg })
        logHistoryEvent({
          eventType: 'error', brand, toolPostType: type, sourcePage: 'article_to_social',
          articleUrl: url, status: 'error', errorMessage: msg,
        })
      }
    })
  }, [articleUrl, orderedTypes, effectiveBrand, configs, navigate])

  const handleRetry = useCallback(async (type: PostType) => {
    updateCard(type, { status: 'generating', errorMessage: undefined })
    const url = articleUrl.trim()
    const brand = effectiveBrand
    try {
      switch (type) {
        case 'photo': {
          const v = await generatePhoto(url, brand, configs.photo)
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, caption: v.caption, photoTitle: v.photoTitle, cloudinaryUrl: v.cloudinaryUrl })
          break
        }
        case 'carousel': {
          const v = await generateCarousel(url, brand, configs.carousel)
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, carouselImages: v.carouselImages, caption: v.caption, carouselResult: v.carouselResult })
          break
        }
        case 'quickfact': {
          const v = await generateQuickFact(url, brand)
          const quickFactData = configs.quickfact.template === 'carousel' ? buildQuickFactData(brand, v) : undefined
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, caption: v.caption, quickFactTitle: v.quickFactTitle, quickFactFacts: v.quickFactFacts, quickFactKeyPhrase: v.quickFactKeyPhrase, cloudinaryUrl: v.cloudinaryUrl, quickFactData })
          break
        }
        case 'quote': {
          const v = await generateQuote(url, brand, configs.quote)
          updateCard(type, { status: 'done', imageUrl: v.imageUrl, caption: v.caption, quoteData: v.quoteData, quotePexelsUrls: v.quotePexelsUrls, quoteFontUse: v.quoteFontUse })
          break
        }
      }
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? 'Timed out — try again' : err.message)
        : 'Generation failed'
      updateCard(type, { status: 'error', errorMessage: msg })
    }
  }, [articleUrl, effectiveBrand, configs, updateCard])

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <BackButton />
            <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Article to Social Post</h1>
          </div>
          <p className="text-neutral-500 mt-1 text-sm">Generate multiple post types from one article URL</p>
          <div className="mt-6 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* ── Input stage ── */}
        {stage === 'input' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-6">

              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                  <div className="relative">
                    <select value={adminBrand} onChange={e => setAdminBrand(e.target.value)}
                      className="w-full appearance-none px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white cursor-pointer">
                      {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Article URL</label>
                <input type="url" value={articleUrl} onChange={e => setArticleUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Post Types</label>
                <div className="space-y-2.5">
                  {ALL_TYPES.map(type => {
                    const checked = selectedTypes.has(type)
                    const photoTemplates = getPhotoTemplatesForBrand(effectiveBrand)
                    const hasConfig = (type === 'photo' && photoTemplates.length > 1) || type === 'quickfact'
                    const expanded = checked && hasConfig
                    return (
                      <div
                        key={type}
                        className={`rounded-xl border overflow-hidden transition-colors ${
                          checked ? 'border-zinc-900' : 'border-gray-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleType(type)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors ${
                            checked ? 'bg-white text-neutral-950' : 'bg-white text-neutral-700 hover:bg-neutral-50'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-zinc-900 border-zinc-900' : 'border-gray-300'}`}>
                            {checked && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          {POST_TYPE_LABELS[type]}
                        </button>

                        {expanded && (
                          <div className="bg-white px-4 py-4 border-t border-neutral-100">
                            {type === 'photo' && (
                              <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-2">Photo Template</label>
                                <div className="grid grid-cols-2 gap-2.5">
                                  {photoTemplates.map(t => {
                                    const tChecked = configs.photo.template === t.id
                                    return (
                                      <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setConfigs(prev => ({ ...prev, photo: { ...prev.photo, template: t.id } }))}
                                        className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-colors ${
                                          tChecked ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-neutral-700 border-gray-200 hover:border-neutral-400'
                                        }`}
                                      >
                                        <span>{t.label}</span>
                                        {t.description && (
                                          <span className={`text-[11px] font-normal ${tChecked ? 'text-neutral-300' : 'text-neutral-500'}`}>
                                            {t.description}
                                          </span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            {type === 'quickfact' && (
                              <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-2">Quick Fact Template</label>
                                <div className="grid grid-cols-2 gap-2.5">
                                  {([['single', 'Single Image'], ['carousel', 'Carousel']] as const).map(([value, label]) => {
                                    const tChecked = configs.quickfact.template === value
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        onClick={() => setConfigs(prev => ({ ...prev, quickfact: { ...prev.quickfact, template: value } }))}
                                        className={`px-4 py-3 rounded-xl border text-left text-sm font-medium transition-colors ${
                                          tChecked ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-neutral-700 border-gray-200 hover:border-neutral-400'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <button onClick={handleGenerate} disabled={!articleUrl.trim() || orderedTypes.length === 0}
                className="w-full py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-xl text-sm font-semibold transition active:scale-[0.98]">
                {orderedTypes.length > 1 ? `Generate ${orderedTypes.length} posts` : 'Generate post'}
              </button>

              {/* Supported domains footer */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-2">Supported domains</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(DOMAIN_TO_BRAND).map(([domain]) => (
                    <a
                      key={domain}
                      href={`https://${domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-neutral-400 hover:text-neutral-700 bg-white border border-neutral-200 hover:border-neutral-400 rounded px-1.5 py-0.5 transition-colors"
                    >
                      {domain}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Results stage ── */}
        {stage === 'results' && (
          <div>
            <button onClick={() => { setStage('input'); brandNavigate('/article-to-social', { replace: true }) }}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition mb-6">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            {isBulk ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map(card => (
                  <BulkResultCard
                    key={card.type}
                    card={card}
                    brand={effectiveBrand}
                    articleUrl={articleUrl}
                    onCaptionChange={v => updateCard(card.type, { caption: v })}
                    onRetry={() => handleRetry(card.type)}
                  />
                ))}
              </div>
            ) : results[0] && (
              <>
                {results[0].status === 'generating' && (
                  <div className="flex items-center gap-2 text-sm text-neutral-400 py-12 justify-center">
                    <Spin /> Generating {POST_TYPE_LABELS[results[0].type]}…
                  </div>
                )}
                {results[0].status === 'error' && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl max-w-lg">{results[0].errorMessage}</p>
                )}
                {results[0].status === 'done' && (
                  <>
                    {results[0].type === 'photo' && (
                      <PhotoSingleView card={results[0]} brand={effectiveBrand} articleUrl={articleUrl}
                        onCaptionChange={v => updateCard('photo', { caption: v })} />
                    )}
                    {results[0].type === 'quickfact' && (
                      <QuickFactSingleView card={results[0]} brand={effectiveBrand} articleUrl={articleUrl}
                        onCaptionChange={v => updateCard('quickfact', { caption: v })} />
                    )}
                    {results[0].type === 'quote' && (
                      <QuoteSingleView card={results[0]} brand={effectiveBrand} articleUrl={articleUrl}
                        onCaptionChange={v => updateCard('quote', { caption: v })} />
                    )}
                    {results[0].type === 'carousel' && (
                      <CarouselSingleView card={results[0]} brand={effectiveBrand} articleUrl={articleUrl}
                        onCaptionChange={v => updateCard('carousel', { caption: v })} />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Leave confirmation dialog */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Leave this page?</h3>
                <p className="text-sm text-neutral-600 mt-1">Your progress will be lost if you navigate away now.</p>
              </div>
              <button onClick={() => blocker.reset()} className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => blocker.reset()} className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 transition text-sm">
                Stay
              </button>
              <button onClick={() => blocker.proceed()} className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition text-sm">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ── Photo Single View ─────────────────────────────────────────────────────────
// Matches ArticleGenerateView: LEFT = article URL + title + caption + schedule, RIGHT = image + adjust + upload|download

export function PhotoSingleView({ card, brand, articleUrl, onCaptionChange }: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void
}) {
  const [localTitle, setLocalTitle] = useState(card.photoTitle ?? '')
  const [committedTitle, setCommittedTitle] = useState(card.photoTitle ?? '')
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [showCropPicker, setShowCropPicker] = useState(false)
  const [adjustedImageUrl, setAdjustedImageUrl] = useState<string | null>(null)
  const [adjustedAtTitle, setAdjustedAtTitle] = useState('')
  const [cropLoading, setCropLoading] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<'idle' | 'posted' | 'error'>('idle')
  const [postError, setPostError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialCaptionRef = useRef(card.caption)

  const baseImageUrl = uploadedPublicId
    ? buildCloudinaryUrl(uploadedPublicId, committedTitle, card.imageUrl)
    : card.imageUrl
  const previewImageUrl = updateTitleInImageUrl(baseImageUrl, card.photoTitle ?? '', committedTitle)
  const displayImageUrl = adjustedImageUrl
    ? updateTitleInImageUrl(adjustedImageUrl, adjustedAtTitle, committedTitle)
    : previewImageUrl
  const cropSourceUrl = uploadedPublicId ? getCropSourceUrl(card.imageUrl, uploadedPublicId) : (card.cloudinaryUrl ?? getCropSourceUrl(card.imageUrl, null))

  async function handleCropDone(cropRegion: { x: number; y: number; width: number; height: number }) {
    setCropLoading(true)
    try {
      const newUrl = await applyFocalCrop(previewImageUrl, cropRegion)
      setAdjustedImageUrl(newUrl); setAdjustedAtTitle(committedTitle)
      setShowCropPicker(false); toast.success('Crop adjusted!')
    } catch { toast.error('Failed to adjust crop') }
    finally { setCropLoading(false) }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    setUploadLoading(true)
    try { const publicId = await uploadToCloudinary(file); setUploadedPublicId(publicId); setAdjustedImageUrl(null); toast.success('Image uploaded!') }
    catch { toast.error('Upload failed') }
    finally { setUploadLoading(false) }
  }

  async function handleSchedule(scheduledFor: string, passcode?: string) {
    const brandLower = brand.toLowerCase()
    const resolvedPasscode = passcode ?? getCredentials(brandLower)?.passcode ?? ''
    setIsPosting(true); setShowScheduleModal(false)
    try {
      const editedFields: string[] = []
      if (card.caption !== initialCaptionRef.current) editedFields.push('caption')
      if (committedTitle !== (card.photoTitle ?? '')) editedFields.push('title')
      if (adjustedImageUrl || uploadedPublicId) editedFields.push('image')
      const { authError } = await postToFacebook(
        displayImageUrl, card.caption, brand, scheduledFor, resolvedPasscode,
        { toolPostType: card.type, articleUrl, title: committedTitle, editedFields },
      )
      if (authError) { clearCredentials(brandLower); setIsPosting(false); setShowScheduleModal(true); toast.error('Invalid passcode.'); return }
      if (passcode) saveCredentials(brandLower, passcode)
      setIsPosting(false); setPostStatus('posted'); toast.success('Photo post scheduled!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Post failed'
      setIsPosting(false); setPostStatus('error'); setPostError(msg); toast.error(msg)
    }
  }

  return (
    <>
      {showCropPicker && createPortal(
        <FabricCropPicker sourceImageUrl={cropSourceUrl} aspectRatio={1080 / 1350} onDone={handleCropDone} onCancel={() => setShowCropPicker(false)} />,
        document.body
      )}
      {showScheduleModal && (
        <ScheduleModal brand={brand} hasCredentials={!!getCredentials(brand.toLowerCase())} isPosting={isPosting}
          defaultScheduledFor={card.scheduledFor} onConfirm={handleSchedule} onClose={() => setShowScheduleModal(false)} />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
        {/* LEFT */}
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Article</label>
            <p className="text-sm text-neutral-700 bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-2.5 break-all">{articleUrl}</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Image Title</label>
              <span className="text-xs text-gray-400">{localTitle.length}</span>
            </div>
            <input type="text" value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={() => setCommittedTitle(localTitle)}
              className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              placeholder="Edit image title…" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Caption</label>
              <CopyBtn text={card.caption} />
            </div>
            <textarea value={card.caption} onChange={e => onCaptionChange(e.target.value)} rows={7}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none leading-relaxed" />
            <p className="text-xs text-neutral-400 text-right">{card.caption.length} chars</p>
          </div>
          <SchedulePostButton isPosting={isPosting} postStatus={postStatus} postError={postError}
            scheduledFor={card.scheduledFor} onOpen={() => setShowScheduleModal(true)} />
        </div>

        {/* RIGHT */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="rounded-xl overflow-hidden bg-neutral-100">
            <img src={displayImageUrl || card.imageUrl} alt="Photo post" className="w-full h-auto block" />
          </div>
          <button onClick={() => setShowCropPicker(true)} disabled={cropLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-gray-400 bg-white hover:bg-gray-50 transition disabled:opacity-50">
            {cropLoading ? <Spin /> : <IcoAdjust />}
            {cropLoading ? 'Adjusting...' : 'Adjust Image'}
          </button>
          <div className="flex gap-3">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition disabled:opacity-50">
              {uploadLoading ? <Spin /> : <IcoUpload />}
              {uploadLoading ? 'Uploading…' : 'Upload Custom Image'}
            </button>
            <button onClick={() => downloadImage(displayImageUrl || card.imageUrl, `photo-${brand.toLowerCase()}-${Date.now()}.jpg`)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition">
              <IcoDownload /> Download
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Quick Fact Single View ────────────────────────────────────────────────────
// Matches QuickFactPage: LEFT = title + facts + key phrase + caption + schedule, RIGHT sticky = image + adjust + upload|download

export function QuickFactSingleView(props: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void
}) {
  // CMS carousel path: render the Fabric multi-slide editor. The legacy
  // single-image path (URL-based Quick Fact tool) falls through below.
  if (props.card.quickFactData) {
    return (
      <QuickFactCarouselView
        data={props.card.quickFactData}
        brand={props.brand}
        articleUrl={props.articleUrl}
        caption={props.card.caption}
        scheduledFor={props.card.scheduledFor}
        onCaptionChange={props.onCaptionChange}
      />
    )
  }
  return <QuickFactSingleViewLegacy {...props} />
}

function QuickFactSingleViewLegacy({ card, brand, articleUrl, onCaptionChange }: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void
}) {
  const [localTitle, setLocalTitle] = useState(card.quickFactTitle ?? '')
  const [committedTitle, setCommittedTitle] = useState(card.quickFactTitle ?? '')
  const [facts, setFacts] = useState<QuickFactItem[]>(card.quickFactFacts ?? [])
  const [committedFacts, setCommittedFacts] = useState<QuickFactItem[]>(card.quickFactFacts ?? [])
  const [keyPhrase, setKeyPhrase] = useState(card.quickFactKeyPhrase ?? '')
  const [committedKeyPhrase, setCommittedKeyPhrase] = useState(card.quickFactKeyPhrase ?? '')
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [showCropPicker, setShowCropPicker] = useState(false)
  const [adjustedImageUrl, setAdjustedImageUrl] = useState<string | null>(null)
  const [adjustedAtTitle, setAdjustedAtTitle] = useState('')
  const [adjustedAtFacts, setAdjustedAtFacts] = useState<QuickFactItem[]>([])
  const [adjustedAtKeyPhrase, setAdjustedAtKeyPhrase] = useState('')
  const [cropLoading, setCropLoading] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<'idle' | 'posted' | 'error'>('idle')
  const [postError, setPostError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialCaptionRef = useRef(card.caption)

  const baseImageUrl = uploadedPublicId ? replaceBaseImage(card.imageUrl, uploadedPublicId) : card.imageUrl
  let previewImageUrl = updateTitleInImageUrl(baseImageUrl, card.quickFactTitle ?? '', committedTitle)
  for (let i = 0; i < committedFacts.length; i++) {
    previewImageUrl = updateFactInImageUrl(previewImageUrl, i, card.quickFactFacts?.[i]?.header ?? '', committedFacts[i]?.header ?? '')
    previewImageUrl = updateFactInImageUrl(previewImageUrl, i, card.quickFactFacts?.[i]?.body ?? '', committedFacts[i]?.body ?? '')
  }
  previewImageUrl = updateFactInImageUrl(previewImageUrl, -1, card.quickFactKeyPhrase ?? '', committedKeyPhrase)

  let displayImageUrl = previewImageUrl
  if (adjustedImageUrl) {
    displayImageUrl = updateTitleInImageUrl(adjustedImageUrl, adjustedAtTitle, committedTitle)
    for (let i = 0; i < committedFacts.length; i++) {
      displayImageUrl = updateFactInImageUrl(displayImageUrl, i, adjustedAtFacts[i]?.header ?? '', committedFacts[i]?.header ?? '')
      displayImageUrl = updateFactInImageUrl(displayImageUrl, i, adjustedAtFacts[i]?.body ?? '', committedFacts[i]?.body ?? '')
    }
    displayImageUrl = updateFactInImageUrl(displayImageUrl, -1, adjustedAtKeyPhrase, committedKeyPhrase)
  }

  const cropSourceUrl = getCropSourceUrl(card.imageUrl, uploadedPublicId)

  async function handleCropDone(cropRegion: { x: number; y: number; width: number; height: number }) {
    setCropLoading(true)
    try {
      const newUrl = await applyFocalCrop(previewImageUrl, cropRegion)
      setAdjustedImageUrl(newUrl); setAdjustedAtTitle(committedTitle)
      setAdjustedAtFacts([...committedFacts]); setAdjustedAtKeyPhrase(committedKeyPhrase)
      setShowCropPicker(false); toast.success('Crop adjusted!')
    } catch { toast.error('Failed to adjust crop') }
    finally { setCropLoading(false) }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    setUploadLoading(true)
    try { const publicId = await uploadToCloudinary(file); setUploadedPublicId(publicId); setAdjustedImageUrl(null); toast.success('Image uploaded!') }
    catch { toast.error('Upload failed') }
    finally { setUploadLoading(false) }
  }

  async function handleDownload() {
    try {
      const res = await fetch(displayImageUrl); const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = `quick-fact-${brand.toLowerCase()}-${Date.now()}.jpg`; a.click()
      URL.revokeObjectURL(a.href)
    } catch { toast.error('Download failed') }
  }

  async function handleSchedule(scheduledFor: string, passcode?: string) {
    const brandLower = brand.toLowerCase()
    const resolvedPasscode = passcode ?? getCredentials(brandLower)?.passcode ?? ''
    setIsPosting(true); setShowScheduleModal(false)
    try {
      const editedFields: string[] = []
      if (card.caption !== initialCaptionRef.current) editedFields.push('caption')
      if (committedTitle !== (card.quickFactTitle ?? '')) editedFields.push('title')
      if (adjustedImageUrl || uploadedPublicId) editedFields.push('image')
      const { authError } = await postToFacebook(
        displayImageUrl, card.caption, brand, scheduledFor, resolvedPasscode,
        { toolPostType: card.type, articleUrl, title: committedTitle, editedFields },
      )
      if (authError) { clearCredentials(brandLower); setIsPosting(false); setShowScheduleModal(true); toast.error('Invalid passcode.'); return }
      if (passcode) saveCredentials(brandLower, passcode)
      setIsPosting(false); setPostStatus('posted'); toast.success('Quick Fact post scheduled!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Post failed'
      setIsPosting(false); setPostStatus('error'); setPostError(msg); toast.error(msg)
    }
  }

  // Suppress unused variable warning - articleUrl used for context only
  void articleUrl

  return (
    <>
      {showCropPicker && createPortal(
        <FabricCropPicker sourceImageUrl={cropSourceUrl} aspectRatio={16 / 9} onDone={handleCropDone} onCancel={() => setShowCropPicker(false)} />,
        document.body
      )}
      {showScheduleModal && (
        <ScheduleModal brand={brand} hasCredentials={!!getCredentials(brand.toLowerCase())} isPosting={isPosting}
          defaultScheduledFor={card.scheduledFor} onConfirm={handleSchedule} onClose={() => setShowScheduleModal(false)} />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT: editable fields */}
        <div className="space-y-5">

          {/* Title */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Title</p>
              <span className="text-xs text-gray-400">{localTitle.length}</span>
            </div>
            <input type="text" value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={() => setCommittedTitle(localTitle)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition" />
          </div>

          {/* Key Facts */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Key Facts</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {facts.map((fact, i) => (
                <div key={i} className="px-5 py-4 flex gap-4 items-start">
                  <span className="text-xl font-black text-red-600 leading-none mt-0.5 w-8 flex-shrink-0 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 space-y-2">
                    <input type="text" value={fact.header}
                      onChange={e => { const n = [...facts]; n[i] = { ...n[i], header: e.target.value }; setFacts(n) }}
                      onBlur={() => setCommittedFacts(facts.map(f => ({ ...f })))}
                      placeholder="HEADER LABEL"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition text-neutral-800" />
                    <input type="text" value={fact.body}
                      onChange={e => { const n = [...facts]; n[i] = { ...n[i], body: e.target.value }; setFacts(n) }}
                      onBlur={() => setCommittedFacts(facts.map(f => ({ ...f })))}
                      placeholder="Fact body text..."
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition text-neutral-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2">Bottom Bar</p>
            <input type="text" value={keyPhrase}
              onChange={e => setKeyPhrase(e.target.value)}
              onBlur={() => setCommittedKeyPhrase(keyPhrase)}
              placeholder="LALUAN KRITIKAL: SELAT HORMUZ"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition" />
          </div>

          {/* Caption */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Caption</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{card.caption.length}/600</span>
                <CopyBtn text={card.caption} />
              </div>
            </div>
            <textarea value={card.caption} onChange={e => onCaptionChange(e.target.value.slice(0, 600))} rows={7}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent font-sans leading-relaxed transition" />
          </div>

          {/* Schedule */}
          <div>
            <SchedulePostButton isPosting={isPosting} postStatus={postStatus} postError={postError}
              scheduledFor={card.scheduledFor} onOpen={() => setShowScheduleModal(true)} />
          </div>
        </div>

        {/* RIGHT: sticky image + controls */}
        <div className="lg:sticky lg:top-6 space-y-3">
          <div className="bg-neutral-50 rounded-2xl overflow-hidden border border-gray-200 aspect-[4/5] w-full shadow-[0_2px_24px_rgba(0,0,0,0.07)]">
            <img src={displayImageUrl} alt="Quick fact post preview" className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).src = '' }} />
          </div>
          <button onClick={() => setShowCropPicker(true)} disabled={cropLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-gray-400 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
            {cropLoading ? <Spin /> : <IcoAdjust />}
            {cropLoading ? 'Adjusting...' : 'Adjust Image'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
              {uploadLoading ? <Spin /> : <IcoUpload />}
              {uploadLoading ? 'Uploading…' : 'Upload Custom Image'}
            </button>
            <button onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition-colors">
              <IcoDownload /> Download Image
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Quote Single View ─────────────────────────────────────────────────────────
// Matches QuotePage preview stage: LEFT = article URL + side circle toggle, RIGHT = canvas + controls + quote fields + caption

const QUOTE_CANVAS_W = 1080
const QUOTE_CANVAS_H = 1350

export function QuoteSingleView({ card, brand, articleUrl, onCaptionChange }: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void
}) {
  const canvasRef = useRef<QuoteCanvasHandle>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)
  const customCircleInputRef = useRef<HTMLInputElement>(null)
  const initialCaptionRef = useRef(card.caption)

  const [quoteData, setQuoteData] = useState<QuoteData>(card.quoteData ?? {
    quote_text: '', quote_punch: '', quote_author: '', quote_author_title: '',
  })
  const [pexelsUrls] = useState<string[]>(card.quotePexelsUrls ?? [])
  const [pexelsIndex, setPexelsIndex] = useState(0)
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null)
  const [customCircleUrl, setCustomCircleUrl] = useState<string | null>(null)
  const [manualCrop, setManualCrop] = useState<CropRegion | null>(null)
  const [showCropAdjuster, setShowCropAdjuster] = useState(false)
  const [useSideCircle, setUseSideCircle] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<'idle' | 'posted' | 'error'>('idle')
  const [postError, setPostError] = useState('')

  const bgImageUrl = customBgUrl ?? (card.imageUrl || undefined)
  const config = TABLOID_QUOTE_CANVAS_CONFIG

  function handleBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (customBgUrl) URL.revokeObjectURL(customBgUrl)
    setCustomBgUrl(URL.createObjectURL(file)); setManualCrop(null); e.target.value = ''
  }

  function handleCircleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (customCircleUrl) URL.revokeObjectURL(customCircleUrl)
    setCustomCircleUrl(URL.createObjectURL(file)); e.target.value = ''
  }

  async function handleSchedule(scheduledFor: string, passcode?: string) {
    const dataUrl = canvasRef.current?.getDataUrl()
    if (!dataUrl) { toast.error('Image not ready.'); return }
    const brandLower = brand.toLowerCase()
    const resolvedPasscode = passcode ?? getCredentials(brandLower)?.passcode ?? ''
    setIsPosting(true); setShowScheduleModal(false)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `quote-${brandLower}-${Date.now()}.png`, { type: 'image/png' })
      const publicId = await uploadToCloudinary(file)
      const imageUrl = uploadedImageUrl(publicId)
      const editedFields: string[] = []
      if (card.caption !== initialCaptionRef.current) editedFields.push('caption')
      const { authError } = await postToFacebook(
        imageUrl, card.caption, brand, scheduledFor, resolvedPasscode,
        { toolPostType: 'quote', articleUrl, title: card.quoteData?.quote_author ?? '', editedFields },
      )
      if (authError) { clearCredentials(brandLower); setIsPosting(false); setShowScheduleModal(true); toast.error('Invalid passcode.'); return }
      if (passcode) saveCredentials(brandLower, passcode)
      setIsPosting(false); setPostStatus('posted'); toast.success('Quote post scheduled!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Post failed'
      setIsPosting(false); setPostStatus('error'); setPostError(msg); toast.error(msg)
    }
  }

  function handleCopyCaption() {
    navigator.clipboard.writeText(card.caption).then(() => {
      trackButtonClick('caption_copied')
      toast.success('Caption copied!')
    })
  }

  return (
    <>
      {showCropAdjuster && bgImageUrl && createPortal(
        <ImageCropAdjuster imageUrl={bgImageUrl} aspectRatio={QUOTE_CANVAS_W / QUOTE_CANVAS_H}
          initialRegion={manualCrop}
          onSave={region => { setManualCrop(region); setShowCropAdjuster(false) }}
          onCancel={() => setShowCropAdjuster(false)} />,
        document.body
      )}
      {showScheduleModal && (
        <ScheduleModal brand={brand} hasCredentials={!!getCredentials(brand.toLowerCase())} isPosting={isPosting}
          defaultScheduledFor={card.scheduledFor} onConfirm={handleSchedule} onClose={() => setShowScheduleModal(false)} />
      )}
      <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgFile} />
      <input ref={customCircleInputRef} type="file" accept="image/*" className="hidden" onChange={handleCircleFile} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
        {/* LEFT */}
        <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Article</label>
            <p className="text-sm text-neutral-700 bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-2.5 break-all">{articleUrl}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Side Circle</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {([{ value: true, label: 'On' }, { value: false, label: 'Off' }] as const).map(opt => (
                <button key={String(opt.value)} type="button" onClick={() => setUseSideCircle(opt.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    useSideCircle === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {useSideCircle
                ? 'Adds a Pexels stock photo in a circular frame matched to the article topic'
                : 'Hides the decorative circle'}
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-6">
          {/* Canvas */}
          <div className="flex flex-col w-full gap-3" style={{ maxWidth: 720 }}>
            <QuoteCanvas ref={canvasRef} quote={quoteData} brand={brand} config={config}
              imageUrl={bgImageUrl} cropRegion={manualCrop}
              pexelsImageUrl={useSideCircle ? (customCircleUrl ?? pexelsUrls[pexelsIndex] ?? null) : null}
              fontUse={card.quoteFontUse} />

            {/* Image controls */}
            <div className="w-full space-y-2" style={{ maxWidth: 720 }}>
              <a href={articleUrl} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition">
                See original article
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              {bgImageUrl && (
                <button onClick={() => setShowCropAdjuster(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition">
                  <IcoAdjust />
                  {manualCrop ? 'Edit Image' : 'Adjust Image'}
                </button>
              )}
              <div className="flex gap-2">
                <button onClick={() => bgFileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition">
                  <IcoUpload />
                  {customBgUrl ? 'Replace Image' : 'Upload Image'}
                </button>
                <button onClick={() => canvasRef.current?.downloadAsPng()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition">
                  <IcoDownload /> Download
                </button>
              </div>
              {manualCrop && (
                <button onClick={() => setManualCrop(null)} className="text-xs text-neutral-500 hover:text-neutral-800 transition">
                  Reset crop to auto
                </button>
              )}
              {customBgUrl && (
                <button onClick={() => { URL.revokeObjectURL(customBgUrl); setCustomBgUrl(null); setManualCrop(null) }}
                  className="text-xs text-neutral-500 hover:text-neutral-800 transition">
                  Reset to article photo
                </button>
              )}
              {useSideCircle && (
                <>
                  <div className="flex gap-2">
                    <button onClick={() => customCircleInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition">
                      <IcoUpload />
                      {customCircleUrl ? 'Replace side-circle image' : 'Upload Custom Side Circle'}
                    </button>
                    <button onClick={() => setPexelsIndex(i => (i + 1) % Math.max(pexelsUrls.length, 1))}
                      disabled={pexelsUrls.length < 2}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                      <IcoRefresh /> Refresh Pexels
                    </button>
                  </div>
                  {customCircleUrl && (
                    <button onClick={() => { URL.revokeObjectURL(customCircleUrl); setCustomCircleUrl(null) }}
                      className="text-xs text-neutral-500 hover:text-neutral-800 transition">
                      Reset to Pexels image
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Quote fields + caption */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            {([
              ['quote_punch', 'Punch'],
              ['quote_text', 'Quote Text'],
              ['quote_author', 'Author'],
              ['quote_author_title', 'Author Title'],
            ] as [keyof QuoteData, string][]).map(([key, label]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">{label}</label>
                  <span className="text-xs text-gray-400">{((quoteData[key] as string) ?? '').length}</span>
                </div>
                {key === 'quote_text' ? (
                  <textarea value={(quoteData[key] as string) ?? ''} rows={3}
                    onChange={e => setQuoteData(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent font-sans leading-relaxed transition" />
                ) : (
                  <input type="text" value={(quoteData[key] as string) ?? ''}
                    onChange={e => setQuoteData(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition" />
                )}
              </div>
            ))}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Caption</label>
                <span className="text-xs text-gray-400">{card.caption.length}/600</span>
              </div>
              <textarea value={card.caption} onChange={e => onCaptionChange(e.target.value.slice(0, 600))} rows={8}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent font-sans leading-relaxed transition" />
            </div>

            <div className="flex gap-3">
              <button onClick={handleCopyCaption}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 transition active:scale-[0.98]">
                Copy caption
              </button>
              <button onClick={() => setShowScheduleModal(true)}
                disabled={isPosting || postStatus === 'posted'}
                className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
                {isPosting ? 'Scheduling...' : postStatus === 'posted' ? 'Scheduled!' : 'Schedule on FB'}
              </button>
            </div>
            {postStatus === 'posted' && (
              <ScheduledSuccessMessage />
            )}
            {postStatus === 'error' && postError && (
              <p className="text-xs text-red-500 text-center">{postError}</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Carousel Single View ──────────────────────────────────────────────────────

function CarouselSingleView({ card, brand, articleUrl }: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void
}) {
  const onPostDraft = useCallback(
    (imageUrls: string[], caption: string, postBrand: string, scheduledFor?: string, passcode?: string) =>
      scheduleCarousel(imageUrls, caption, postBrand, scheduledFor, passcode, { toolPostType: 'carousel', articleUrl, title: card.carouselResult?.title ?? '' }),
    [articleUrl, card.carouselResult?.title],
  )

  if (!card.carouselResult) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <p className="text-sm text-neutral-500">Carousel data unavailable.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
      <div className="glass-card rounded-2xl p-6 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Article</label>
          <p className="text-sm text-neutral-700 bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-2.5 break-all">{articleUrl}</p>
        </div>
        <a href={articleUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition">
          Open article
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
      <div className="glass-card rounded-2xl p-4">
        <CarouselResultPreview result={{ ...card.carouselResult, brand }} onPostDraft={onPostDraft} />
      </div>
    </div>
  )
}

// ── Bulk Result Card ──────────────────────────────────────────────────────────
// Vertical PostCard-style card in grid grid-cols-1 md:grid-cols-2

export function BulkResultCard({ card, brand, articleUrl, onCaptionChange, onRetry }: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void; onRetry: () => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-neutral-900">{POST_TYPE_LABELS[card.type]}</span>
        <StatusBadge status={card.status} />
      </div>

      {card.status === 'generating' && (
        <div className="p-4 animate-pulse flex-1">
          <div className="w-full aspect-[4/5] bg-neutral-100 rounded-xl mb-3" />
          <div className="space-y-2">
            <div className="h-3 bg-neutral-100 rounded w-3/4" />
            <div className="h-3 bg-neutral-100 rounded w-full" />
            <div className="h-3 bg-neutral-100 rounded w-1/2" />
          </div>
        </div>
      )}
      {card.status === 'error' && (
        <div className="p-4 space-y-3">
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{card.errorMessage ?? 'Generation failed'}</p>
          <button onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-gray-400 bg-white hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        </div>
      )}
      {card.status === 'done' && (
        <>
          {card.type === 'photo' && <PhotoBulkContent card={card} brand={brand} articleUrl={articleUrl} onCaptionChange={onCaptionChange} />}
          {card.type === 'quickfact' && <QuickFactBulkContent card={card} brand={brand} articleUrl={articleUrl} onCaptionChange={onCaptionChange} />}
          {card.type === 'quote' && <QuoteBulkContent card={card} brand={brand} onCaptionChange={onCaptionChange} />}
          {card.type === 'carousel' && <CarouselBulkContent card={card} brand={brand} articleUrl={articleUrl} onCaptionChange={onCaptionChange} />}
        </>
      )}
    </div>
  )
}

// ── Photo Bulk Content ────────────────────────────────────────────────────────

function PhotoBulkContent({ card, brand, articleUrl, onCaptionChange }: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void
}) {
  const [localTitle, setLocalTitle] = useState(card.photoTitle ?? '')
  const [committedTitle, setCommittedTitle] = useState(card.photoTitle ?? '')
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [showCropPicker, setShowCropPicker] = useState(false)
  const [adjustedImageUrl, setAdjustedImageUrl] = useState<string | null>(null)
  const [adjustedAtTitle, setAdjustedAtTitle] = useState('')
  const [cropLoading, setCropLoading] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<'idle' | 'posted' | 'error'>('idle')
  const [postError, setPostError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const baseImageUrl = uploadedPublicId ? buildCloudinaryUrl(uploadedPublicId, committedTitle, card.imageUrl) : card.imageUrl
  const previewImageUrl = updateTitleInImageUrl(baseImageUrl, card.photoTitle ?? '', committedTitle)
  const displayImageUrl = adjustedImageUrl ? updateTitleInImageUrl(adjustedImageUrl, adjustedAtTitle, committedTitle) : previewImageUrl
  const cropSourceUrl = uploadedPublicId ? getCropSourceUrl(card.imageUrl, uploadedPublicId) : (card.cloudinaryUrl ?? getCropSourceUrl(card.imageUrl, null))

  async function handleCropDone(r: { x: number; y: number; width: number; height: number }) {
    setCropLoading(true)
    try { const u = await applyFocalCrop(previewImageUrl, r); setAdjustedImageUrl(u); setAdjustedAtTitle(committedTitle); setShowCropPicker(false); toast.success('Crop adjusted!') }
    catch { toast.error('Failed to adjust crop') } finally { setCropLoading(false) }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''; setUploadLoading(true)
    try { const pid = await uploadToCloudinary(file); setUploadedPublicId(pid); setAdjustedImageUrl(null); toast.success('Image uploaded!') }
    catch { toast.error('Upload failed') } finally { setUploadLoading(false) }
  }

  async function handleSchedule(scheduledFor: string, passcode?: string) {
    const bl = brand.toLowerCase(); const rp = passcode ?? getCredentials(bl)?.passcode ?? ''
    setIsPosting(true); setShowScheduleModal(false)
    try {
      const { authError } = await postToFacebook(displayImageUrl, card.caption, brand, scheduledFor, rp, { toolPostType: 'photo', articleUrl, title: committedTitle })
      if (authError) { clearCredentials(bl); setIsPosting(false); setShowScheduleModal(true); toast.error('Invalid passcode.'); return }
      if (passcode) saveCredentials(bl, passcode)
      setIsPosting(false); setPostStatus('posted'); toast.success('Scheduled!')
    } catch (err) { const m = err instanceof Error ? err.message : 'Post failed'; setIsPosting(false); setPostStatus('error'); setPostError(m); toast.error(m) }
  }

  return (
    <>
      {showCropPicker && createPortal(<FabricCropPicker sourceImageUrl={cropSourceUrl} aspectRatio={1080 / 1350} onDone={handleCropDone} onCancel={() => setShowCropPicker(false)} />, document.body)}
      {showScheduleModal && <ScheduleModal brand={brand} hasCredentials={!!getCredentials(brand.toLowerCase())} isPosting={isPosting} defaultScheduledFor={card.scheduledFor} onConfirm={handleSchedule} onClose={() => setShowScheduleModal(false)} />}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      <img src={displayImageUrl || card.imageUrl} alt="Photo" className="w-full aspect-[4/5] object-cover" />
      <div className="px-4 pt-3 pb-2 space-y-2">
        {/* Row 1: See original article */}
        <a href={articleUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition">
          See original article
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        {/* Row 2: Adjust Image */}
        <button onClick={() => setShowCropPicker(true)} disabled={cropLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-gray-400 bg-white hover:bg-gray-50 transition disabled:opacity-50">
          {cropLoading ? <Spin className="w-3.5 h-3.5" /> : <IcoAdjust />}
          {cropLoading ? 'Adjusting...' : 'Adjust Image'}
        </button>
        {/* Row 3: Upload | Download */}
        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition disabled:opacity-50">
            {uploadLoading ? <Spin className="w-3.5 h-3.5" /> : <IcoUpload />}
            {uploadLoading ? 'Uploading…' : 'Upload Image'}
          </button>
          <button onClick={() => downloadImage(displayImageUrl || card.imageUrl, `photo-${brand.toLowerCase()}-${Date.now()}.jpg`)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium transition">
            <IcoDownload /> Download
          </button>
        </div>
      </div>
      <div className="px-4 pb-2 space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Image Title</label>
          <input type="text" value={localTitle} onChange={e => setLocalTitle(e.target.value)} onBlur={() => setCommittedTitle(localTitle)}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">Caption</label>
            <CopyBtn text={card.caption} />
          </div>
          <textarea value={card.caption} onChange={e => onCaptionChange(e.target.value)} rows={4}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          <p className="text-right text-xs text-gray-400 mt-0.5">{card.caption.length} / 600</p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <SchedulePostButton isPosting={isPosting} postStatus={postStatus} postError={postError} scheduledFor={card.scheduledFor} onOpen={() => setShowScheduleModal(true)} />
      </div>
    </>
  )
}

// ── Quick Fact Bulk Content ───────────────────────────────────────────────────

function QuickFactBulkContent(props: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void
}) {
  // CMS carousel path: compact Fabric multi-slide editor inside the bulk card.
  if (props.card.quickFactData) {
    return (
      <div className="px-4 pt-3 pb-4">
        <QuickFactCarouselView
          data={props.card.quickFactData}
          brand={props.brand}
          articleUrl={props.articleUrl}
          caption={props.card.caption}
          scheduledFor={props.card.scheduledFor}
          onCaptionChange={props.onCaptionChange}
          compact
        />
      </div>
    )
  }
  return <QuickFactBulkContentLegacy {...props} />
}

function QuickFactBulkContentLegacy({ card, brand, articleUrl, onCaptionChange }: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void
}) {
  const [localTitle, setLocalTitle] = useState(card.quickFactTitle ?? '')
  const [committedTitle, setCommittedTitle] = useState(card.quickFactTitle ?? '')
  const [facts, setFacts] = useState<QuickFactItem[]>(card.quickFactFacts ?? [])
  const [committedFacts, setCommittedFacts] = useState<QuickFactItem[]>(card.quickFactFacts ?? [])
  const [keyPhrase, setKeyPhrase] = useState(card.quickFactKeyPhrase ?? '')
  const [committedKeyPhrase, setCommittedKeyPhrase] = useState(card.quickFactKeyPhrase ?? '')
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [showCropPicker, setShowCropPicker] = useState(false)
  const [adjustedImageUrl, setAdjustedImageUrl] = useState<string | null>(null)
  const [adjustedAtTitle, setAdjustedAtTitle] = useState('')
  const [adjustedAtFacts, setAdjustedAtFacts] = useState<QuickFactItem[]>([])
  const [adjustedAtKeyPhrase, setAdjustedAtKeyPhrase] = useState('')
  const [cropLoading, setCropLoading] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<'idle' | 'posted' | 'error'>('idle')
  const [postError, setPostError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const baseImageUrl = uploadedPublicId ? replaceBaseImage(card.imageUrl, uploadedPublicId) : card.imageUrl
  let previewImageUrl = updateTitleInImageUrl(baseImageUrl, card.quickFactTitle ?? '', committedTitle)
  for (let i = 0; i < committedFacts.length; i++) {
    previewImageUrl = updateFactInImageUrl(previewImageUrl, i, card.quickFactFacts?.[i]?.header ?? '', committedFacts[i]?.header ?? '')
    previewImageUrl = updateFactInImageUrl(previewImageUrl, i, card.quickFactFacts?.[i]?.body ?? '', committedFacts[i]?.body ?? '')
  }
  previewImageUrl = updateFactInImageUrl(previewImageUrl, -1, card.quickFactKeyPhrase ?? '', committedKeyPhrase)
  let displayImageUrl = previewImageUrl
  if (adjustedImageUrl) {
    displayImageUrl = updateTitleInImageUrl(adjustedImageUrl, adjustedAtTitle, committedTitle)
    for (let i = 0; i < committedFacts.length; i++) {
      displayImageUrl = updateFactInImageUrl(displayImageUrl, i, adjustedAtFacts[i]?.header ?? '', committedFacts[i]?.header ?? '')
      displayImageUrl = updateFactInImageUrl(displayImageUrl, i, adjustedAtFacts[i]?.body ?? '', committedFacts[i]?.body ?? '')
    }
    displayImageUrl = updateFactInImageUrl(displayImageUrl, -1, adjustedAtKeyPhrase, committedKeyPhrase)
  }
  const cropSourceUrl = getCropSourceUrl(card.imageUrl, uploadedPublicId)

  async function handleCropDone(r: { x: number; y: number; width: number; height: number }) {
    setCropLoading(true)
    try {
      const u = await applyFocalCrop(previewImageUrl, r)
      setAdjustedImageUrl(u); setAdjustedAtTitle(committedTitle)
      setAdjustedAtFacts([...committedFacts]); setAdjustedAtKeyPhrase(committedKeyPhrase)
      setShowCropPicker(false); toast.success('Crop adjusted!')
    } catch { toast.error('Failed to adjust crop') } finally { setCropLoading(false) }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''; setUploadLoading(true)
    try { const pid = await uploadToCloudinary(file); setUploadedPublicId(pid); setAdjustedImageUrl(null); toast.success('Uploaded!') }
    catch { toast.error('Upload failed') } finally { setUploadLoading(false) }
  }

  async function handleSchedule(scheduledFor: string, passcode?: string) {
    const bl = brand.toLowerCase(); const rp = passcode ?? getCredentials(bl)?.passcode ?? ''
    setIsPosting(true); setShowScheduleModal(false)
    try {
      const { authError } = await postToFacebook(displayImageUrl, card.caption, brand, scheduledFor, rp, { toolPostType: 'quickfact', articleUrl, title: committedTitle })
      if (authError) { clearCredentials(bl); setIsPosting(false); setShowScheduleModal(true); toast.error('Invalid passcode.'); return }
      if (passcode) saveCredentials(bl, passcode)
      setIsPosting(false); setPostStatus('posted'); toast.success('Scheduled!')
    } catch (err) { const m = err instanceof Error ? err.message : 'Post failed'; setIsPosting(false); setPostStatus('error'); setPostError(m); toast.error(m) }
  }

  return (
    <>
      {showCropPicker && createPortal(<FabricCropPicker sourceImageUrl={cropSourceUrl} aspectRatio={16 / 9} onDone={handleCropDone} onCancel={() => setShowCropPicker(false)} />, document.body)}
      {showScheduleModal && <ScheduleModal brand={brand} hasCredentials={!!getCredentials(brand.toLowerCase())} isPosting={isPosting} defaultScheduledFor={card.scheduledFor} onConfirm={handleSchedule} onClose={() => setShowScheduleModal(false)} />}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      <img src={displayImageUrl || card.imageUrl} alt="Quick Fact" className="w-full aspect-[4/5] object-cover" />
      <div className="px-4 pt-3 pb-2 space-y-2">
        {/* Row 1: See original article */}
        <a href={articleUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition">
          See original article
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        {/* Row 2: Adjust Image */}
        <button onClick={() => setShowCropPicker(true)} disabled={cropLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-gray-400 bg-white hover:bg-gray-50 transition disabled:opacity-50">
          {cropLoading ? <Spin className="w-3.5 h-3.5" /> : <IcoAdjust />}
          {cropLoading ? 'Adjusting...' : 'Adjust Image'}
        </button>
        {/* Row 3: Upload | Download */}
        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition disabled:opacity-50">
            {uploadLoading ? <Spin className="w-3.5 h-3.5" /> : <IcoUpload />}
            {uploadLoading ? 'Uploading…' : 'Upload Image'}
          </button>
          <button onClick={() => downloadImage(displayImageUrl || card.imageUrl, `quickfact-${brand.toLowerCase()}-${Date.now()}.jpg`)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium transition">
            <IcoDownload /> Download
          </button>
        </div>
      </div>
      <div className="px-4 pb-2 space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
          <input type="text" value={localTitle} onChange={e => setLocalTitle(e.target.value)} onBlur={() => setCommittedTitle(localTitle)}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        {/* Key Facts */}
        {facts.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Key Facts</label>
            <div className="space-y-2">
              {facts.map((fact, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-sm font-black text-red-600 leading-none mt-2 w-5 flex-shrink-0 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 space-y-1">
                    <input type="text" value={fact.header}
                      onChange={e => { const n = [...facts]; n[i] = { ...n[i], header: e.target.value }; setFacts(n) }}
                      onBlur={() => setCommittedFacts(facts.map(f => ({ ...f })))}
                      placeholder="HEADER"
                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-800" />
                    <input type="text" value={fact.body}
                      onChange={e => { const n = [...facts]; n[i] = { ...n[i], body: e.target.value }; setFacts(n) }}
                      onBlur={() => setCommittedFacts(facts.map(f => ({ ...f })))}
                      placeholder="Fact body..."
                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bottom Bar</label>
          <input type="text" value={keyPhrase} onChange={e => setKeyPhrase(e.target.value)} onBlur={() => setCommittedKeyPhrase(keyPhrase)}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">Caption</label>
            <CopyBtn text={card.caption} />
          </div>
          <textarea value={card.caption} onChange={e => onCaptionChange(e.target.value)} rows={3}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
      </div>
      <div className="px-4 pb-4">
        <SchedulePostButton isPosting={isPosting} postStatus={postStatus} postError={postError} scheduledFor={card.scheduledFor} onOpen={() => setShowScheduleModal(true)} />
      </div>
    </>
  )
}

// ── Quote Bulk Content ────────────────────────────────────────────────────────

function QuoteBulkContent({ card, brand, onCaptionChange }: {
  card: ResultCard; brand: string; onCaptionChange: (v: string) => void
}) {
  const canvasRef = useRef<QuoteCanvasHandle>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)
  const customCircleInputRef = useRef<HTMLInputElement>(null)
  const [quoteData, setQuoteData] = useState<QuoteData>(card.quoteData ?? { quote_text: '', quote_punch: '', quote_author: '', quote_author_title: '' })
  const [pexelsUrls] = useState<string[]>(card.quotePexelsUrls ?? [])
  const [pexelsIndex, setPexelsIndex] = useState(0)
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null)
  const [customCircleUrl, setCustomCircleUrl] = useState<string | null>(null)
  const [manualCrop, setManualCrop] = useState<CropRegion | null>(null)
  const [showCropAdjuster, setShowCropAdjuster] = useState(false)
  const [useSideCircle, setUseSideCircle] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<'idle' | 'posted' | 'error'>('idle')
  const [postError, setPostError] = useState('')

  const bgImageUrl = customBgUrl ?? (card.imageUrl || undefined)
  const config = TABLOID_QUOTE_CANVAS_CONFIG

  function handleBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (customBgUrl) URL.revokeObjectURL(customBgUrl)
    setCustomBgUrl(URL.createObjectURL(file)); setManualCrop(null); e.target.value = ''
  }

  function handleCircleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (customCircleUrl) URL.revokeObjectURL(customCircleUrl)
    setCustomCircleUrl(URL.createObjectURL(file)); e.target.value = ''
  }

  async function handleSchedule(scheduledFor: string, passcode?: string) {
    const dataUrl = canvasRef.current?.getDataUrl(); if (!dataUrl) { toast.error('Image not ready.'); return }
    const bl = brand.toLowerCase(); const rp = passcode ?? getCredentials(bl)?.passcode ?? ''
    setIsPosting(true); setShowScheduleModal(false)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `quote-${bl}-${Date.now()}.png`, { type: 'image/png' })
      const publicId = await uploadToCloudinary(file)
      const imageUrl = uploadedImageUrl(publicId)
      const { authError } = await postToFacebook(imageUrl, card.caption, brand, scheduledFor, rp, { toolPostType: 'quote', articleUrl: undefined, title: '' })
      if (authError) { clearCredentials(bl); setIsPosting(false); setShowScheduleModal(true); toast.error('Invalid passcode.'); return }
      if (passcode) saveCredentials(bl, passcode)
      setIsPosting(false); setPostStatus('posted'); toast.success('Scheduled!')
    } catch (err) { const m = err instanceof Error ? err.message : 'Post failed'; setIsPosting(false); setPostStatus('error'); setPostError(m); toast.error(m) }
  }

  return (
    <>
      {showCropAdjuster && bgImageUrl && createPortal(
        <ImageCropAdjuster imageUrl={bgImageUrl} aspectRatio={QUOTE_CANVAS_W / QUOTE_CANVAS_H} initialRegion={manualCrop}
          onSave={region => { setManualCrop(region); setShowCropAdjuster(false) }} onCancel={() => setShowCropAdjuster(false)} />,
        document.body
      )}
      {showScheduleModal && <ScheduleModal brand={brand} hasCredentials={!!getCredentials(brand.toLowerCase())} isPosting={isPosting} defaultScheduledFor={card.scheduledFor} onConfirm={handleSchedule} onClose={() => setShowScheduleModal(false)} />}
      <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgFile} />
      <input ref={customCircleInputRef} type="file" accept="image/*" className="hidden" onChange={handleCircleFile} />

      {/* Canvas preview */}
      <QuoteCanvas ref={canvasRef} quote={quoteData} brand={brand} config={config}
        imageUrl={bgImageUrl} cropRegion={manualCrop}
        pexelsImageUrl={useSideCircle ? (customCircleUrl ?? pexelsUrls[pexelsIndex] ?? null) : null}
        fontUse={card.quoteFontUse} />

      <div className="px-4 py-2 space-y-2">
        {bgImageUrl && (
          <button onClick={() => setShowCropAdjuster(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition">
            <IcoAdjust /> Adjust Image
          </button>
        )}
        <div className="flex gap-2">
          <button onClick={() => bgFileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition">
            <IcoUpload /> {customBgUrl ? 'Replace Image' : 'Upload Image'}
          </button>
          <button onClick={() => canvasRef.current?.downloadAsPng()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition">
            <IcoDownload /> Download
          </button>
        </div>
      </div>

      <div className="px-4 pb-2 space-y-2">
        {/* Quote fields */}
        {([
          ['quote_punch', 'Punch'],
          ['quote_text', 'Quote Text'],
          ['quote_author', 'Author'],
          ['quote_author_title', 'Author Title'],
        ] as [keyof QuoteData, string][]).map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            {key === 'quote_text' ? (
              <textarea value={(quoteData[key] as string) ?? ''} rows={2}
                onChange={e => setQuoteData(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            ) : (
              <input type="text" value={(quoteData[key] as string) ?? ''}
                onChange={e => setQuoteData(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            )}
          </div>
        ))}

        {/* Side Circle toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500">Side Circle</span>
          <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
            {([{ value: true, label: 'On' }, { value: false, label: 'Off' }] as const).map(opt => (
              <button key={String(opt.value)} type="button" onClick={() => setUseSideCircle(opt.value)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${useSideCircle === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {useSideCircle && (
            <>
              <button onClick={() => customCircleInputRef.current?.click()} title="Upload circle"
                className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 bg-white transition">
                <IcoUpload />
              </button>
              <button onClick={() => setPexelsIndex(i => (i + 1) % Math.max(pexelsUrls.length, 1))}
                disabled={pexelsUrls.length < 2} title="Refresh Pexels"
                className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-400 bg-white transition disabled:opacity-40">
                <IcoRefresh />
              </button>
            </>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">Caption</label>
            <CopyBtn text={card.caption} />
          </div>
          <textarea value={card.caption} onChange={e => onCaptionChange(e.target.value)} rows={4}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          <p className="text-right text-xs text-gray-400 mt-0.5">{card.caption.length} / 600</p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <SchedulePostButton isPosting={isPosting} postStatus={postStatus} postError={postError} scheduledFor={card.scheduledFor} onOpen={() => setShowScheduleModal(true)} />
      </div>
    </>
  )
}

// ── Carousel Bulk Content ─────────────────────────────────────────────────────

function CarouselBulkContent({ card, brand, articleUrl }: {
  card: ResultCard; brand: string; articleUrl: string; onCaptionChange: (v: string) => void
}) {
  const onPostDraft = useCallback(
    (imageUrls: string[], caption: string, postBrand: string, scheduledFor?: string, passcode?: string) =>
      scheduleCarousel(imageUrls, caption, postBrand, scheduledFor, passcode, { toolPostType: 'carousel', articleUrl, title: card.carouselResult?.title ?? '' }),
    [articleUrl, card.carouselResult?.title],
  )

  if (!card.carouselResult) {
    return (
      <div className="p-4">
        <p className="text-sm text-neutral-400">Carousel data unavailable.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      <CarouselResultPreview result={{ ...card.carouselResult, brand }} articleUrl={articleUrl} onPostDraft={onPostDraft} />
    </div>
  )
}

