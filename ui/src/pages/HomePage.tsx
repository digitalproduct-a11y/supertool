import { useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import {
  IconExternalLink,
  IconBulb,
  IconFlame,
  IconTrophy,
  IconTrendingUp,
} from '@tabler/icons-react'
import { useDashboardData } from '../hooks/useDashboardData'
import { filterDashboardData } from '../utils/dashboardUtils'
import { useBrand } from '../context/BrandContext'
import { useNavigate } from 'react-router-dom'
import {
  fetchInHouseFeeds,
  fetchCompetitorFeeds as fetchCompetitorFeedsFromStore,
  clearInHouseCache,
  clearCompetitorCache,
  readInHouseCache,
  readCompetitorCache as readCompetitorCacheFromStore,
} from '../utils/rssStore'

interface HomePageProps {
  onToolSelect: (id: string) => void
}

// ── News feed types ───────────────────────────────────────────────────────────

interface RssArticle {
  title: string
  url: string
  publishedAt: string
  description?: string
  imageUrl?: string
}

interface ArticleWithBrand extends RssArticle {
  sourceBrand: string
  isCompetitor?: boolean
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


async function fetchInHouseNews(): Promise<ArticleWithBrand[]> {
  const url = (import.meta.env.VITE_RSS_LATEST_WEBHOOK_URL as string | undefined)?.trim()
  if (!url) return []
  try {
    const feeds = await fetchInHouseFeeds(url)
    return feeds.flatMap(feed => (feed.articles ?? []).map(a => ({ ...a, sourceBrand: feed.brand, isCompetitor: false })))
  } catch { return [] }
}

async function fetchCompetitorNews(): Promise<ArticleWithBrand[]> {
  const url = (import.meta.env.VITE_RSS_COMPETITOR_WEBHOOK_URL as string | undefined)?.trim()
  if (!url) return []
  try {
    const feeds = await fetchCompetitorFeedsFromStore(url)
    return feeds.flatMap(feed => (feed.articles ?? []).map(a => ({ ...a, sourceBrand: feed.brand, isCompetitor: true })))
  } catch { return [] }
}

// ── Tool cards ───────────────────────────────────────────────────────────────

const TOOL_CARDS = [
  {
    title: 'Article to Social Post',
    gradient: 'linear-gradient(135deg, #F8F0FF 0%, #EEF3FF 50%, #E8F4FD 100%)',
    icon: IconExternalLink,
    iconColor: '#7C3AED',
    links: [
      { label: 'Photo', path: '/article-to-social', state: { postType: 'photo' } },
      { label: 'Carousel', path: '/article-to-social', state: { postType: 'carousel' } },
      { label: 'Quote', path: '/article-to-social', state: { postType: 'quote' } },
      { label: 'Quick Fact', path: '/article-to-social', state: { postType: 'quickfact' } },
    ],
  },
  {
    title: 'Fun Fact Post',
    gradient: 'linear-gradient(135deg, #FEF1EB 0%, #FFF5F0 50%, #FFFBF8 100%)',
    icon: IconBulb,
    iconColor: '#F05A35',
    links: [
      { label: 'Did You Know?', path: '/engagement-posts/didyouknow' },
      { label: 'On This Day', path: '/engagement-posts/on-this-day-malaysia' },
    ],
  },
  {
    title: 'Sports Engagement Post',
    gradient: 'linear-gradient(135deg, #EEF3FF 0%, #E8EEFF 50%, #F0F4FF 100%)',
    icon: IconTrophy,
    iconColor: '#0055EE',
    links: [
      { label: 'EPL', path: '/engagement-posts/epl' },
      { label: 'Champions League', path: '/engagement-posts/ucl' },
      { label: 'Badminton', path: '/engagement-posts/badminton' },
      { label: 'MotoGP', path: '/engagement-posts/motogp' },
    ],
  },
  {
    title: 'Information Post',
    gradient: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF9 50%, #F5FEFB 100%)',
    icon: IconTrendingUp,
    iconColor: '#10B981',
    links: [
      { label: 'KLCI Index', path: '/engagement-posts/klci-index' },
      { label: 'Currency Rate', path: '/engagement-posts/latest-currency-rate' },
      { label: 'Fuel Price', path: '/engagement-posts/latest-fuel-price' },
      { label: 'Weather Malaysia', path: '/engagement-posts/weather-malaysia' },
    ],
  },
  {
    title: 'Entertainment Post',
    gradient: 'linear-gradient(135deg, #FFF0F7 0%, #FEF0FF 50%, #F8F0FF 100%)',
    icon: IconFlame,
    iconColor: '#FF3FBF',
    links: [
      { label: 'Malay Entertainment', path: '/engagement-posts/gempak-entertainment' },
    ],
  },
]

// ── Main component ─────────────────────────────────────────────────────────────

export function HomePage({ onToolSelect: _onToolSelect }: HomePageProps) {
  const { selectedBrand, isAdmin } = useBrand()
  const navigate = useNavigate()
  const { data, targets, loading, lastUpdated } = useDashboardData()

  // Use the latest date in the dataset as the window end (falls back to today)
  const latestDate = data.length > 0
    ? data.reduce((max, r) => r.date > max ? r.date : max, data[0].date)
    : null
  const endDate = latestDate ? new Date(latestDate) : new Date()
  endDate.setHours(23, 59, 59, 999)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 30)
  startDate.setHours(0, 0, 0, 0)

  // Previous 30-day window (the 30 days before the current window)
  const prevEndDate = new Date(startDate)
  prevEndDate.setDate(prevEndDate.getDate() - 1)
  prevEndDate.setHours(23, 59, 59, 999)
  const prevStartDate = new Date(prevEndDate)
  prevStartDate.setDate(prevStartDate.getDate() - 30)
  prevStartDate.setHours(0, 0, 0, 0)

  // Filter data — current and previous periods
  const filtered = isAdmin
    ? data.filter(row => new Date(row.date) >= startDate && new Date(row.date) <= endDate)
    : selectedBrand
      ? filterDashboardData(data, selectedBrand, startDate, endDate)
      : []

  const prevFiltered = isAdmin
    ? data.filter(row => new Date(row.date) >= prevStartDate && new Date(row.date) <= prevEndDate)
    : selectedBrand
      ? filterDashboardData(data, selectedBrand, prevStartDate, prevEndDate)
      : []

  // Sort by date asc for sparklines
  const sparkRows = [...filtered].sort((a, b) => a.date.localeCompare(b.date))

  // 30-day totals — current
  const totalPosts = filtered.reduce((s, r) => s + (r.total_posts || 0), 0)
  const totalRevenue = filtered.reduce((s, r) => s + (r.total_revenue || 0), 0)
  const totalInteractions = filtered.reduce((s, r) => s + (r.total_interactions || 0), 0)

  // 30-day totals — previous
  const prevPosts = prevFiltered.reduce((s, r) => s + (r.total_posts || 0), 0)
  const prevRevenue = prevFiltered.reduce((s, r) => s + (r.total_revenue || 0), 0)
  const prevInteractions = prevFiltered.reduce((s, r) => s + (r.total_interactions || 0), 0)

  // Growth % helper — null if no previous data
  function calcGrowth(current: number, previous: number): number | null {
    if (previous === 0) return null
    return ((current - previous) / previous) * 100
  }
  // Targets
  const brandTarget = isAdmin ? null : targets.find(t => t.Brand === selectedBrand)
  const postsTarget = brandTarget ? Math.round(brandTarget['Avg Posts Per Day'] * 30) : null
  const revenueTarget = brandTarget ? (brandTarget['Annual Revenue Target (USD)'] / 365) * 30 : null

  // Date range label
  const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const dateRangeLabel = `${fmtDate(startDate)} – ${fmtDate(endDate)}`
  const dataFooter = latestDate ? dateRangeLabel : 'Last 30 days'

  // Missing revenue days (within the actual window)
  const windowDates: string[] = []
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    windowDates.push(d.toISOString().split('T')[0])
  }
  const dateDatesWithData = new Set(filtered.map(r => r.date.split('T')[0]))
  const missingRevenueDays = windowDates.filter(d => !dateDatesWithData.has(d)).length

  // Ensure sparklines always have at least 2 points (flat line fallback)
  const FLAT_LINE = [{ v: 0 }, { v: 0 }]
  function toSparkData(arr: { v: number }[]) {
    return arr.length > 1 ? arr : FLAT_LINE
  }

  // Metric card definitions
  const metricCards = [
    {
      label: 'Posts Published',
      value: totalPosts.toLocaleString(),
      target: postsTarget,
      actual: totalPosts,
      growth: calcGrowth(totalPosts, prevPosts),
      footer: dataFooter,
      sparkData: toSparkData(sparkRows.map(r => ({ v: r.total_posts || 0 }))),
      color: '#0055EE',
    },
    {
      label: 'Revenue (USD)',
      value: `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      target: revenueTarget,
      actual: totalRevenue,
      growth: calcGrowth(totalRevenue, prevRevenue),
      footer: missingRevenueDays > 0 && !isAdmin
        ? `${missingRevenueDays} day(s) missing data`
        : dataFooter,
      footerWarning: missingRevenueDays > 0 && !isAdmin,
      sparkData: toSparkData(sparkRows.map(r => ({ v: r.total_revenue || 0 }))),
      color: '#00E5D4',
    },
    {
      label: 'Interactions',
      value: totalInteractions.toLocaleString(),
      target: null as number | null,
      actual: totalInteractions,
      growth: calcGrowth(totalInteractions, prevInteractions),
      footer: dataFooter,
      sparkData: toSparkData(sparkRows.map(r => ({ v: r.total_interactions || 0 }))),
      color: '#FF3FBF',
    },
  ]

  // News feed — seed from cache so navigating back never shows a loading flash
  const [news, setNews] = useState<ArticleWithBrand[]>(() => {
    const inhouse = readInHouseCache()
    const competitor = readCompetitorCacheFromStore()
    if (!inhouse && !competitor) return []
    const inHouseArr = (inhouse ?? []).flatMap(feed =>
      (feed.articles ?? []).map(a => ({ ...a, sourceBrand: feed.brand, isCompetitor: false as const }))
    )
    const compArr = (competitor ?? []).flatMap(feed =>
      (feed.articles ?? []).map(a => ({ ...a, sourceBrand: feed.brand, isCompetitor: true as const }))
    )
    return [...inHouseArr, ...compArr]
      .filter(a => a.publishedAt)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 10)
  })
  const [newsLoading, setNewsLoading] = useState(() => !readInHouseCache())
  const [newsFetchedAt, setNewsFetchedAt] = useState<Date | null>(null)

  function loadNews(bust = false) {
    if (bust) {
      clearInHouseCache()
      clearCompetitorCache()
    }
    // Only show loader when there's nothing to display yet (fresh load or forced bust)
    if (bust || news.length === 0) setNewsLoading(true)
    Promise.allSettled([fetchInHouseNews(), fetchCompetitorNews()]).then(([inH, comp]) => {
      const inHouseArr = inH.status === 'fulfilled' ? inH.value : []
      const compArr = comp.status === 'fulfilled' ? comp.value : []
      const merged = [...inHouseArr, ...compArr]
        .filter(a => a.publishedAt)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 10)
      setNews(merged)
      setNewsFetchedAt(new Date())
      setNewsLoading(false)
    })
  }

  useEffect(() => {
    if (news.length > 0) {
      // Seeded from cache — set timestamp so UI doesn't show "Fetching…"
      setNewsFetchedAt(new Date())
      return
    }
    loadNews()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Row 1: Brand header ─────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-mono text-neutral-400 mb-3 uppercase tracking-widest">
            KULT Digital Kit
          </p>
          <h1 className="font-display text-3xl font-bold text-neutral-950">
            {!isAdmin && selectedBrand ? selectedBrand : (isAdmin ? 'Admin' : '—')}
          </h1>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* ── Row 2: 4-col metrics with sparklines ────────────────────────── */}
        <div>
          {/* Section header */}
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Meta Performance</p>
              <p className="text-sm font-medium text-neutral-700 mt-0.5">
                Last 30 days
                {latestDate && (
                  <span className="text-neutral-400 font-normal"> · {dateRangeLabel}</span>
                )}
              </p>
              {lastUpdated && (
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[12px] text-neutral-500 hover:text-neutral-950 transition-colors flex items-center gap-1"
              >
                View details
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5">
                  <div className="h-2 w-20 bg-neutral-100 rounded-full animate-pulse mb-3" />
                  <div className="h-7 w-24 bg-neutral-100 rounded-lg animate-pulse mb-1" />
                  <div className="h-2 w-16 bg-neutral-100 rounded-full animate-pulse mb-4" />
                  <div className="h-10 bg-neutral-100 rounded animate-pulse mb-3" />
                  {i < 2 && <div className="h-1 w-full bg-neutral-100 rounded-full animate-pulse" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metricCards.map(card => {
                const pct = card.target && card.target > 0
                  ? Math.min(100, (card.actual / card.target) * 100)
                  : null

                return (
                  <div key={card.label} className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5 flex flex-col">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1">{card.label}</p>
                    <div className="flex items-baseline gap-2">
                      <p className="font-display text-2xl font-bold text-neutral-950">{card.value}</p>
                      {card.growth !== null && (
                        <span className={`text-[11px] font-semibold ${card.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {card.growth >= 0 ? '▲' : '▼'} {Math.abs(card.growth).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {/* Target value (posts + revenue only) */}
                    {card.target !== null && card.target > 0 ? (
                      <p className="text-[10px] text-neutral-400 mt-0.5 mb-2">
                        Monthly Target: {card.label === 'Revenue (USD)'
                          ? `$${Math.round(card.target).toLocaleString()}`
                          : card.target.toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-[10px] text-neutral-300 mt-0.5 mb-2">No target set</p>
                    )}

                    {/* Sparkline */}
                    <div className="h-10 flex-1 min-h-[40px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={card.sparkData}>
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={card.color}
                            dot={false}
                            strokeWidth={1.5}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Progress bar (posts + revenue only) */}
                    {pct !== null && (
                      <div className="mt-2">
                        {card.footerWarning && (
                          <p className="text-[10px] text-amber-600 mb-1">{card.footer}</p>
                        )}
                        <div className="w-full bg-neutral-100 rounded-full h-1">
                          <div
                            className="h-1 rounded-full transition-all duration-700"
                            style={{
                              width: `${pct.toFixed(1)}%`,
                              backgroundColor: card.color,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-1">
                          {pct.toFixed(0)}% of target
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Row 3: Tools + News side by side ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

          {/* Left: Tool cards */}
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Tools</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TOOL_CARDS.map(card => {
                const Icon = card.icon
                return (
                  <div key={card.title} className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden">
                    {/* 16:9 illustration area */}
                    <div
                      className="aspect-video flex items-center justify-center"
                      style={{ background: card.gradient }}
                    >
                      <Icon className="w-12 h-12 opacity-40" style={{ color: card.iconColor }} />
                    </div>
                    {/* Title */}
                    <div className="px-5 pt-4 pb-2">
                      <h3 className="font-display text-base font-semibold text-neutral-950">{card.title}</h3>
                    </div>
                    {/* Link list */}
                    <div className="pb-3">
                      {card.links.map((link, i) => (
                        <button
                          key={link.path + i}
                          onClick={() => navigate(link.path, 'state' in link ? { state: link.state } : undefined)}
                          className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-neutral-50 active:bg-neutral-100 transition-colors text-left"
                        >
                          <span className="text-sm text-neutral-600">{link.label}</span>
                          <svg className="w-4 h-4 text-neutral-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Latest news */}
          <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5 h-fit">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Latest News</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[10px] text-neutral-400">
                    {newsFetchedAt
                      ? `Updated on ${newsFetchedAt.toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`
                      : 'Fetching…'}
                  </p>
                  <button
                    onClick={() => loadNews(true)}
                    disabled={newsLoading}
                    className="text-[10px] text-neutral-400 hover:text-neutral-700 underline transition disabled:opacity-40"
                  >
                    {newsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
              </div>
              <button
                onClick={() => navigate('/news-bank')}
                className="text-[12px] text-neutral-500 hover:text-neutral-950 transition-colors flex items-center gap-1"
              >
                See all
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {newsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-1.5">
                    <div className="h-3 bg-neutral-100 rounded w-4/5" />
                    <div className="h-2.5 bg-neutral-100 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : news.length === 0 ? (
              <p className="text-sm text-neutral-400">No news available.</p>
            ) : (
              <div className="space-y-3">
                {news.map((article, i) => (
                  <div
                    key={`${article.url}-${i}`}
                    className="border-b border-neutral-50 last:border-0 pb-3 last:pb-0"
                  >
                    <div className="flex gap-3">
                      {/* 16:9 thumbnail */}
                      <div className="w-28 aspect-video shrink-0 rounded-lg bg-neutral-100 overflow-hidden">
                        {article.imageUrl ? (
                          <img
                            src={article.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                          />
                        ) : (
                          <span className="flex items-center justify-center h-full text-[10px] text-neutral-300">No image</span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-neutral-400 mb-0.5">
                          <span className={`font-semibold ${article.isCompetitor ? 'text-amber-600' : 'text-blue-600'}`}>{article.sourceBrand}</span>
                          {' · '}{formatMYT(article.publishedAt)}
                        </p>
                        <p className="text-sm font-semibold text-neutral-900 leading-snug line-clamp-2">
                          {article.title}
                        </p>
                      </div>
                    </div>
                    {/* CTA */}
                    <div className="mt-2 flex items-center justify-between">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition"
                      >
                        Read article <IconExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => navigate('/article-to-social', { state: { articleUrl: article.url } })}
                        className="text-xs font-semibold text-neutral-950 hover:text-neutral-600 transition"
                      >
                        Generate Post →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
