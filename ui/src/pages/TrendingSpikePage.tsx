import { useState, useCallback, useEffect, useMemo } from 'react'
import { toast } from '../hooks/useToast'
import { IconRefresh, IconSearch, IconExternalLink } from '@tabler/icons-react'
import { Spinner } from '../components/ds/Spinner'
import { GuideModal } from '../components/ds/GuideModal'
import { ArticleGenerateView } from '../components/ArticleGenerateView'

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

// ─── Brand name formatter ─────────────────────────────────────────────────────

const ALL_CAPS_BRANDS = new Set(['xuan'])

function formatBrandName(brand: string): string {
  return brand.split(' ').map(word =>
    ALL_CAPS_BRANDS.has(word.toLowerCase())
      ? word.toUpperCase()
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

// ─── Caching utilities ────────────────────────────────────────────────────────

const TRENDING_CACHE_KEY = 'trending_spike_cache'
const REFRESH_HOUR = 10

function isCacheValid(lastFetchTime: number): boolean {
  const now = new Date()
  const lastFetch = new Date(lastFetchTime)
  const today = now.toDateString()
  const lastFetchDate = lastFetch.toDateString()

  if (today === lastFetchDate) {
    const nowHour = now.getHours()
    const lastFetchHour = lastFetch.getHours()
    if (nowHour < REFRESH_HOUR) {
      return true
    } else {
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrendingSpikePage() {
  const [view, setView] = useState<'list' | 'generate'>('list')
  const [selectedTrending, setSelectedTrending] = useState<TrendingItem | null>(null)
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([])
  const [isFetchingTrending, setIsFetchingTrending] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const handleFetchTrending = useCallback(async (forceRefresh = false) => {
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

  useEffect(() => {
    handleFetchTrending()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const brandCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of trendingItems) {
      if (item.brand) map[item.brand] = (map[item.brand] || 0) + 1
    }
    return map
  }, [trendingItems])

  const allBrands = useMemo(() =>
    Object.keys(brandCounts).sort(),
    [brandCounts]
  )

  const filteredItems = useMemo(() => {
    let items = trendingItems
    if (selectedBrand !== 'all') {
      items = items.filter(i => i.brand === selectedBrand)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.source || '').toLowerCase().includes(q)
      )
    }
    return [...items].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
  }, [trendingItems, selectedBrand, searchQuery])

  function handleGeneratePost(item: TrendingItem) {
    setSelectedTrending(item)
    setView('generate')
  }

  function handleBackToList() {
    setView('list')
    setSelectedTrending(null)
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 flex flex-col min-h-0 overflow-hidden">

      {/* Header */}
      <div className="px-4 md:px-8 pb-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Trending News</h1>
            <p className="text-neutral-500 mt-1 text-sm">Generate Facebook images &amp; captions from trending articles</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleFetchTrending(true)}
              disabled={isFetchingTrending}
              className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-50"
              title="Refresh trending articles"
            >
              <IconRefresh size={16} className={isFetchingTrending ? 'animate-spin' : ''} />
              Refresh
            </button>
            <GuideModal title="How to use Trending News">
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
                  <p className="text-xs text-neutral-700">Trending stories are automatically pulled from all Astro brands every morning — come back daily for fresh content.</p>
                </div>
              </div>
            </GuideModal>
          </div>
        </div>
        <div
          className="mt-4 h-[3px] rounded-full animate-stripe-grow"
          style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
        />
      </div>

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

      {/* List view */}
      {view === 'list' && (
        <div className="flex-1 min-h-0 overflow-hidden border-t border-neutral-100">
          <div className="max-w-6xl mx-auto h-full flex">

          {/* Brand sidebar */}
          <div className="w-48 shrink-0 border-r border-neutral-200 overflow-y-auto flex flex-col bg-white">
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
                  {trendingItems.length}
                </span>
              </button>

              <div className="h-px bg-neutral-100 my-1" />

              {allBrands.map(brand => {
                const active = selectedBrand === brand
                const count = brandCounts[brand] ?? 0
                return (
                  <button
                    key={brand}
                    onClick={() => setSelectedBrand(brand)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-neutral-950 text-white'
                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
                    }`}
                  >
                    <span className="truncate text-left">{formatBrandName(brand)}</span>
                    {count > 0 && (
                      <span className={`text-[10px] tabular-nums shrink-0 ml-1 ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Article list */}
          <div className="flex-1 overflow-y-auto">

            {/* Loading skeleton */}
            {isFetchingTrending && trendingItems.length === 0 && (
              <div className="px-4 md:px-6 py-4 space-y-3">
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

            {trendingItems.length > 0 && (
              <div className="px-4 md:px-6 py-4 space-y-3">

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
                    {filteredItems.length === 0
                      ? 'No articles found'
                      : `${filteredItems.length} article${filteredItems.length !== 1 ? 's' : ''} · refreshes daily at 10AM`}
                  </p>
                  {isFetchingTrending && (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <Spinner size="sm" />
                      Refreshing…
                    </div>
                  )}
                </div>

                {/* Articles */}
                {filteredItems.length === 0 ? (
                  <div className="text-center py-16">
                    {searchQuery ? (
                      <p className="text-sm text-neutral-400">No articles match "{searchQuery}".</p>
                    ) : (
                      <p className="text-sm text-neutral-400">No articles found for this source.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredItems.map((item, idx) => {
                      return (
                      <div
                        key={`${item.id}-${idx}`}
                        onClick={() => handleGeneratePost(item)}
                        className="rounded-xl border overflow-hidden transition-all cursor-pointer bg-white border-neutral-100 hover:border-neutral-200 hover:shadow-sm"
                      >
                        <div className="flex gap-3 p-4">
                          {/* Thumbnail */}
                          <div className="w-36 aspect-video shrink-0 rounded-lg bg-neutral-100 overflow-hidden relative">
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-neutral-400 mb-1">
                              {formatBrandName(item.brand)}
                              {item.publishedAt ? ` · ${item.publishedAt}` : ''}
                            </p>
                            <h3 className="text-sm font-semibold text-neutral-950 leading-snug line-clamp-2">
                              {item.title || item.url}
                            </h3>
                          </div>
                        </div>
                        <div className="border-t border-neutral-100 px-4 py-2.5">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition"
                          >
                            Read article <IconExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Empty state — no items at all */}
            {trendingItems.length === 0 && !isFetchingTrending && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-600">No trending articles</p>
                  <p className="text-xs text-neutral-400 mt-1">Try refreshing to load today's articles.</p>
                </div>
                <button
                  onClick={() => handleFetchTrending(true)}
                  className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Refresh
                </button>
              </div>
            )}

          </div>
          </div>
        </div>
      )}

    </main>
  )
}
