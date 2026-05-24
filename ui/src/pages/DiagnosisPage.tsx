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
    const d = new Date(2026, 0, 2); d.setHours(0, 0, 0, 0); return d
  })
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d
  })
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [metric, setMetric] = useState<'revenue' | 'posts'>('revenue')
  const [showCalendar, setShowCalendar] = useState(false)

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

  // Aggregate all brands data by summing individual brand aggregates
  const allBrandsData = useMemo(() => {
    if (brandCharts.length === 0) return []

    // Collect all aggregated rows from each brand
    const allRows: DashboardRow[] = []
    brandCharts.forEach(chart => {
      allRows.push(...chart.data)
    })

    // Group by week/month and sum
    const grouped = new Map<string, DashboardRow[]>()
    allRows.forEach(row => {
      const key = viewMode === 'weekly' ? `${row.month}|${row.week}` : row.month
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    })

    // Sum across all brands for each period
    return Array.from(grouped.values()).map(rows => {
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
    }).sort((a, b) => {
      // Sort by month first, then by week number
      const monthCompare = a.month.localeCompare(b.month)
      if (monthCompare !== 0) return monthCompare
      // Extract week number from "Week1", "Week2", etc.
      const aWeekNum = parseInt(a.week.replace('Week', ''), 10)
      const bWeekNum = parseInt(b.week.replace('Week', ''), 10)
      return aWeekNum - bWeekNum
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
        <div className="mb-8">
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
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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
            />
          )}
        </div>

        {/* Brand breakdown grid */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 mb-4">By Brand</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {brandCharts.map(chart => (
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
                  />
                )}
              </div>
            ))}
          </div>
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
