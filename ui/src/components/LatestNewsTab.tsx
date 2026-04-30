import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { IconRefresh, IconExternalLink, IconChevronRight, IconChevronLeft, IconSearch, IconCopy, IconCheck, IconDownload, IconUpload } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'
import { BRAND_GROUPS } from '../constants/rssFeedsByBrand'
import { updateTitleInImageUrl } from '../utils/cloudinary'
import ImageUploadModal from './ImageUploadModal'
import { encodeImage } from './GeneratePostView'
import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
import { PostCard } from './PostCard'
import type { ScheduledPost } from '../types'

interface RssArticle {
  title: string
  url: string
  publishedAt: string
  description: string
  imageUrl?: string
}

interface ArticleWithBrand extends RssArticle {
  sourceBrand: string
}

interface BrandFeedData {
  brand: string
  articles: RssArticle[]
  feedErrors: unknown[]
}

interface GeneratedPost {
  imageUrl: string
  caption: string
  title: string
  originalTitle: string
}

interface BulkResult {
  article: ArticleWithBrand
  status: 'generating' | 'done' | 'error'
  imageUrl?: string
  caption?: string
  title?: string
  errorMessage?: string
}

type TabState = 'loading' | 'loaded' | 'error'
type GenerateState = 'idle' | 'generating' | 'done' | 'error'
type ScheduleState = 'idle' | 'posting' | 'done' | 'error'

function getCacheKey(): string {
  const bucket = Math.floor(Date.now() / 900_000)
  return `rss_latest_all_${bucket}`
}

function readCache(): BrandFeedData[] | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey())
    if (!raw) return null
    return JSON.parse(raw) as BrandFeedData[]
  } catch {
    return null
  }
}

function writeCache(data: BrandFeedData[]): void {
  try {
    sessionStorage.setItem(getCacheKey(), JSON.stringify(data))
  } catch { /* quota — skip */ }
}

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`
}

async function fetchAllRssFeeds(): Promise<BrandFeedData[]> {
  const webhookUrl = (import.meta.env.VITE_RSS_LATEST_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('RSS webhook not configured.')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as BrandFeedData[] | { error?: string }
  if (!Array.isArray(data)) {
    if (data.error) throw new Error(data.error)
    throw new Error('Unexpected response format')
  }
  return data
}

async function generatePost(
  articleUrl: string,
  brand: string,
  titleMode: 'original' | 'ai',
  customImageBase64?: string,
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
      ...(customImageBase64 ? { custom_image: customImageBase64 } : {}),
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { imageUrl?: string; caption?: string; title?: string; originalTitle?: string; error?: string }
  if (data.error) throw new Error(data.error)
  if (!data.imageUrl) throw new Error('No image in response')
  return {
    imageUrl: data.imageUrl,
    caption: data.caption ?? '',
    title: data.title ?? '',
    originalTitle: data.originalTitle ?? data.title ?? '',
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

// ─── Bulk item placeholder ────────────────────────────────────────────────────

function BulkItemPlaceholder({ result }: { result: BulkResult }) {
  if (result.status === 'error') {
    return (
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="w-full bg-neutral-50 flex flex-col items-center justify-center gap-2 p-6" style={{ aspectRatio: '1/1' }}>
          <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-neutral-400 text-center">{result.errorMessage || 'Failed to generate'}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="w-full bg-neutral-100 animate-pulse" style={{ aspectRatio: '1/1' }} />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-neutral-100 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-neutral-100 rounded animate-pulse w-full" />
        <div className="h-3 bg-neutral-100 rounded animate-pulse w-5/6" />
        <div className="mt-4 h-8 bg-neutral-100 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

// ─── Convert bulk result → ScheduledPost for PostCard ────────────────────────

function toScheduledPost(result: BulkResult, brand: string): ScheduledPost {
  const imageUrl = result.imageUrl ?? ''
  const publicIdMatch = imageUrl.match(/\/([^/]+?)(?:\.[a-z]+)?$/)
  const photoPublicId = publicIdMatch?.[1] ?? ''
  return {
    id: result.article.url,
    date: result.article.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    brand,
    origin: result.article.sourceBrand,
    articleUrl: result.article.url,
    articleTitle: result.article.title,
    imageUrl,
    photoPublicId,
    title: result.title ?? result.article.title ?? '',
    caption: result.caption ?? '',
    status: 'pending',
    scheduled_time: null,
    scheduled_to: null,
    error_message: null,
  }
}

// ─── Single generate view ─────────────────────────────────────────────────────

function GenerateView({
  article,
  brand,
  onBack,
}: {
  article: ArticleWithBrand
  brand: string
  onBack: () => void
}) {
  // Auto-detect if article is from a different brand than the page brand
  const isBrandMismatch = article.sourceBrand.toLowerCase() !== brand.toLowerCase()
  const titleMode = isBrandMismatch ? 'ai' : 'original'

  const [generateState, setGenerateState] = useState<GenerateState>('idle')
  const [generated, setGenerated] = useState<GeneratedPost | null>(null)

  // Editable title — like article-to-fb's localTitle / committedLocalTitle pattern
  const [editableTitle, setEditableTitle] = useState('')
  const [committedTitle, setCommittedTitle] = useState('')

  // Custom image
  const [customImage, setCustomImage] = useState<File | null>(null)
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)

  // Caption
  const [caption, setCaption] = useState('')
  const [copied, setCopied] = useState(false)

  // Schedule
  const [scheduleState, setScheduleState] = useState<ScheduleState>('idle')
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Reset uploaded public ID when a new generation result comes in
  useEffect(() => { setUploadedPublicId(null) }, [generated?.imageUrl])

  // Live preview: if user uploaded a replacement image, swap base; then apply title overlay
  const baseImageUrl = uploadedPublicId
    ? buildCloudinaryUrl(uploadedPublicId, committedTitle || generated?.title || '', generated?.imageUrl || '')
    : generated?.imageUrl ?? null

  const previewImageUrl = baseImageUrl
    ? updateTitleInImageUrl(baseImageUrl, generated?.title ?? '', committedTitle)
    : null

  const handleGenerate = async () => {
    setGenerateState('generating')
    try {
      const customImageBase64 = customImage ? await encodeImage(customImage) : undefined
      const result = await generatePost(article.url, brand, titleMode, customImageBase64)
      setGenerated(result)
      setCaption(result.caption)
      setEditableTitle(result.title)
      setCommittedTitle(result.title)
      setCustomImage(null)
      setGenerateState('done')
    } catch (err) {
      setGenerateState('error')
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleDownload = () => {
    if (!previewImageUrl) return
    const a = document.createElement('a')
    a.href = previewImageUrl
    a.download = `${brand.toLowerCase().replace(/\s+/g, '-')}-post.jpg`
    a.target = '_blank'
    a.click()
  }

  const handleSchedule = async (scheduledFor: string, passcode: string) => {
    if (!generated || !previewImageUrl) return
    setScheduleState('posting')
    const finalPasscode = passcode || getCredentials(brand.toLowerCase())?.passcode || ''
    const response = await callScheduleWebhook(previewImageUrl, caption, brand, scheduledFor, finalPasscode)
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
          Back to Latest News
        </button>

        {/* Two-column grid — matches article-to-fb layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">

          {/* Left card: article info + controls */}
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

            {/* Editable image title — shown after generation */}
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

            {/* Generate / Retry button */}
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
          </div>

          {/* Right card: image preview + actions */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            {previewImageUrl ? (
              <div className="rounded-xl overflow-hidden bg-neutral-100">
                <img src={previewImageUrl} alt="Generated post" className="w-full h-auto block" />
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
                {showImageUploadModal && (
                  <ImageUploadModal
                    onSelect={({ publicId }) => {
                      setUploadedPublicId(publicId)
                      setShowImageUploadModal(false)
                    }}
                    onClose={() => setShowImageUploadModal(false)}
                  />
                )}
                <button
                  onClick={() => setShowImageUploadModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl text-sm font-medium transition-colors"
                >
                  <IconUpload className="w-4 h-4" />
                  Upload Custom Image
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-950 rounded-xl text-sm font-semibold transition-colors"
                >
                  <IconDownload className="w-4 h-4" />
                  Download Image
                </button>
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
                {scheduleState === 'done' && <p className="text-xs text-green-600 text-center">✓ Scheduled on Facebook!</p>}
                {scheduleState === 'error' && <p className="text-xs text-red-500 text-center">✗ Failed to schedule. Try again.</p>}
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
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function LatestNewsTab({ brand }: { brand: string }) {
  const [tabState, setTabState] = useState<TabState>('loading')
  const [allBrands, setAllBrands] = useState<BrandFeedData[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // View states
  const [view, setView] = useState<'browse' | 'single' | 'bulk'>('browse')
  const [singleTarget, setSingleTarget] = useState<ArticleWithBrand | null>(null)
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([])
  const bulkTriggeredRef = useRef(false)

  const load = () => {
    setTabState('loading')
    setSingleTarget(null)
    setView('browse')
    setSelectedUrls(new Set())
    fetchAllRssFeeds()
      .then(data => {
        writeCache(data)
        setAllBrands(data)
        setTabState('loaded')
      })
      .catch(() => setTabState('error'))
  }

  useEffect(() => {
    setSingleTarget(null)
    setView('browse')
    setSelectedUrls(new Set())
    const cached = readCache()
    if (cached) {
      setAllBrands(cached)
      setTabState('loaded')
      return
    }
    load()
  }, [brand]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    try { sessionStorage.removeItem(getCacheKey()) } catch { /* ignore */ }
    load()
  }

  const handleBack = useCallback(() => {
    setView('browse')
    setBulkResults([])
    bulkTriggeredRef.current = false
    setSelectedUrls(new Set())
    setSingleTarget(null)
  }, [])

  const toggleUrl = useCallback((url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }, [])

  const handleBulkGenerate = useCallback(() => {
    const selected = filteredArticles.filter(a => selectedUrls.has(a.url))
    const initial: BulkResult[] = selected.map(article => ({ article, status: 'generating' }))
    setBulkResults(initial)
    bulkTriggeredRef.current = false
    setView('bulk')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUrls])

  // Fire bulk generations after entering bulk view
  useEffect(() => {
    if (view !== 'bulk' || bulkResults.length === 0 || bulkTriggeredRef.current) return
    bulkTriggeredRef.current = true

    bulkResults.forEach((r, idx) => {
      const titleMode = r.article.sourceBrand.toLowerCase() !== brand.toLowerCase() ? 'ai' : 'original'
      generatePost(r.article.url, brand, titleMode)
        .then(data => {
          setBulkResults(prev => prev.map((p, i) =>
            i === idx ? { ...p, status: 'done', imageUrl: data.imageUrl, caption: data.caption, title: data.title } : p
          ))
        })
        .catch(err => {
          const msg = err instanceof Error ? err.message : 'Generation failed.'
          setBulkResults(prev => prev.map((p, i) =>
            i === idx ? { ...p, status: 'error', errorMessage: msg } : p
          ))
        })
    })
  }, [view, bulkResults.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const countsByBrand = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of allBrands) map[b.brand] = b.articles.length
    return map
  }, [allBrands])

  const totalCount = useMemo(
    () => allBrands.reduce((s, b) => s + b.articles.length, 0),
    [allBrands]
  )

  // Merge articles for selected brand, attach sourceBrand, filter by search
  const filteredArticles = useMemo<ArticleWithBrand[]>(() => {
    const source = selectedBrand === 'all'
      ? allBrands
      : allBrands.filter(b => b.brand === selectedBrand)

    const merged = source
      .flatMap(b => b.articles.map(a => ({ ...a, sourceBrand: b.brand })))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    if (!searchQuery.trim()) return merged
    const q = searchQuery.toLowerCase()
    return merged.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q)
    )
  }, [allBrands, selectedBrand, searchQuery])

  const doneCount = bulkResults.filter(r => r.status === 'done').length
  const totalBulk = bulkResults.length

  // ── Single view ──
  if (view === 'single' && singleTarget) {
    return (
      <GenerateView
        article={singleTarget}
        brand={brand}
        onBack={handleBack}
      />
    )
  }

  // ── Bulk view ──
  if (view === 'bulk') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 md:px-8 flex items-center justify-between py-3 border-b border-neutral-100 shrink-0">
          <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950 transition">
            <IconChevronLeft className="w-4 h-4" />
            Back
          </button>
          <p className="text-xs text-neutral-400">Generated Posts ({doneCount}/{totalBulk})</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {bulkResults.map((result, idx) => (
              result.status === 'done' && result.imageUrl
                ? <PostCard key={idx} post={toScheduledPost(result, brand)} onSchedule={() => Promise.resolve(false)} />
                : <BulkItemPlaceholder key={idx} result={result} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Loading ──
  if (tabState === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 p-8">
        <h3 className="text-sm font-semibold text-neutral-800">Fetching latest news</h3>
        <p className="text-xs text-neutral-400">Loading articles from the last 24 hours</p>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    )
  }

  // ── Error ──
  if (tabState === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-8">
        <p className="text-sm text-neutral-500">Failed to load latest news.</p>
        <button onClick={handleRefresh} className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors">
          Try Again
        </button>
      </div>
    )
  }

  // ── Browse view ──
  return (
    <div className="flex-1 flex overflow-hidden">

      {/* Brand filter sidebar */}
      <div className="w-40 shrink-0 border-r border-neutral-100 overflow-y-auto flex flex-col bg-white">
        <div className="p-2 space-y-0.5">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 pt-2 pb-1">Sources</p>

          <button
            onClick={() => setSelectedBrand('all')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedBrand === 'all'
                ? 'bg-neutral-950 text-white'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] tabular-nums ${selectedBrand === 'all' ? 'text-neutral-300' : 'text-neutral-400'}`}>
              {totalCount}
            </span>
          </button>

          {BRAND_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="h-px bg-neutral-100 my-1" />
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 pt-1.5 pb-1">{group.label}</p>
              {group.brands.map(b => {
                const active = selectedBrand === b
                const count = countsByBrand[b] ?? 0
                return (
                  <button
                    key={b}
                    onClick={() => setSelectedBrand(b)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-neutral-950 text-white'
                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
                    }`}
                  >
                    <span className="truncate text-left">{b}</span>
                    {count > 0 && (
                      <span className={`text-[10px] tabular-nums shrink-0 ml-1 ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 space-y-3">

          {/* Search bar */}
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search articles…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent placeholder:text-neutral-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">
              {filteredArticles.length === 0
                ? 'No articles found'
                : `${filteredArticles.length} article${filteredArticles.length !== 1 ? 's' : ''} · last 24 hours`}
            </p>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-950 transition px-2 py-1 rounded-lg hover:bg-neutral-100"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {/* Articles */}
          {filteredArticles.length === 0 ? (
            <div className="text-center py-16">
              {searchQuery ? (
                <p className="text-sm text-neutral-400">No articles match "{searchQuery}".</p>
              ) : (
                <>
                  <p className="text-sm text-neutral-400">No new articles in the last 24 hours.</p>
                  <p className="text-xs text-neutral-300 mt-1">Check back later or browse Trending articles.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 pb-24">
              {filteredArticles.map((article, idx) => {
                const selected = selectedUrls.has(article.url)
                return (
                  <div
                    key={`${article.url}-${idx}`}
                    className={`rounded-xl border overflow-hidden transition-all ${
                      selected ? 'border-neutral-400 bg-neutral-50' : 'bg-white border-neutral-100 hover:border-neutral-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex gap-3 p-4">
                      {/* Thumbnail with checkbox overlay */}
                      <div className="w-36 aspect-video shrink-0 rounded-lg bg-neutral-100 overflow-hidden relative">
                        {article.imageUrl && (
                          <img
                            src={article.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => toggleUrl(article.url)}
                          className={`absolute top-1.5 left-1.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${
                            selected ? 'bg-neutral-950 border-neutral-950' : 'bg-white/90 border-neutral-300 hover:border-neutral-500'
                          }`}
                        >
                          {selected && (
                            <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-neutral-400 mb-1">
                          {article.sourceBrand} · {relativeTime(article.publishedAt)}
                        </p>
                        <h3 className="text-sm font-semibold text-neutral-950 leading-snug line-clamp-2 mb-1">
                          {article.title}
                        </h3>
                        {article.description && (
                          <p className="text-xs text-neutral-500 line-clamp-2">{article.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-neutral-100 px-4 py-2.5 flex items-center justify-between">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition"
                      >
                        Read article <IconExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => { setSingleTarget(article); setView('single') }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-950 hover:text-neutral-600 transition"
                      >
                        Generate Post <IconChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating bulk action bar */}
      {selectedUrls.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-6 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-neutral-950 text-white rounded-2xl px-5 py-3 shadow-2xl">
            <span className="text-sm font-medium">{selectedUrls.size} selected</span>
            <div className="w-px h-4 bg-white/20" />
            <button
              onClick={handleBulkGenerate}
              className="text-sm font-semibold bg-white text-neutral-950 hover:bg-neutral-100 transition px-4 py-1.5 rounded-xl active:scale-[0.97]"
            >
              Generate {selectedUrls.size} {selectedUrls.size === 1 ? 'post' : 'posts'}
            </button>
            <button
              onClick={() => setSelectedUrls(new Set())}
              className="text-sm text-white/50 hover:text-white transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
