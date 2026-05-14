import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft, IconRefresh, IconSearch, IconChevronRight, IconExternalLink } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'
import { callGenerateWebhook } from '../components/GeneratePostView'
import { ArticleGenerateView } from '../components/ArticleGenerateView'
import { PostCard } from '../components/PostCard'
import type { ScheduledPost } from '../types'
import { RECOMMENDED_SOURCES } from '../constants/scheduledPostSources'

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface GeneratedResult {
  item: TrendingItem
  status: 'generating' | 'done' | 'error'
  imageUrl?: string
  caption?: string
  title?: string
  errorMessage?: string
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchTrendingArticles(): Promise<TrendingItem[]> {
  const webhookUrl = (import.meta.env.VITE_TRENDING_SPIKE_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('VITE_TRENDING_SPIKE_WEBHOOK_URL is not configured.')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'fetch-trending' }),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!text.trim()) throw new Error('Workflow returned an empty response.')
    const data = JSON.parse(text)
    if (!data.success || !Array.isArray(data.articles)) throw new Error('Unexpected response format.')
    return data.articles.map((a: Record<string, string>) => ({
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
  } finally {
    clearTimeout(timeout)
  }
}

function toScheduledPost(result: GeneratedResult, brand: string): ScheduledPost {
  const imageUrl = result.imageUrl ?? ''
  const publicIdMatch = imageUrl.match(/\/([^/]+?)(?:\.[a-z]+)?$/)
  const photoPublicId = publicIdMatch?.[1] ?? ''
  return {
    id: result.item.id,
    date: result.item.publishedAt ?? new Date().toISOString().slice(0, 10),
    brand,
    origin: result.item.source,
    articleUrl: result.item.url,
    articleTitle: result.item.title ?? result.item.url,
    imageUrl,
    photoPublicId,
    title: result.title ?? result.item.title ?? '',
    caption: result.caption ?? '',
    status: 'pending',
    scheduled_time: null,
    scheduled_to: null,
    error_message: null,
  }
}

// ─── Bulk item placeholder ────────────────────────────────────────────────────

function BulkItemPlaceholder({ result }: { result: GeneratedResult }) {
  if (result.status === 'error') {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
        <div className="w-full bg-neutral-50 flex flex-col items-center justify-center gap-2 p-6" style={{ aspectRatio: '4/5' }}>
          <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-neutral-400 text-center">{result.errorMessage || 'Failed to generate'}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col">
      <div className="w-full bg-neutral-100 animate-pulse" style={{ aspectRatio: '4/5' }} />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-neutral-100 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-neutral-100 rounded animate-pulse w-full" />
        <div className="h-3 bg-neutral-100 rounded animate-pulse w-5/6" />
        <div className="h-3 bg-neutral-100 rounded animate-pulse w-2/3" />
        <div className="mt-4 h-8 bg-neutral-100 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ScheduledPostsPage({ brand, embedded = false }: { brand: string; embedded?: boolean }) {
  const navigate = useNavigate()

  const rawBrand = brand
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const displayBrand = rawBrand === 'My' ? 'MY' : rawBrand

  const [articles, setArticles] = useState<TrendingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<'browse' | 'bulk' | 'single'>('browse')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkResults, setBulkResults] = useState<GeneratedResult[]>([])
  const [singleTarget, setSingleTarget] = useState<TrendingItem | null>(null)

  const [selectedSource, setSelectedSource] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const bulkTriggeredRef = useRef(false)

  const loadArticles = useCallback(async (force = false) => {
    setIsLoading(true)
    setError(null)
    try {
      const cacheKey = `ready_to_post_${displayBrand}`
      if (!force) {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const { items } = JSON.parse(cached)
          setArticles(items)
          setIsLoading(false)
          return
        }
      }
      const items = await fetchTrendingArticles()
      localStorage.setItem(cacheKey, JSON.stringify({ items, timestamp: Date.now() }))
      setArticles(items)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load articles.'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }, [displayBrand])

  useEffect(() => { loadArticles() }, [loadArticles])

  const toggleId = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleBulkGenerate = useCallback(() => {
    const selected = articles.filter(a => selectedIds.has(a.id))
    const initial: GeneratedResult[] = selected.map(item => ({ item, status: 'generating' }))
    setBulkResults(initial)
    bulkTriggeredRef.current = false
    setView('bulk')
  }, [articles, selectedIds])

  useEffect(() => {
    if (view !== 'bulk' || bulkResults.length === 0 || bulkTriggeredRef.current) return
    bulkTriggeredRef.current = true

    bulkResults.forEach((r, idx) => {
      callGenerateWebhook({
        url: r.item.url,
        brand: displayBrand,
        title_mode: 'ai',
        caption_title_mode: 'ai',
      }).then(data => {
        const result = Array.isArray(data) ? data[0] : data
        setBulkResults(prev => prev.map((p, i) =>
          i === idx
            ? { ...p, status: 'done', imageUrl: result.imageUrl, caption: result.caption, title: result.title }
            : p
        ))
      }).catch(err => {
        const msg = err instanceof Error ? err.message : 'Generation failed.'
        setBulkResults(prev => prev.map((p, i) =>
          i === idx ? { ...p, status: 'error', errorMessage: msg } : p
        ))
      })
    })
  }, [view, bulkResults.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = useCallback(() => {
    setView('browse')
    setBulkResults([])
    bulkTriggeredRef.current = false
    setSelectedIds(new Set())
    setSingleTarget(null)
  }, [])

  const recommended = RECOMMENDED_SOURCES[displayBrand] ?? []

  const isRecommended = useCallback((source: string) =>
    recommended.some(s => s.toLowerCase() === source.toLowerCase()),
    [recommended]
  )

  const sourceCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of articles) {
      if (item.source) map[item.source] = (map[item.source] || 0) + 1
    }
    return map
  }, [articles])

  const allSources = useMemo(() => {
    const sources = Object.keys(sourceCounts)
    return [
      ...sources.filter(s => isRecommended(s)),
      ...sources.filter(s => !isRecommended(s)).sort(),
    ]
  }, [sourceCounts, isRecommended])

  const filteredArticles = useMemo(() => {
    let items = articles
    if (selectedSource !== 'all') {
      items = items.filter(i => i.source.toLowerCase() === selectedSource.toLowerCase())
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.source || '').toLowerCase().includes(q)
      )
    }
    return [...items].sort((a, b) => {
      const aRec = isRecommended(a.source)
      const bRec = isRecommended(b.source)
      if (aRec && !bRec) return -1
      if (!aRec && bRec) return 1
      return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
    })
  }, [articles, selectedSource, searchQuery, isRecommended])

  const doneCount = bulkResults.filter(r => r.status === 'done').length
  const totalBulk = bulkResults.length

  const Wrapper = embedded ? 'div' : 'main'
  const wrapperClass = embedded
    ? 'flex-1 flex flex-col min-h-0 overflow-hidden'
    : 'flex-1 flex flex-col min-h-0 overflow-hidden pt-20 md:pt-10'

  return (
    <Wrapper className={wrapperClass}>

      {/* Header — standalone only */}
      {!embedded && (
        <div className="px-4 md:px-8 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={view !== 'browse' ? handleBack : () => { if (window.history.length > 1) { navigate(-1); } else { navigate('/home'); } }}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                  {view === 'bulk' ? `Generated Posts (${doneCount}/${totalBulk})` : displayBrand}
                </h1>
                {view === 'browse' && !isLoading && articles.length > 0 && (
                  <p className="text-xs text-neutral-400 mt-0.5">{articles.length} articles available</p>
                )}
              </div>
              {view === 'browse' && (
                <button
                  onClick={() => loadArticles(true)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-50 transition"
                >
                  <IconRefresh size={14} className={isLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              )}
            </div>
          </div>
          <div
            className="h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>
      )}

      {/* Embedded: back button for bulk view only (single view has its own back button via GenerateView) */}
      {embedded && view === 'bulk' && (
        <div className="px-4 md:px-8 flex items-center justify-between py-3 border-b border-neutral-100 shrink-0">
          <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950 transition">
            <IconChevronLeft className="w-4 h-4" />
            Back to trending
          </button>
          <p className="text-xs text-neutral-400">Generated Posts ({doneCount}/{totalBulk})</p>
        </div>
      )}

      {/* ── Single generate view ── */}
      {view === 'single' && singleTarget && (
        <ArticleGenerateView
          article={{
            url: singleTarget.url,
            title: singleTarget.title ?? '',
            sourceBrand: singleTarget.brand || singleTarget.source,
            publishedAt: singleTarget.publishedAt ?? '',
          }}
          brand={displayBrand}
          autoGenerate={true}
          onBack={handleBack}
          backLabel="Back to trending"
        />
      )}

      {/* ── Bulk generated view ── */}
      {view === 'bulk' && (
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {bulkResults.map((result, idx) => (
              result.status === 'done' && result.imageUrl
                ? <PostCard key={idx} post={toScheduledPost(result, displayBrand)} onSchedule={() => Promise.resolve(false)} />
                : <BulkItemPlaceholder key={idx} result={result} />
            ))}
          </div>
        </div>
      )}

      {/* ── Browse view ── */}
      {view === 'browse' && (
        <div className="flex-1 flex min-h-0 overflow-hidden border-t border-neutral-100">

          {/* Source sidebar */}
          <div className="w-44 shrink-0 border-r border-neutral-100 overflow-y-auto flex flex-col bg-white">
            <div className="p-2 space-y-0.5">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 pt-2 pb-1">Sources</p>

              <button
                onClick={() => setSelectedSource('all')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedSource === 'all'
                    ? 'bg-neutral-950 text-white'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
                }`}
              >
                <span>All</span>
                <span className={`text-[10px] tabular-nums ${selectedSource === 'all' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                  {articles.length}
                </span>
              </button>

              <div className="h-px bg-neutral-100 my-1" />

              {allSources.map(source => {
                const active = selectedSource === source
                const count = sourceCounts[source] ?? 0
                const rec = isRecommended(source)
                return (
                  <button
                    key={source}
                    onClick={() => setSelectedSource(source)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-neutral-950 text-white'
                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
                    }`}
                  >
                    <span className="truncate text-left capitalize">{source}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {rec && !active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Recommended" />
                      )}
                      {count > 0 && (
                        <span className={`text-[10px] tabular-nums ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>
                          {count}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Article list */}
          <div className="flex-1 overflow-y-auto">

            {/* Loading */}
            {isLoading && (
              <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
                    <div className="flex gap-3 p-4">
                      <div className="w-36 aspect-video shrink-0 rounded-lg skeleton-shimmer" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-2.5 skeleton-shimmer rounded w-24" />
                        <div className="h-3 skeleton-shimmer rounded w-full" />
                        <div className="h-3 skeleton-shimmer rounded w-3/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {!isLoading && error && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4">
                <p className="text-sm text-neutral-500">{error}</p>
                <button
                  onClick={() => loadArticles()}
                  className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loaded */}
            {!isLoading && !error && articles.length > 0 && (
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
                      : `${filteredArticles.length} article${filteredArticles.length !== 1 ? 's' : ''}`}
                  </p>
                  <button
                    onClick={() => loadArticles(true)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-950 transition px-2 py-1 rounded-lg hover:bg-neutral-100 disabled:opacity-50"
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
                      <p className="text-sm text-neutral-400">No articles for this source.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredArticles.map((item, idx) => {
                      const selected = selectedIds.has(item.id)
                      const rec = isRecommended(item.source)
                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          onClick={() => toggleId(item.id)}
                          className={`rounded-xl border overflow-hidden cursor-pointer transition-all ${
                            selected
                              ? 'border-neutral-400 bg-neutral-50'
                              : 'bg-white border-neutral-100 hover:border-neutral-200 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex gap-3 p-4">
                            {/* Thumbnail with checkbox overlay */}
                            <div className="w-36 aspect-video shrink-0 rounded-lg bg-neutral-100 overflow-hidden relative">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleId(item.id) }}
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

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-neutral-400 mb-1 flex items-center gap-1.5">
                                <span className="capitalize">{item.source}</span>
                                {rec && (
                                  <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Recommended</span>
                                )}
                                {item.publishedAt && <span>· {item.publishedAt}</span>}
                              </p>
                              <h3 className="text-sm font-semibold text-neutral-950 leading-snug line-clamp-2">
                                {item.title || item.url}
                              </h3>
                            </div>
                          </div>

                          <div className="border-t border-neutral-100 px-4 py-2.5 flex items-center justify-between">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition"
                            >
                              Read article <IconExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSingleTarget(item); setView('single') }}
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
            )}

            {/* Empty state */}
            {!isLoading && !error && articles.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-600">No articles today yet</p>
                  <p className="text-xs text-neutral-400 mt-1">Trending articles refresh daily at 10:00 AM.</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Floating bulk action bar */}
      {view === 'browse' && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-6 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-neutral-950 text-white rounded-2xl px-5 py-3 shadow-2xl">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="w-px h-4 bg-white/20" />
            <button
              onClick={handleBulkGenerate}
              className="text-sm font-semibold bg-white text-neutral-950 hover:bg-neutral-100 transition px-4 py-1.5 rounded-xl active:scale-[0.97]"
            >
              Generate {selectedIds.size} {selectedIds.size === 1 ? 'post' : 'posts'}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-white/50 hover:text-white transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

    </Wrapper>
  )
}
