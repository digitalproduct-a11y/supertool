import { useState, useMemo } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { filterDashboardData, aggregateByWeek, aggregateByMonth } from '../utils/dashboardUtils'
import type { DashboardRow } from '../utils/dashboardUtils'
import { RevenueChart } from '../components/RevenueChart'
import { PostsChart } from '../components/PostsChart'
import { RangeCalendarPicker } from '../components/RangeCalendarPicker'
import { BackButton } from '../components/ds'

export function DiagnosisPage() {
  const { data, targets, loading, lastUpdated, refetch } = useDashboardData()
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); d.setHours(0, 0, 0, 0); return d
  })
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d
  })
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [metric, setMetric] = useState<'revenue' | 'posts'>('revenue')
  const [showCalendar, setShowCalendar] = useState(false)
  const [showBrandBreakdown, setShowBrandBreakdown] = useState(false)
  const [selectedBU, setSelectedBU] = useState<string | null>(null)

  const BUSINESS_UNIT_LABELS: Record<string, string> = {
    'AASB': 'Astro',
    'MBNS': 'Astro',
    'ARSB': 'Astro Radio',
    'NISB': 'Nu Ideaktiv',
  }

  // Extract unique brands from data and get their targets
  const brandsWithTargets = useMemo(() => {
    const seen = new Set<string>()
    const list: { brand: string; bu: string; revenueTarget: number }[] = []
    data.forEach(row => {
      if (!seen.has(row.brand)) {
        seen.add(row.brand)
        const brandTarget = targets.find(t => t.Brand === row.brand)
        const annualRevenue = brandTarget?.['Annual Revenue Target (USD)'] || 0
        const dailyRevenueTarget = annualRevenue / 365
        const target = viewMode === 'weekly' ? dailyRevenueTarget * 7 : viewMode === 'monthly' ? dailyRevenueTarget * 30 : dailyRevenueTarget
        list.push({ brand: row.brand, bu: row.business_unit, revenueTarget: target })
      }
    })
    // Sort by revenue target, highest first
    return list.sort((a, b) => b.revenueTarget - a.revenueTarget)
  }, [data, targets, viewMode])

  const businessUnits = useMemo(() => {
    const unique = new Map<string, string>()
    brandsWithTargets.forEach(b => {
      const label = BUSINESS_UNIT_LABELS[b.bu] || b.bu
      if (!unique.has(label)) unique.set(label, label)
    })
    return Array.from(unique.values())
  }, [brandsWithTargets])

  // Per-brand data
  const brandCharts = useMemo(() => {
    return brandsWithTargets.map(brandInfo => {
      const filtered = filterDashboardData(data, brandInfo.brand, startDate, endDate, brandInfo.bu)
      const chartData = viewMode === 'weekly' ? aggregateByWeek(filtered) as DashboardRow[] : viewMode === 'monthly' ? aggregateByMonth(filtered) as DashboardRow[] : filtered

      const brandTarget = targets.find(t => t.Brand === brandInfo.brand)
      const annualRevenue = brandTarget?.['Annual Revenue Target (USD)'] || 0
      const avgPostsPerDay = brandTarget?.['Avg Posts Per Day'] || 0
      const dailyRevenueTarget = annualRevenue / 365
      const dailyPostsTarget = avgPostsPerDay

      let revenueTarget = dailyRevenueTarget
      let postsTarget = dailyPostsTarget
      let targetLabel = 'DAILY TARGET'

      if (viewMode === 'weekly') {
        revenueTarget = dailyRevenueTarget * 7
        postsTarget = dailyPostsTarget * 7
        targetLabel = 'WEEKLY TARGET'
      } else if (viewMode === 'monthly') {
        revenueTarget = dailyRevenueTarget * 30
        postsTarget = dailyPostsTarget * 30
        targetLabel = 'MONTHLY TARGET'
      }

      return {
        brand: brandInfo.brand,
        data: chartData,
        targetData: {
          dailyRevenue: dailyRevenueTarget,
          dailyPosts: dailyPostsTarget,
          revenueTarget,
          postsTarget,
          targetLabel,
          interactions: null,
        },
      }
    })
  }, [brandsWithTargets, data, targets, startDate, endDate, viewMode])

  const filteredBrandCharts = useMemo(() => {
    if (!selectedBU) return []
    return brandCharts.filter(chart => {
      const label = BUSINESS_UNIT_LABELS[chart.data[0]?.business_unit] || chart.data[0]?.business_unit
      return label === selectedBU
    })
  }, [brandCharts, selectedBU, BUSINESS_UNIT_LABELS])

  // Aggregate all brands data by summing individual brand aggregates
  const allBrandsData = useMemo(() => {
    if (brandCharts.length === 0) return []

    // Collect all aggregated rows from each brand
    const allRows: DashboardRow[] = []
    brandCharts.forEach(chart => {
      allRows.push(...chart.data)
    })

    // Group by week/month/day, keyed off the real date (not the text month
    // label, which can vary — "Mar-26" vs "March-26"). For weekly/monthly the
    // aggregators expose `_sortDate` (the bucket's earliest ISO date); we key by
    // its YYYY-MM (+ week number) so label variants of the same period merge.
    const grouped = new Map<string, DashboardRow[]>()
    allRows.forEach(row => {
      const sortDate = (row as any)._sortDate as string | undefined
      let key: string
      if (viewMode === 'weekly') {
        const ym = sortDate ? sortDate.slice(0, 7) : row.month
        const weekNum = (row.week || '').replace(/\D/g, '')
        key = `${ym}|${weekNum}`
      } else if (viewMode === 'monthly') {
        key = sortDate ? sortDate.slice(0, 7) : row.week
      } else {
        key = row.date
      }
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    })

    // Sum across all brands for each period, ordered by real calendar date.
    const bucketDate = (rows: DashboardRow[]): string =>
      rows.reduce((m, r) => {
        const d = ((r as any)._sortDate as string | undefined) || r.date
        return d < m ? d : m
      }, ((rows[0] as any)._sortDate as string | undefined) || rows[0].date)

    const entries = Array.from(grouped.entries()).sort(([, rowsA], [, rowsB]) =>
      bucketDate(rowsA).localeCompare(bucketDate(rowsB))
    )

    return entries
      .map(([, rows]) => {
        const row0 = rows[0]
        return {
          ...row0,
          date: row0.date,
          total_posts: rows.reduce((s, r) => s + r.total_posts, 0),
          photo_posts: rows.reduce((s, r) => s + r.photo_posts, 0),
          video_posts: rows.reduce((s, r) => s + r.video_posts, 0),
          text_link_posts: rows.reduce((s, r) => s + r.text_link_posts, 0),
          total_interactions: rows.reduce((s, r) => s + r.total_interactions, 0),
          reactions: rows.reduce((s, r) => s + r.reactions, 0),
          comments: rows.reduce((s, r) => s + r.comments, 0),
          shares: rows.reduce((s, r) => s + r.shares, 0),
          total_revenue: rows.reduce((s, r) => s + r.total_revenue, 0),
          bonus_revenue: rows.reduce((s, r) => s + r.bonus_revenue, 0),
          photo_revenue: rows.reduce((s, r) => s + r.photo_revenue, 0),
          video_revenue: rows.reduce((s, r) => s + r.video_revenue, 0),
          story_revenue: rows.reduce((s, r) => s + r.story_revenue, 0),
          text_link_revenue: rows.reduce((s, r) => s + r.text_link_revenue, 0),
        }
      })
  }, [brandCharts, viewMode])

  // Calculate overall targets
  const overallTargetData = useMemo(() => {
    let totalRevenueTarget = 0
    let totalPostsTarget = 0
    let targetLabel = 'DAILY TARGET'

    targets.forEach(t => {
      const annualRevenue = t['Annual Revenue Target (USD)'] || 0
      const avgPostsPerDay = t['Avg Posts Per Day'] || 0
      totalRevenueTarget += annualRevenue / 365
      totalPostsTarget += avgPostsPerDay
    })

    if (viewMode === 'weekly') {
      totalRevenueTarget *= 7
      totalPostsTarget *= 7
      targetLabel = 'WEEKLY TARGET'
    } else if (viewMode === 'monthly') {
      totalRevenueTarget *= 30
      totalPostsTarget *= 30
      targetLabel = 'MONTHLY TARGET'
    }

    return {
      dailyRevenue: totalRevenueTarget / (viewMode === 'weekly' ? 7 : viewMode === 'monthly' ? 30 : 1),
      dailyPosts: totalPostsTarget / (viewMode === 'weekly' ? 7 : viewMode === 'monthly' ? 30 : 1),
      revenueTarget: totalRevenueTarget,
      postsTarget: totalPostsTarget,
      targetLabel,
      interactions: null,
    }
  }, [targets, viewMode])

  if (loading) {
    return (
      <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-700 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">Loading diagnosis data...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <BackButton />
                <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Diagnosis</h1>
              </div>
              <p className="text-neutral-500 text-sm">Performance across all brands</p>
            </div>
          </div>
          <div className="h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* Controls */}
        <div className="sticky top-0 z-40 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4 mb-2 flex gap-3 flex-col sm:flex-row items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-wrap items-center">
            {/* Metric selector */}
            <div className="inline-flex bg-neutral-100 rounded-lg p-1">
              <button
                onClick={() => setMetric('revenue')}
                className={`px-3 py-2 text-sm font-medium rounded transition ${metric === 'revenue' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'}`}
              >
                Revenue
              </button>
              <button
                onClick={() => setMetric('posts')}
                className={`px-3 py-2 text-sm font-medium rounded transition ${metric === 'posts' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'}`}
              >
                Posts
              </button>
            </div>

            {/* View mode selector */}
            <div className="inline-flex bg-neutral-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-3 py-2 text-sm font-medium rounded transition ${viewMode === 'daily' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'}`}
              >
                Daily
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-2 text-sm font-medium rounded transition ${viewMode === 'weekly' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'}`}
              >
                Weekly
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-2 text-sm font-medium rounded transition ${viewMode === 'monthly' ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'}`}
              >
                Monthly
              </button>
            </div>
          </div>

          {/* Date range button */}
          <div className="relative">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition"
            >
              {startDate.toLocaleDateString()} – {endDate.toLocaleDateString()}
            </button>
            {showCalendar && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-lg border border-neutral-200 p-6">
                <RangeCalendarPicker
                  startDate={startDate}
                  endDate={endDate}
                  onRangeChange={(start, end) => {
                    setStartDate(start)
                    setEndDate(end)
                    setShowCalendar(false)
                  }}
                  minDate={new Date(2026, 0, 2)}
                  maxDate={new Date()}
                />
              </div>
            )}
          </div>
        </div>

        {/* Overall chart */}
        <div className="mb-8">
          {metric === 'revenue' ? (
            <RevenueChart
              data={allBrandsData}
              targetData={overallTargetData}
              showTargets={true}
              brand="All Brands"
              onRefetch={refetch}
              title="All Brands"
              showUpload={false}
            />
          ) : (
            <PostsChart
              data={allBrandsData}
              targetData={overallTargetData}
              showTargets={true}
              title="All Brands"
            />
          )}
        </div>

        {/* Brand breakdown */}
        <div>
          <button
            onClick={() => {
              setShowBrandBreakdown(!showBrandBreakdown)
              if (!showBrandBreakdown && !selectedBU && businessUnits.length > 0) {
                setSelectedBU(businessUnits[0])
              }
            }}
            className="flex items-center gap-2 text-lg font-semibold text-neutral-950 mb-4 hover:text-neutral-600 transition"
          >
            <svg className={`w-5 h-5 transition ${showBrandBreakdown ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            By Brand
          </button>
          {showBrandBreakdown && (
            <div className="space-y-6">
              {/* Business Unit tabs */}
              <div className="flex gap-2 border-b border-neutral-200">
                {businessUnits.map(bu => (
                  <button
                    key={bu}
                    onClick={() => setSelectedBU(bu)}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                      selectedBU === bu
                        ? 'text-neutral-950 border-neutral-950'
                        : 'text-neutral-600 border-transparent hover:text-neutral-950'
                    }`}
                  >
                    {bu}
                  </button>
                ))}
              </div>

              {/* Brand charts for selected BU */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {filteredBrandCharts.map(chart => (
                  <div key={chart.brand}>
                    {metric === 'revenue' ? (
                      <RevenueChart
                        data={chart.data}
                        targetData={chart.targetData}
                        showTargets={true}
                        brand={chart.brand}
                        onRefetch={refetch}
                        title={chart.brand}
                        showUpload={false}
                      />
                    ) : (
                      <PostsChart
                        data={chart.data}
                        targetData={chart.targetData}
                        showTargets={true}
                        title={chart.brand}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {lastUpdated && (
          <div className="mt-8 text-xs text-neutral-500 text-center">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </div>
        )}
      </div>
    </main>
  )
}
