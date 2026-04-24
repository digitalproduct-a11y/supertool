import { useState, useCallback, useEffect } from 'react'
import { toast } from '../hooks/useToast'
import { IconRefresh } from '@tabler/icons-react'
import { Spinner } from './ds/Spinner'
import { GuideModal } from './ds/GuideModal'
import { GenerateView, ImageThumb } from './GeneratePostView'
import type { GenerateSource } from './GeneratePostView'

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

// ─── Caching utilities ─────────────────────────────────────────────────────────

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
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())

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

  function handleGeneratePost(item: TrendingItem) {
    setSelectedTrending(item)
    setView('generate')
  }

  function handleBackToList() {
    setView('list')
    setSelectedTrending(null)
  }

  const generateSource: GenerateSource | null = selectedTrending
    ? {
        articleUrl: selectedTrending.url,
        brand: selectedTrending.brand,
        articleTitle: selectedTrending.title,
        backLabel: 'Back to trending',
      }
    : null

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-28">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
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
        {view === 'generate' && generateSource && (
          <GenerateView source={generateSource} onBack={handleBackToList} />
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="space-y-6">

            {/* Info banner */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-800">Refreshes daily at 10AM</p>
                <p className="text-xs text-neutral-400 mt-0.5">Trending stories are automatically pulled from all Astro brands every morning — come back daily for fresh content.</p>
              </div>
            </div>

            {/* Brand filter */}
            {trendingItems.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-full p-1 shadow-sm">
                    <button
                      onClick={() => setSelectedSources(new Set())}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${
                        selectedSources.size === 0
                          ? 'bg-neutral-950 text-white shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      All
                    </button>
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
                              ? 'bg-neutral-950 text-white shadow-sm'
                              : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                        >
                          {formatBrandName(brand)}
                        </button>
                      )
                    })}
                  </div>
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

            {/* Refreshing indicator when data already loaded */}
            {isFetchingTrending && trendingItems.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Spinner size="sm" />
                Refreshing…
              </div>
            )}

            {/* Trending articles — 4-column layout */}
            {trendingItems.length > 0 && (() => {
              const GEMPAK_RECOMMENDED = ['rojak daily', 'astro awani', 'xuan']

              const sortByDate = (arr: TrendingItem[]) =>
                [...arr].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))

              const passesFilter = (i: TrendingItem) =>
                selectedSources.size === 0 || selectedSources.has(i.brand)

              const gempakRecommended = sortByDate(
                trendingItems.filter(i => passesFilter(i) && GEMPAK_RECOMMENDED.includes(i.source.toLowerCase()))
              )
              const gempakOther = sortByDate(
                trendingItems.filter(i => passesFilter(i) && !GEMPAK_RECOMMENDED.includes(i.source.toLowerCase()))
              )
              const gempakTotal = gempakRecommended.length + gempakOther.length

              const typeColumns = (['News', 'Sport', 'Entertainment'] as const).map(type => {
                const items = sortByDate(
                  trendingItems.filter(i => {
                    if (i.type.toLowerCase() !== type.toLowerCase()) return false
                    return passesFilter(i)
                  })
                )
                return { type, items }
              }).filter(c => c.items.length > 0)

              const renderArticleRow = (item: TrendingItem) => (
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
                          onClick={() => handleGeneratePost(item)}
                          className="shrink-0 px-2.5 py-1 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-[10px] font-semibold transition active:scale-[0.97]"
                        >
                          Generate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">

                  {/* Gempak brand card */}
                  {gempakTotal > 0 && (
                    <div className="glass-card rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-neutral-700">✨ Gempak</h2>
                        <span className="text-xs text-neutral-400">{gempakTotal}</span>
                      </div>

                      {gempakRecommended.length > 0 && (
                        <>
                          <div className="px-3 pt-2 pb-1">
                            <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Recommended sources</span>
                          </div>
                          <div className="divide-y divide-neutral-50">
                            {gempakRecommended.map(renderArticleRow)}
                          </div>
                        </>
                      )}

                      {gempakOther.length > 0 && (
                        <>
                          <div className="px-3 pt-3 pb-1 border-t border-neutral-100 mt-1">
                            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Other sources</span>
                          </div>
                          <div className="divide-y divide-neutral-50">
                            {gempakOther.map(renderArticleRow)}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* News / Sport / Entertainment columns */}
                  {typeColumns.map(({ type, items }) => {
                    const emoji = type === 'News' ? '📰' : type === 'Sport' ? '⚽' : '🎬'
                    return (
                      <div key={type} className="glass-card rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                          <h2 className="text-sm font-semibold text-neutral-700">{emoji} {type}</h2>
                          <span className="text-xs text-neutral-400">{items.length}</span>
                        </div>
                        <div className="divide-y divide-neutral-50">
                          {items.map(renderArticleRow)}
                        </div>
                      </div>
                    )
                  })}

                </div>
              )
            })()}

            {/* Empty state */}
            {trendingItems.length === 0 && !isFetchingTrending && (
              <div className="glass-card rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-600">No articles yet</p>
                <p className="text-xs text-neutral-400 mt-1">No trending articles found. Try refreshing.</p>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  )
}
