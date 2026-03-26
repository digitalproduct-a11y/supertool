import { useState, useCallback, useEffect } from 'react'
import { BRANDS, detectBrandFromUrl } from '../constants/brands'
import type { TitleMode, CaptionTitleMode } from '../types'
import { ProgressSteps } from './ProgressSteps'

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

function Spinner({ size = 4 }: { size?: number }) {
  const sizeMap: Record<number, string> = { 3: '12px', 4: '16px', 6: '24px', 8: '32px' }
  return (
    <svg
      style={{ width: sizeMap[size] || `${size * 4}px`, height: sizeMap[size] || `${size * 4}px` }}
      className="animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
    </svg>
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
  const [brand, setBrand] = useState(source.brand || '')
  const [titleMode, setTitleMode] = useState<TitleMode>('original')
  const [customTitle, setCustomTitle] = useState('')
  const [captionTitleMode, setCaptionTitleMode] = useState<CaptionTitleMode>('original')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GeneratedPost | null>(null)

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
        <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-5">
          {/* Article URL */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wide">Article URL</label>
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
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wide">Brand</label>
            <select
              value={brand}
              onChange={e => setBrand(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
            >
              <option value="">Select brand</option>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Title mode */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">Image title</label>
            <div className="flex gap-2 flex-wrap">
              {(['original', 'ai', 'custom'] as TitleMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setTitleMode(m)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition ${
                    titleMode === m
                      ? 'bg-neutral-950 text-white border-neutral-950'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  {m === 'original' ? 'Original' : m === 'ai' ? 'AI title' : 'Custom'}
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
            <label className="block text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">Caption title</label>
            <div className="flex gap-2">
              {(['original', 'ai'] as CaptionTitleMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setCaptionTitleMode(m)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition ${
                    captionTitleMode === m
                      ? 'bg-neutral-950 text-white border-neutral-950'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  {m === 'original' ? 'Original' : 'AI title'}
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
            {isGenerating ? 'Generating…' : result ? 'Generate again' : 'Generate FB Post'}
          </button>
        </div>

        {/* ── Right: preview ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
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
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Caption</span>
                  <CopyButton text={result.caption} />
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{result.caption}</p>
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
        setTrendingItems(data.articles.map((a: { url: string; source: string; category: string; type: string; title?: string; image?: string; caption?: string }) => ({
          id: crypto.randomUUID(),
          url: a.url,
          source: a.source || a.category || 'Unknown',
          category: a.category || '',
          type: a.type || '',
          title: a.title || '',
          imageUrl: a.image || '',
          caption: a.caption || '',
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
          <h1 className="text-2xl font-semibold text-neutral-950 tracking-tight">Trending Spike to FB Post</h1>
          <p className="text-neutral-500 mt-1 text-sm">Generate Facebook images &amp; captions from spike or trending articles</p>
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
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
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
                    <span className="flex items-center gap-2"><Spinner /> Loading…</span>
                  ) : '↻ Refresh'}
                </button>
              </div>
              {inboxError && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{inboxError}</p>
              )}
            </div>

            {/* Loading skeleton */}
            {isLoadingInbox && spikeInbox.length === 0 && (
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-neutral-100 rounded w-1/4" />
                      <div className="h-3 bg-neutral-100 rounded w-3/4" />
                      <div className="h-3 bg-neutral-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Inbox table */}
            {spikeInbox.length > 0 && (
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-100">
                  <h2 className="text-sm font-semibold text-neutral-700">{spikeInbox.length} spike{spikeInbox.length > 1 ? 's' : ''} in inbox</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                        <th className="px-6 py-3 whitespace-nowrap">Received</th>
                        <th className="px-4 py-3">Article</th>
                        <th className="px-4 py-3">Brand</th>
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
                              Generate FB Post
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
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-12 text-center">
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
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
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
                    <span className="flex items-center gap-2"><Spinner /> Fetching…</span>
                  ) : 'Refresh'}
                </button>
              </div>
              {fetchError && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{fetchError}</p>
              )}
            </div>

            {/* Trending articles by type */}
            {trendingItems.length > 0 && (
              <>
                {(['Entertainment', 'News', 'Sport'] as const).map(type => {
                  const items = trendingItems.filter(i => i.type.toLowerCase() === type.toLowerCase())
                  if (items.length === 0) return null
                  return (
                    <div key={type} className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
                      <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-neutral-700">{type}</h2>
                        <span className="text-xs text-neutral-400">{items.length} articles</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                              <th className="px-6 py-3">Image</th>
                              <th className="px-4 py-3">Source</th>
                              <th className="px-4 py-3">Title / URL</th>
                              <th className="px-4 py-3">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(item => (
                              <tr key={item.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                                <td className="px-6 py-4 w-48">
                                  <ImageThumb url={item.imageUrl} alt={item.title || item.url} aspectRatio="video" />
                                </td>
                                <td className="px-4 py-4">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-medium whitespace-nowrap capitalize">
                                    {item.source}
                                  </span>
                                </td>
                                <td className="px-4 py-4 max-w-[240px]">
                                  {item.title ? (
                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-neutral-800 hover:text-neutral-500 font-medium line-clamp-2 leading-snug transition">
                                      {item.title}
                                    </a>
                                  ) : (
                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600 text-xs line-clamp-2 break-all transition">
                                      {item.url}
                                    </a>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  <button
                                    onClick={() => handleTrendingGeneratePost(item)}
                                    className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition active:scale-[0.97] whitespace-nowrap"
                                  >
                                    Generate FB Post
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
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-12 text-center">
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
