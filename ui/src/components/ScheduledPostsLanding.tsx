import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RECOMMENDED_SOURCES } from './ScheduledPostsPage'

const BRANDS = [
  'Astro Ulagam',
  'Era',
  'Era Sabah',
  'Era Sarawak',
  'Gegar',
  'Goxuan',
  'Hitz',
  'Hotspot',
  'Lite',
  'Media Hiburan',
  'Melody',
  'Mingguan Wanita',
  'Mix',
  'MY',
  'Raaga',
  'Rojak Daily',
  'Sinar',
  'Zayan',
].sort()

type RawArticle = Record<string, string>

interface CachedItem {
  id: string
  url: string
  source: string
  brand: string
  category: string
  type: string
  title: string
  imageUrl: string
  caption: string
  publishedAt: string
  status: 'idle'
}

function isSameDay(timestamp: number): boolean {
  return new Date(timestamp).toDateString() === new Date().toDateString()
}

// All brands share the same article pool — find any valid same-day cache
function loadCachedArticles(): CachedItem[] | null {
  for (const brand of BRANDS) {
    try {
      const raw = localStorage.getItem(`ready_to_post_${brand}`)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { items: CachedItem[]; timestamp: number }
      if (parsed.items?.length > 0 && isSameDay(parsed.timestamp)) return parsed.items
    } catch { /* continue */ }
  }
  return null
}

async function fetchArticles(): Promise<CachedItem[]> {
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
    if (!text.trim()) throw new Error('Empty response.')
    const data = JSON.parse(text) as { success: boolean; articles: RawArticle[] }
    if (!data.success || !Array.isArray(data.articles)) throw new Error('Unexpected response format.')
    return data.articles.map(a => ({
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

function computeArticleCounts(articles: { source: string }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const brand of BRANDS) {
    const sources = RECOMMENDED_SOURCES[brand] ?? []
    counts[brand] = articles.filter(item =>
      sources.some(s => item.source.toLowerCase() === s.toLowerCase())
    ).length
  }
  return counts
}

export function ScheduledPostsLanding({ onSelectBrand }: { onSelectBrand: (brand: string) => void }) {
  const navigate = useNavigate()
  const [articleCounts, setArticleCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)

  const DISABLED_BRANDS = new Set(['Raaga', 'Mix', 'Rojak Daily'])

  useEffect(() => {
    // Use cache if available and same-day
    const cached = loadCachedArticles()
    if (cached) {
      setArticleCounts(computeArticleCounts(cached))
      return
    }

    // Fetch fresh data and populate all brand caches so brand pages also load fast
    setIsLoading(true)
    fetchArticles()
      .then(articles => {
        const payload = { items: articles, timestamp: Date.now() }
        const serialized = JSON.stringify(payload)
        for (const brand of BRANDS) {
          try { localStorage.setItem(`ready_to_post_${brand}`, serialized) } catch { /* quota */ }
        }
        setArticleCounts(computeArticleCounts(articles))
      })
      .catch(() => { /* fail silently — counts stay empty */ })
      .finally(() => setIsLoading(false))
  }, [])

  const handleBrandClick = (brand: string) => {
    if (DISABLED_BRANDS.has(brand)) return

    onSelectBrand(brand)
    navigate(`/trending-news/${brand.toLowerCase().replace(/\s+/g, '-')}`)
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-5xl mx-auto">

        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
            Trending News
          </h1>
          <p className="text-neutral-500 mt-3 text-sm max-w-xs">
            {isLoading
              ? 'Loading today\'s articles…'
              : 'View trending news from the last 24 hours. Refreshed daily at 10:00 AM'}
          </p>
          <div
            className="mt-6 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Brands grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BRANDS.map((brand) => {
            const isDisabled = DISABLED_BRANDS.has(brand)
            const count = articleCounts[brand] ?? 0
            return (
              <button
                key={brand}
                onClick={() => handleBrandClick(brand)}
                disabled={isDisabled}
                className={`glass-card rounded-xl px-4 py-6 transition-all duration-200 text-left group flex items-center gap-3 ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-sm font-semibold text-neutral-950">{brand}</h2>
                  {isDisabled ? (
                    <p className="text-xs text-neutral-400 mt-0.5">Templates coming soon</p>
                  ) : isLoading ? (
                    <div className="h-3 w-20 bg-neutral-200 rounded animate-pulse mt-1" />
                  ) : count > 0 ? (
                    <p className="text-[11px] text-neutral-400 mt-0.5">{count} articles today</p>
                  ) : null}
                </div>
                {!isDisabled && (
                  <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
