import { useState, useCallback, useEffect } from 'react'
import { BRANDS, detectBrandFromUrl } from '../constants/brands'
import type { TitleMode, CaptionTitleMode } from '../types'
import { ProgressSteps } from './ProgressSteps'
import { Spinner } from './ds/Spinner'
import { GuideModal } from './ds/GuideModal'

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
  const [customTitle, setCustomTitle] = useState('')
  const [captionTitleMode, setCaptionTitleMode] = useState<CaptionTitleMode>(isBrandMismatch ? 'ai' : 'original')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GeneratedPost | null>(null)
  const [caption, setCaption] = useState('')
  const [draftState, setDraftState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [draftMessage, setDraftMessage] = useState('')

  const handleGenerate = useCallback(async () => {
    if (!brand) return
    setIsGenerating(true)
    setError('')
    try {
      const data = await callGenerateWebhook({
        url: source.articleUrl,
        brand,
        mode: 'own_brand',
        title_mode: titleMode,
        custom_title: titleMode === 'custom' ? customTitle : undefined,
        caption_title_mode: captionTitleMode,
      })
      if (data.success) {
        setResult({ imageUrl: data.imageUrl, caption: data.caption, title: data.title, originalTitle: data.originalTitle, brand: data.brand })
        setCaption(data.caption ?? '')
      } else {
        setError(data.message || 'Generation failed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setIsGenerating(false)
    }
  }, [source.articleUrl, brand, titleMode, customTitle, captionTitleMode])

  async function handleDownload() {
    if (!result?.imageUrl) return
    try {
      const res = await fetch(result.imageUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${result.brand}-${Date.now()}.jpg`
      a.click()
    } catch { /* ignore */ }
  }

  async function handlePostDraftClick() {
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl) {
      setDraftMessage('Draft posting is not available right now.')
      setDraftState('error')
      return
    }
    setDraftState('posting')
    setDraftMessage('')
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: source.articleUrl, brand }),
      })
      const data = await res.json()
      if (data.success) {
        setDraftState('done')
        setDraftMessage('✓ Draft posted to Facebook!')
        setTimeout(() => {
          setDraftState('idle')
          setDraftMessage('')
        }, 3000)
      } else {
        setDraftState('error')
        setDraftMessage("Couldn't post draft. Please try again.")
      }
    } catch {
      setDraftState('error')
      setDraftMessage("Couldn't post draft. Please try again.")
    }
  }

  return (
    <div className="space-y-6">
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
              {(['original', 'ai', 'custom'] as TitleMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setTitleMode(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    titleMode === m
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {m === 'original' ? 'Original' : m === 'ai' ? 'AI ✨' : 'Custom'}
                </button>
              ))}
            </div>
            {titleMode === 'custom' && (
              <input
                type="text"
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder="Enter custom title..."
                className="mt-2 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            )}
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
            <div>
              {/* Image */}
              <div className="relative bg-neutral-50">
                <img src={result.imageUrl} alt={result.title} className="w-full aspect-[4/5] object-cover" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
              {/* Caption */}
              <div className="p-5 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700">Caption</span>
                    <CopyButton text={caption} />
                  </div>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 font-sans leading-relaxed"
                  />
                </div>
                {/* Create Draft button */}
                <div>
                  <button
                    onClick={handlePostDraftClick}
                    disabled={draftState === 'posting'}
                    className={`w-full py-3 px-4 font-medium rounded-xl transition text-sm ${
                      draftState === 'done'
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 text-white'
                    }`}
                  >
                    {draftState === 'posting' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Posting draft…
                      </span>
                    ) : draftState === 'done' ? (
                      draftMessage || '✓ Draft posted!'
                    ) : (
                      `Create Draft on ${brand.replace(/\b\w/g, c => c.toUpperCase())}'s FB`
                    )}
                  </button>
                  {draftState === 'error' && draftMessage && (
                    <p className="text-xs text-red-500 text-center mt-1">{draftMessage}</p>
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

  // Spike tab state
  const [spikeView, setSpikeView] = useState<'list' | 'generate'>('list')
  const [selectedSpike, setSelectedSpike] = useState<SpikeInboxItem | null>(null)
  const [spikeInbox, setSpikeInbox] = useState<SpikeInboxItem[]>([])
  const [isLoadingInbox, setIsLoadingInbox] = useState(false)
  const [inboxError, setInboxError] = useState('')
  const [hasUnreadSpikes, setHasUnreadSpikes] = useState(false)

  // Trending tab state
  const [trendingView, setTrendingView] = useState<'list' | 'generate'>('list')
  const [selectedTrending, setSelectedTrending] = useState<TrendingItem | null>(null)
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([])
  const [isFetchingTrending, setIsFetchingTrending] = useState(false)
  const [fetchError, setFetchError] = useState('')

  // ── Spike inbox: load ─────────────────────────────────────────────────────
  const handleLoadInbox = useCallback(async () => {
    setIsLoadingInbox(true)
    setInboxError('')
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
        setInboxError(data.message || 'Failed to load spike inbox.')
      }
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setIsLoadingInbox(false)
    }
  }, [activeTab])

  // Auto-load inbox when spike tab is active
  useEffect(() => {
    if (activeTab === 'spike' && spikeView === 'list' && spikeInbox.length === 0 && !isLoadingInbox) {
      handleLoadInbox()
    }
  }, [activeTab, spikeView]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load trending when tab is active and no data loaded yet
  useEffect(() => {
    if (activeTab === 'trending' && trendingView === 'list' && trendingItems.length === 0 && !isFetchingTrending) {
      handleFetchTrending()
    }
  }, [activeTab, trendingView]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Trending: fetch ──────────────────────────────────────────────────────
  const handleFetchTrending = useCallback(async () => {
    setIsFetchingTrending(true)
    setFetchError('')
    try {
      const data = await callWebhook({ type: 'fetch-trending' })
      if (data.success && Array.isArray(data.articles)) {
        setTrendingItems(data.articles.map((a: { url: string; source: string; category: string; type: string; title?: string; image?: string; caption?: string; publishedAt?: string }) => ({
          id: crypto.randomUUID(),
          url: a.url,
          source: a.source || a.category || 'Unknown',
          category: a.category || '',
          type: a.type || '',
          title: a.title || '',
          imageUrl: (a.image && !a.image.includes('sponsor-logos')) ? a.image : '',
          caption: a.caption || '',
          publishedAt: a.publishedAt || '',
          status: 'idle' as const,
        })))
      } else {
        setFetchError('Failed to fetch trending articles.')
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setIsFetchingTrending(false)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-950 tracking-tight">Trending Spike to FB Post</h1>
              <p className="text-neutral-500 mt-1 text-sm">Generate Facebook images &amp; captions from spike or trending articles</p>
            </div>
            <GuideModal title="How to use Trending Spike to FB Post">
              <div className="space-y-4">
                <ol className="space-y-3 list-decimal list-inside text-sm text-neutral-700">
                  <li><strong>Click "Refresh Inbox"</strong> — load the latest spike articles from Chartbeat alerts</li>
                  <li><strong>Select articles</strong> — pick one or more articles you want to create FB posts for</li>
                  <li><strong>Set parameters for each:</strong>
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li>Brand: auto-detected or manually selected</li>
                      <li>Title mode: Original, AI Rewrite, or Custom</li>
                    </ul>
                  </li>
                  <li><strong>Click "Generate"</strong> — watch the status update for each article (idle → generating → done/error)</li>
                  <li><strong>Review results</strong> — each article shows its generated image and caption</li>
                  <li><strong>Re-generate or Approve:</strong>
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li>Re-generate: update the image or caption</li>
                      <li>Approve: image downloads, caption copies to clipboard</li>
                    </ul>
                  </li>
                </ol>
                <div className="mt-4 p-3 bg-neutral-100 border border-neutral-300 rounded-lg">
                  <p className="text-xs font-semibold text-neutral-800 mb-1">💡 Tip</p>
                  <p className="text-xs text-neutral-700">Use the Trending tab for articles from other monitoring sources, or the Spike tab for real-time Chartbeat alerts.</p>
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
          <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit mb-6">
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
                  <h2 className="text-sm font-semibold text-neutral-700">Spike news from Gmail</h2>
                  <p className="text-xs text-neutral-400 mt-1">Chartbeat spike alerts received in Gmail — click "Generate FB Post" to create an FB post for any article</p>
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
              {inboxError && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{inboxError}</p>
              )}
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
                <p className="text-xs text-neutral-400 mt-1">Chartbeat spike emails from Gmail will appear here once set up</p>
              </div>
            )}
          </div>
        )}

        {/* ── TRENDING TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'trending' && trendingView === 'generate' && selectedTrending && (
          <GenerateView
            source={{
              articleUrl: selectedTrending.url,
              brand: selectedTrending.source,
              articleTitle: selectedTrending.title,
              backLabel: 'Back to trending',
            }}
            onBack={handleBackToTrendingList}
          />
        )}

        {activeTab === 'trending' && trendingView === 'list' && (
          <div className="space-y-6">
            {/* Fetch button */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-700">Daily Trending Content Hub</h2>
                  <p className="text-xs text-neutral-400 mt-1">Get a curated list of trending stories daily at 10AM from Astro brands — helping your team react faster and create high-performing posts.</p>
                </div>
                <button
                  onClick={handleFetchTrending}
                  disabled={isFetchingTrending}
                  className="px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-xl text-sm font-semibold transition whitespace-nowrap active:scale-[0.97]"
                >
                  {isFetchingTrending ? (
                    <span className="flex items-center gap-2"><Spinner size="sm" /> Fetching…</span>
                  ) : '↻ Refresh'}
                </button>
              </div>
              {fetchError && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{fetchError}</p>
              )}
            </div>

            {/* Skeleton while fetching */}
            {isFetchingTrending && trendingItems.length === 0 && (
              <div className="space-y-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="glass-card rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/40">
                      <div className="h-3 skeleton-shimmer rounded w-24" />
                    </div>
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map(j => (
                        <div key={j} className="flex items-center gap-4">
                          <div className="w-48 aspect-video rounded-lg skeleton-shimmer shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 skeleton-shimmer rounded w-3/4" />
                            <div className="h-3 skeleton-shimmer rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Trending articles by type */}
            {trendingItems.length > 0 && (
              <>
                {(['News', 'Sport', 'Entertainment'] as const).map(type => {
                  let items = trendingItems.filter(i => i.type.toLowerCase() === type.toLowerCase())
                  // For Entertainment, sort by preferred sources
                  if (type === 'Entertainment') {
                    const entertainmentOrder = ['Gempak', 'Rojak Daily', 'XUAN', 'Astro Ulagam']
                    items = [...items].sort((a, b) => {
                      const ai = entertainmentOrder.findIndex(s => s.toLowerCase() === a.source.toLowerCase())
                      const bi = entertainmentOrder.findIndex(s => s.toLowerCase() === b.source.toLowerCase())
                      const av = ai === -1 ? 999 : ai
                      const bv = bi === -1 ? 999 : bi
                      return av - bv
                    })
                  }
                  if (items.length === 0) return null
                  return (
                    <div key={type} className="glass-card rounded-2xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-neutral-700">{type}</h2>
                        <span className="text-xs text-neutral-400">{items.length} articles</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                              <th className="px-6 py-3">Image</th>
                              <th className="px-4 py-3">Article</th>
                              <th className="px-4 py-3">Source</th>
                              <th className="px-4 py-3">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(item => (
                              <tr key={item.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                                <td className="px-6 py-4 w-48">
                                  <ImageThumb url={item.imageUrl} alt={item.title || item.url} aspectRatio="video" />
                                </td>
                                <td className="px-4 py-4 max-w-[280px]">
                                  <div className="flex items-start gap-1.5">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-neutral-800 font-medium line-clamp-2 leading-snug text-sm block">
                                        {item.title || item.url}
                                      </span>
                                      {item.publishedAt && (
                                        <span className="text-[11px] text-neutral-400 mt-0.5 block">{item.publishedAt}</span>
                                      )}
                                    </div>
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 mt-0.5 text-neutral-400 hover:text-neutral-700 transition"
                                      title="Open article"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-medium whitespace-nowrap capitalize">
                                    {item.source}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <button
                                    onClick={() => handleTrendingGeneratePost(item)}
                                    className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition active:scale-[0.97] whitespace-nowrap"
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
                  )
                })}
              </>
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
                <p className="text-xs text-neutral-400 mt-1">Click "Fetch Trending" to pull current trending articles from all news sources</p>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
