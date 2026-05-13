import { useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { IconExternalLink } from '@tabler/icons-react'
import { useDashboardData } from '../hooks/useDashboardData'
import { filterDashboardData } from '../utils/dashboardUtils'
import { useBrand } from '../context/BrandContext'
import { useNavigate } from 'react-router-dom'

interface HomePageProps {
  onToolSelect: (id: string) => void
}

// ── News feed types (mirrors LatestNewsTab shape) ─────────────────────────────

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

interface BrandFeedData {
  brand: string
  articles: RssArticle[]
}

function getNewsCacheKey(prefix: string): string {
  const bucket = Math.floor(Date.now() / 900_000) // 15-min window
  return `${prefix}_home_${bucket}`
}

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

async function fetchInHouseNews(): Promise<ArticleWithBrand[]> {
  const cached = sessionStorage.getItem(getNewsCacheKey('inhouse'))
  if (cached) {
    try { return JSON.parse(cached) as ArticleWithBrand[] } catch { /* skip */ }
  }
  const url = (import.meta.env.VITE_RSS_LATEST_WEBHOOK_URL as string | undefined)?.trim()
  if (!url) return []
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
  if (!res.ok) return []
  const data = await res.json() as BrandFeedData[]
  const articles: ArticleWithBrand[] = data.flatMap(feed =>
    (feed.articles ?? []).map(a => ({ ...a, sourceBrand: feed.brand, isCompetitor: false }))
  )
  try { sessionStorage.setItem(getNewsCacheKey('inhouse'), JSON.stringify(articles)) } catch { /* quota */ }
  return articles
}

async function fetchCompetitorNews(): Promise<ArticleWithBrand[]> {
  const cached = sessionStorage.getItem(getNewsCacheKey('competitor'))
  if (cached) {
    try { return JSON.parse(cached) as ArticleWithBrand[] } catch { /* skip */ }
  }
  const url = (import.meta.env.VITE_RSS_COMPETITOR_WEBHOOK_URL as string | undefined)?.trim()
  if (!url) return []
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
  if (!res.ok) return []
  const data = await res.json() as BrandFeedData[]
  const articles: ArticleWithBrand[] = data.flatMap(feed =>
    (feed.articles ?? []).map(a => ({ ...a, sourceBrand: feed.brand, isCompetitor: true }))
  )
  try { sessionStorage.setItem(getNewsCacheKey('competitor'), JSON.stringify(articles)) } catch { /* quota */ }
  return articles
}

// ── Nav row component ─────────────────────────────────────────────────────────

function NavRow({ label, image, onClick }: { label: string; image?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 active:bg-neutral-100 transition-colors text-left"
    >
      {image ? (
        <img src={image} alt={label} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-neutral-100 flex-shrink-0" />
      )}
      <span className="flex-1 text-sm font-semibold text-neutral-900">{label}</span>
      <svg className="w-4 h-4 text-neutral-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

// ── Engagement quick-link groups ──────────────────────────────────────────────

const ENGAGEMENT_GROUPS = [
  {
    label: 'Fun Fact',
    links: [
      { label: 'Did You Know?', path: '/engagement-posts/didyouknow', image: '' },
    ],
  },
  {
    label: 'Sports',
    links: [
      { label: 'EPL', path: '/engagement-posts/epl', image: '' },
      { label: 'Champions League', path: '/engagement-posts/ucl', image: '' },
      { label: 'Badminton', path: '/engagement-posts/badminton', image: '' },
      { label: 'MotoGP', path: '/engagement-posts/motogp', image: '' },
    ],
  },
  {
    label: 'Information',
    links: [
      { label: 'KLCI Index', path: '/engagement-posts/klci-index', image: '' },
      { label: 'Currency Rate', path: '/engagement-posts/latest-currency-rate', image: '' },
      { label: 'Fuel Price', path: '/engagement-posts/latest-fuel-price', image: '' },
      { label: 'On This Day', path: '/engagement-posts/on-this-day-malaysia', image: '' },
      { label: 'Weather Malaysia', path: '/engagement-posts/weather-malaysia', image: '' },
    ],
  },
]

// ── Main component ─────────────────────────────────────────────────────────────

export function HomePage({ onToolSelect: _onToolSelect }: HomePageProps) {
  const { selectedBrand, isAdmin } = useBrand()
  const navigate = useNavigate()
  const { data, targets, loading } = useDashboardData()

  // Use the latest date in the dataset as the window end (falls back to today)
  const latestDate = data.length > 0
    ? data.reduce((max, r) => r.date > max ? r.date : max, data[0].date)
    : null
  const endDate = latestDate ? new Date(latestDate) : new Date()
  endDate.setHours(23, 59, 59, 999)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 30)
  startDate.setHours(0, 0, 0, 0)

  // Filter data
  const filtered = isAdmin
    ? data.filter(row => new Date(row.date) >= startDate && new Date(row.date) <= endDate)
    : selectedBrand
      ? filterDashboardData(data, selectedBrand, startDate, endDate)
      : []

  // Sort by date asc for sparklines
  const sparkRows = [...filtered].sort((a, b) => a.date.localeCompare(b.date))

  // 30-day totals
  const totalPosts = filtered.reduce((s, r) => s + (r.total_posts || 0), 0)
  const totalRevenue = filtered.reduce((s, r) => s + (r.total_revenue || 0), 0)
  const totalInteractions = filtered.reduce((s, r) => s + (r.total_interactions || 0), 0)
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
      footer: dataFooter,
      sparkData: toSparkData(sparkRows.map(r => ({ v: r.total_posts || 0 }))),
      color: '#0055EE',
    },
    {
      label: 'Revenue (USD)',
      value: `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      target: revenueTarget,
      actual: totalRevenue,
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
      actual: 0,
      footer: dataFooter,
      sparkData: toSparkData(sparkRows.map(r => ({ v: r.total_interactions || 0 }))),
      color: '#FF3FBF',
    },
  ]

  // News feed
  const [news, setNews] = useState<ArticleWithBrand[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([fetchInHouseNews(), fetchCompetitorNews()]).then(([inH, comp]) => {
      if (cancelled) return
      const inHouseArr = inH.status === 'fulfilled' ? inH.value : []
      const compArr = comp.status === 'fulfilled' ? comp.value : []
      const merged = [...inHouseArr, ...compArr]
        .filter(a => a.publishedAt)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 10)
      setNews(merged)
      setNewsLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Row 1: Brand header ─────────────────────────────────────────── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">KULT Digital Kit</p>
          <h1 className="font-display text-3xl font-bold text-neutral-950 mt-0.5">
            {isAdmin ? 'Admin' : (selectedBrand ?? '—')}
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
              <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Performance</p>
              <p className="text-sm font-medium text-neutral-700 mt-0.5">
                Last 30 days
                {latestDate && (
                  <span className="text-neutral-400 font-normal"> · {dateRangeLabel}</span>
                )}
              </p>
            </div>
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
                    <p className="font-display text-2xl font-bold text-neutral-950">{card.value}</p>

                    {/* Target value (posts + revenue only) */}
                    {card.target !== null && card.target > 0 ? (
                      <p className="text-[10px] text-neutral-400 mt-0.5 mb-2">
                        Target: {card.label === 'Revenue (USD)'
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

        {/* ── Row 3: 2-col layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left column: quick links */}
          <div className="space-y-4">

            {/* Combined card: Article to Social + Engagement Posts */}
            <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden">

              {/* Article to Social featured section */}
              <button
                onClick={() => navigate('/article-to-social')}
                className="w-full text-left bg-white hover:bg-neutral-50 p-5 transition-colors"
              >
                <p className="font-display text-lg font-semibold text-neutral-950">Article to Social Post</p>
                <p className="text-sm text-neutral-400 mt-1">Photo · Carousel · Quick Fact · Quote — all in one flow</p>
              </button>

              {/* Divider */}
              <div className="border-t border-neutral-100" />

              {/* Engagement quick links section */}
              <div className="p-5 space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Engagement Posts</p>
                {ENGAGEMENT_GROUPS.map((group, idx) => (
                  <div key={group.label}>
                    <p className="text-[11px] font-semibold text-neutral-400 mb-1.5">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.links.map(link => (
                        <button
                          key={link.path}
                          onClick={() => navigate(link.path)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-950 transition-colors"
                        >
                          {link.label}
                        </button>
                      ))}
                    </div>
                    {idx < ENGAGEMENT_GROUPS.length - 1 && <div className="border-t border-neutral-100 mt-4" />}
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Right column: latest news */}
          <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-4">Latest News</p>

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
                  <a
                    key={`${article.url}-${i}`}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-3 group py-2 border-b border-neutral-50 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${article.isCompetitor ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
                          {article.sourceBrand}
                        </span>
                        <span className="text-[10px] text-neutral-400">{formatRelativeTime(article.publishedAt)}</span>
                      </div>
                    </div>
                    <IconExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-1" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
