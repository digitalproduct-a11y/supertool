import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { IconRefresh, IconExternalLink, IconChevronLeft, IconChevronRight, IconSearch } from '@tabler/icons-react'
import { BRAND_GROUPS, COMPETITOR_BRANDS } from '../constants/rssFeedsByBrand'
import { PostCard } from './PostCard'
import type { ScheduledPost } from '../types'
import { ArticleGenerateView, generatePost } from './ArticleGenerateView'

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

interface BulkResult {
  article: ArticleWithBrand
  status: 'generating' | 'done' | 'error'
  imageUrl?: string
  caption?: string
  title?: string
  cloudinary_url?: string
  errorMessage?: string
}

type TabState = 'loading' | 'loaded' | 'error'

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

function getCompetitorCacheKey(): string {
  const bucket = Math.floor(Date.now() / 900_000)
  return `rss_competitor_all_${bucket}`
}

function readCompetitorCache(): BrandFeedData[] | null {
  try {
    const raw = sessionStorage.getItem(getCompetitorCacheKey())
    if (!raw) return null
    return JSON.parse(raw) as BrandFeedData[]
  } catch {
    return null
  }
}

function writeCompetitorCache(data: BrandFeedData[]): void {
  try {
    sessionStorage.setItem(getCompetitorCacheKey(), JSON.stringify(data))
  } catch { /* quota — skip */ }
}

function formatMYT(isoStr: string): string {
  const date = new Date(isoStr)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
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

async function fetchCompetitorFeeds(): Promise<BrandFeedData[]> {
  const webhookUrl = (import.meta.env.VITE_RSS_COMPETITOR_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('Competitor RSS webhook not configured.')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as BrandFeedData[] | { error?: string }
  if (!Array.isArray(data)) throw new Error((data as { error?: string }).error ?? 'Unexpected response format')
  return data
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
    cloudinary_url: result.cloudinary_url,
  }
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

  // Competitor state
  const [competitorBrands, setCompetitorBrands] = useState<BrandFeedData[]>([])
  const [competitorTabState, setCompetitorTabState] = useState<TabState>('loaded')
  const [competitorSelectedBrand, setCompetitorSelectedBrand] = useState<string>('all')
  const [activeSection, setActiveSection] = useState<'astro' | 'competitors'>('astro')
  const [competitorsFetched, setCompetitorsFetched] = useState(false)
  const [competitorsLoading, setCompetitorsLoading] = useState(false)
  const [expandedAstro, setExpandedAstro] = useState(false)
  const [expandedCompetitors, setExpandedCompetitors] = useState(false)

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
    if (activeSection === 'competitors') {
      // Refresh competitor feeds
      try { sessionStorage.removeItem(getCompetitorCacheKey()) } catch { /* ignore */ }
      setCompetitorsLoading(true)
      fetchCompetitorFeeds()
        .then(data => {
          writeCompetitorCache(data)
          setCompetitorBrands(data)
          setCompetitorTabState('loaded')
          setCompetitorsLoading(false)
        })
        .catch(() => {
          setCompetitorTabState('error')
          setCompetitorsLoading(false)
        })
    } else {
      // Refresh Astro feeds
      try { sessionStorage.removeItem(getCacheKey()) } catch { /* ignore */ }
      load()
    }
  }

  const handleCompetitorTabClick = (brand: string) => {
    setCompetitorSelectedBrand(brand)
    setActiveSection('competitors')

    // Fetch competitor feeds only on first click
    if (!competitorsFetched) {
      const cached = readCompetitorCache()
      if (cached) {
        setCompetitorBrands(cached)
        setCompetitorTabState('loaded')
        setCompetitorsFetched(true)
        return
      }
      setCompetitorsLoading(true)
      fetchCompetitorFeeds()
        .then(data => {
          writeCompetitorCache(data)
          setCompetitorBrands(data)
          setCompetitorTabState('loaded')
          setCompetitorsFetched(true)
          setCompetitorsLoading(false)
        })
        .catch(() => {
          setCompetitorTabState('error')
          setCompetitorsFetched(true)
          setCompetitorsLoading(false)
        })
    }
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

  const countsByBrand = useMemo(() => {
    const map: Record<string, number> = {}
    const brands = (Array.isArray(allBrands) ? allBrands : []) || []
    for (const b of brands) {
      if (b?.brand && Array.isArray(b.articles)) map[b.brand] = b.articles.length
    }
    return map
  }, [allBrands])

  const competitorCountsByBrand = useMemo(() => {
    const map: Record<string, number> = {}
    const brands = (Array.isArray(competitorBrands) ? competitorBrands : []) || []
    for (const b of brands) {
      if (b?.brand && Array.isArray(b.articles)) map[b.brand] = b.articles.length
    }
    return map
  }, [competitorBrands])

  const totalCount = useMemo(
    () => (Array.isArray(allBrands) ? allBrands : []).reduce((s, b) => s + (Array.isArray(b?.articles) ? b.articles.length : 0), 0),
    [allBrands]
  )

  const totalCompetitorCount = useMemo(
    () => (Array.isArray(competitorBrands) ? competitorBrands : []).reduce((s, b) => s + (Array.isArray(b?.articles) ? b.articles.length : 0), 0),
    [competitorBrands]
  )

  // Merge articles for selected brand, attach sourceBrand, filter by search
  const filteredArticles = useMemo<ArticleWithBrand[]>(() => {
    const brands = (Array.isArray(allBrands) ? allBrands : []) || []
    const source = selectedBrand === 'all'
      ? brands
      : brands.filter(b => b?.brand === selectedBrand)

    const merged = source
      .flatMap(b => {
        if (!b || !Array.isArray(b.articles)) return []
        return b.articles.map(a => ({ ...a, sourceBrand: b.brand }))
      })
      .sort((a, b) => {
        const timeA = new Date(a?.publishedAt || 0).getTime()
        const timeB = new Date(b?.publishedAt || 0).getTime()
        return timeB - timeA
      })

    if (!searchQuery.trim()) return merged
    const q = searchQuery.toLowerCase()
    return merged.filter(a =>
      a?.title?.toLowerCase?.().includes(q) ||
      a?.description?.toLowerCase?.().includes(q)
    )
  }, [allBrands, selectedBrand, searchQuery])

  // Competitor articles
  const competitorFilteredArticles = useMemo<ArticleWithBrand[]>(() => {
    const brands = (Array.isArray(competitorBrands) ? competitorBrands : []) || []
    const source = competitorSelectedBrand === 'all'
      ? brands
      : brands.filter(b => b?.brand === competitorSelectedBrand)

    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const merged = source
      .flatMap(b => {
        if (!b || !Array.isArray(b.articles)) return []
        return b.articles.map(a => ({ ...a, sourceBrand: b.brand }))
      })
      .filter(a => new Date(a?.publishedAt || 0).getTime() >= cutoff)
      .sort((a, b) => {
        const timeA = new Date(a?.publishedAt || 0).getTime()
        const timeB = new Date(b?.publishedAt || 0).getTime()
        return timeB - timeA
      })
    if (!searchQuery.trim()) return merged
    const q = searchQuery.toLowerCase()
    return merged.filter(a =>
      a?.title?.toLowerCase?.().includes(q) ||
      a?.description?.toLowerCase?.().includes(q)
    )
  }, [competitorBrands, competitorSelectedBrand, searchQuery])

  const handleBulkGenerate = useCallback(() => {
    const articles = (activeSection === 'competitors' ? competitorFilteredArticles : filteredArticles) || []
    const selected = articles.filter(a => selectedUrls.has(a.url))
    const initial: BulkResult[] = selected.map(article => ({ article, status: 'generating' }))
    setBulkResults(initial)
    bulkTriggeredRef.current = false
    setView('bulk')
  }, [selectedUrls, activeSection, competitorFilteredArticles, filteredArticles])

  // Fire bulk generations after entering bulk view
  useEffect(() => {
    if (view !== 'bulk' || bulkResults.length === 0 || bulkTriggeredRef.current) return
    bulkTriggeredRef.current = true

    bulkResults.forEach((r, idx) => {
      const titleMode = r.article.sourceBrand.toLowerCase() !== brand.toLowerCase() ? 'ai' : 'original'
      const isCompetitor = COMPETITOR_BRANDS.includes(r.article.sourceBrand)
      generatePost(r.article.url, brand, titleMode, undefined, isCompetitor)
        .then(data => {
          setBulkResults(prev => prev.map((p, i) =>
            i === idx ? { ...p, status: 'done', imageUrl: data.imageUrl, caption: data.caption, title: data.title, cloudinary_url: data.cloudinary_url } : p
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

  const articlesToShow = (activeSection === 'competitors' ? competitorFilteredArticles : filteredArticles) || []

  const doneCount = bulkResults.filter(r => r.status === 'done').length
  const totalBulk = bulkResults.length

  // ── Single view ──
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
          {BRAND_GROUPS.map((group) => {
            const sortedBrands = [...group.brands].sort((a, b) => (countsByBrand[b] ?? 0) - (countsByBrand[a] ?? 0))
            return (
            <div key={group.label}>
              <div className="h-px bg-neutral-100 my-1" />
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 pt-1.5 pb-1">{group.label}</p>
              <button
                onClick={() => { setSelectedBrand('all'); setActiveSection('astro') }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedBrand === 'all' && activeSection === 'astro'
                    ? 'bg-neutral-950 text-white'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
                }`}
              >
                <span>All</span>
                <span className={`text-[10px] tabular-nums ${selectedBrand === 'all' && activeSection === 'astro' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                  {totalCount}
                </span>
              </button>
              {(expandedAstro ? sortedBrands : sortedBrands.slice(0, 5)).map(b => {
                const active = selectedBrand === b && activeSection === 'astro'
                const count = countsByBrand[b] ?? 0
                return (
                  <button
                    key={b}
                    onClick={() => { setSelectedBrand(b); setActiveSection('astro') }}
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
              {group.brands.length > 5 && (
                <button
                  onClick={() => setExpandedAstro(!expandedAstro)}
                  className="w-full text-left px-2.5 py-1 text-[10px] text-neutral-400 hover:text-neutral-600 transition"
                >
                  {expandedAstro ? '← Show Less' : 'Show All →'}
                </button>
              )}
            </div>
            )
          })}

          {/* Competitors section */}
          <div>
            <div className="h-px bg-neutral-100 my-1" />
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 pt-1.5 pb-1">Competitors</p>

            {competitorTabState === 'error' && competitorsFetched && (
              <p className="text-[10px] text-red-400 px-2 py-2">Failed to load</p>
            )}

            <button
              onClick={() => handleCompetitorTabClick('all')}
              disabled={competitorsLoading}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                competitorSelectedBrand === 'all' && activeSection === 'competitors'
                  ? 'bg-neutral-950 text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 disabled:opacity-50'
              }`}
            >
              <span>All</span>
              {competitorsFetched && (
                <span className={`text-[10px] tabular-nums ${competitorSelectedBrand === 'all' && activeSection === 'competitors' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                  {totalCompetitorCount}
                </span>
              )}
            </button>

            {(expandedCompetitors ? COMPETITOR_BRANDS : COMPETITOR_BRANDS.slice(0, 5)).map(b => {
              const active = competitorSelectedBrand === b && activeSection === 'competitors'
              const count = competitorCountsByBrand[b] ?? 0
              return (
                <button
                  key={b}
                  onClick={() => handleCompetitorTabClick(b)}
                  disabled={competitorsLoading}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-neutral-950 text-white'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 disabled:opacity-50'
                  }`}
                >
                  <span className="truncate text-left">{b}</span>
                  {competitorsFetched && count > 0 && (
                    <span className={`text-[10px] tabular-nums shrink-0 ml-1 ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
            {COMPETITOR_BRANDS.length > 5 && (
              <button
                onClick={() => setExpandedCompetitors(!expandedCompetitors)}
                className="w-full text-left px-2.5 py-1 text-[10px] text-neutral-400 hover:text-neutral-600 transition"
              >
                {expandedCompetitors ? '← Show Less' : 'Show All →'}
              </button>
            )}
          </div>
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
            <div className="flex items-center gap-2">
              <p className="text-xs text-neutral-400">
                {articlesToShow.length === 0
                  ? 'No articles found'
                  : `${articlesToShow.length} article${articlesToShow.length !== 1 ? 's' : ''} · last 24 hours`}
              </p>
              {activeSection === 'competitors' && (
                <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-1 rounded">Competitors</span>
              )}
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-950 transition px-2 py-1 rounded-lg hover:bg-neutral-100"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {/* Articles */}
          {competitorsLoading ? (
            <div className="space-y-3 pb-24">
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="rounded-xl border border-neutral-100 bg-white p-4">
                  <div className="flex gap-3">
                    <div className="w-36 aspect-video shrink-0 rounded-lg bg-neutral-100 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-neutral-100 rounded animate-pulse w-1/3" />
                      <div className="h-4 bg-neutral-100 rounded animate-pulse w-full" />
                      <div className="h-4 bg-neutral-100 rounded animate-pulse w-4/5" />
                      <div className="h-3 bg-neutral-100 rounded animate-pulse w-2/3 mt-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : articlesToShow.length === 0 ? (
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
              {articlesToShow.map((article, idx) => {
                const selected = selectedUrls.has(article.url)
                return (
                  <div
                    key={`${article.url}-${idx}`}
                    onClick={() => toggleUrl(article.url)}
                    className={`rounded-xl border overflow-hidden transition-all cursor-pointer ${
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
                          onClick={(e) => { e.stopPropagation(); toggleUrl(article.url) }}
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
                          {article.sourceBrand} · {formatMYT(article.publishedAt)}
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
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition"
                      >
                        Read article <IconExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSingleTarget(article); setView('single') }}
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
