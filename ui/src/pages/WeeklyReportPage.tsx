import { useMemo, useState, useRef, useEffect } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useBrand } from '../context/BrandContext'
import { WeeklyReportTable } from '../components/WeeklyReportTable'
import { BackButton } from '../components/ds'

type SortBy = 'brand-name' | 'revenue-decline' | 'revenue-improvement' | 'revenue-decline-amount' | 'revenue-improvement-amount' | 'posts-decline' | 'posts-improvement' | 'posts-decline-amount' | 'posts-improvement-amount'

const SORT_OPTIONS: Array<{ value: SortBy; label: string; group: string }> = [
  { value: 'brand-name', label: 'Brand Name', group: 'Default' },
  { value: 'revenue-decline', label: 'Biggest Revenue Decline %', group: 'Revenue' },
  { value: 'revenue-improvement', label: 'Biggest Revenue Improvement %', group: 'Revenue' },
  { value: 'revenue-decline-amount', label: 'Biggest Revenue Decline $', group: 'Revenue' },
  { value: 'revenue-improvement-amount', label: 'Biggest Revenue Improved $', group: 'Revenue' },
  { value: 'posts-decline', label: 'Biggest Posts Decline %', group: 'Posts' },
  { value: 'posts-improvement', label: 'Biggest Posts Improvement %', group: 'Posts' },
  { value: 'posts-decline-amount', label: 'Biggest Posts Decline #', group: 'Posts' },
  { value: 'posts-improvement-amount', label: 'Biggest Posts Improved #', group: 'Posts' },
]

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

function toInput(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function WeeklyReportPage() {
  const { data, targets } = useDashboardData()
  const { isAdmin } = useBrand()
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('brand-name')
  const [showSortModal, setShowSortModal] = useState(false)
  const sortModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortModalRef.current && !sortModalRef.current.contains(e.target as Node)) {
        setShowSortModal(false)
      }
    }
    if (showSortModal) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [showSortModal])

  const weekStart = useMemo(() => selectedWeekStart, [selectedWeekStart])
  const weekEnd = useMemo(() => weekStart ? getWeekEnd(weekStart) : null, [weekStart])
  const prevWeekStart = useMemo(() => {
    if (!weekStart) return null
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    return d
  }, [weekStart])
  const prevWeekEnd = useMemo(() => prevWeekStart ? getWeekEnd(prevWeekStart) : null, [prevWeekStart])

  // Filter data for each period
  const thisWeekData = useMemo(() => {
    if (!weekStart || !weekEnd) return []
    return data.filter(row => {
      const rowDate = new Date(row.date)
      return rowDate >= weekStart && rowDate <= weekEnd
    })
  }, [data, weekStart, weekEnd])

  const prevWeekData = useMemo(() => {
    if (!prevWeekStart || !prevWeekEnd) return []
    return data.filter(row => {
      const rowDate = new Date(row.date)
      return rowDate >= prevWeekStart && rowDate <= prevWeekEnd
    })
  }, [data, prevWeekStart, prevWeekEnd])

  const weekLabel = useMemo(() => {
    if (!weekStart || !weekEnd) return 'Select a week'
    const end = new Date(weekEnd)
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }, [weekStart, weekEnd])

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const current = {
      posts: thisWeekData.reduce((s, r) => s + (r.total_posts || 0), 0),
      revenue: thisWeekData.reduce((s, r) => s + (r.total_revenue || 0), 0),
      interactions: thisWeekData.reduce((s, r) => s + (r.total_interactions || 0), 0),
    }
    const previous = {
      posts: prevWeekData.reduce((s, r) => s + (r.total_posts || 0), 0),
      revenue: prevWeekData.reduce((s, r) => s + (r.total_revenue || 0), 0),
      interactions: prevWeekData.reduce((s, r) => s + (r.total_interactions || 0), 0),
    }
    const postWoW = previous.posts > 0 ? ((current.posts - previous.posts) / previous.posts) * 100 : 0
    const revenueWoW = previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0
    const interactionsWoW = previous.interactions > 0 ? ((current.interactions - previous.interactions) / previous.interactions) * 100 : 0

    return { current, previous, postWoW, revenueWoW, interactionsWoW }
  }, [thisWeekData, prevWeekData])

  // Get target data for the week
  const totalTargets = useMemo(() => {
    const dailyRevenueTarget = targets.reduce((sum, t) => sum + (t['Annual Revenue Target (USD)'] / 365), 0)
    const dailyPostsTarget = targets.reduce((sum, t) => sum + (t['Avg Posts Per Day'] || 0), 0)
    return {
      posts: Math.round(dailyPostsTarget * 7),
      revenue: Math.round(dailyRevenueTarget * 7),
    }
  }, [targets])

  if (!isAdmin) {
    return (
      <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-neutral-500">This feature is only available for admins.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-4">
            <BackButton />
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                Weekly Revenue Report
              </h1>
              <p className="text-neutral-500 mt-1 text-sm">
                {weekLabel}
              </p>
            </div>
          </div>
          <div
            className="h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Week picker */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4 mb-8">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-neutral-700">Select week:</label>
            <input
              type="date"
              value={selectedWeekStart ? toInput(selectedWeekStart) : ''}
              onChange={(e) => {
                const newDate = new Date(e.target.value)
                newDate.setHours(0, 0, 0, 0)
                setSelectedWeekStart(newDate)
              }}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
            />
          </div>
        </div>

        {!selectedWeekStart && (
          <div className="text-center py-12">
            <p className="text-neutral-500">Select a week to view the report</p>
          </div>
        )}

        {selectedWeekStart && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Revenue */}
              <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                <p className="text-xs text-neutral-500 uppercase font-medium mb-3">Revenue</p>
                <div className="flex items-baseline gap-2 mb-4">
                  <p className="text-2xl font-semibold text-neutral-950">${(summaryMetrics.current.revenue / 1000).toFixed(1)}K</p>
                  <span className={`text-sm font-medium ${summaryMetrics.revenueWoW >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summaryMetrics.revenueWoW >= 0 ? '↑' : '↓'}{Math.abs(summaryMetrics.revenueWoW).toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-neutral-600 mb-1">
                    <span>Actual vs Target</span>
                    <span>{((summaryMetrics.current.revenue / totalTargets.revenue) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(100, (summaryMetrics.current.revenue / totalTargets.revenue) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">Target: ${(totalTargets.revenue / 1000).toFixed(0)}K</p>
                </div>
              </div>

              {/* Posts */}
              <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                <p className="text-xs text-neutral-500 uppercase font-medium mb-3">Posts</p>
                <div className="flex items-baseline gap-2 mb-4">
                  <p className="text-2xl font-semibold text-neutral-950">{summaryMetrics.current.posts}</p>
                  <span className={`text-sm font-medium ${summaryMetrics.postWoW >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summaryMetrics.postWoW >= 0 ? '↑' : '↓'}{Math.abs(summaryMetrics.postWoW).toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-neutral-600 mb-1">
                    <span>Actual vs Target</span>
                    <span>{((summaryMetrics.current.posts / totalTargets.posts) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, (summaryMetrics.current.posts / totalTargets.posts) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">Target: {totalTargets.posts}</p>
                </div>
              </div>

              {/* Interactions */}
              <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                <p className="text-xs text-neutral-500 uppercase font-medium mb-3">Interactions</p>
                <div className="flex flex-col mb-4">
                  <p className="text-2xl font-semibold text-neutral-950">{(summaryMetrics.current.interactions / 1000).toFixed(1)}K</p>
                  <span className={`text-sm font-medium ${summaryMetrics.interactionsWoW >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summaryMetrics.interactionsWoW >= 0 ? '↑' : '↓'}{Math.abs(summaryMetrics.interactionsWoW).toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500">vs previous week</p>
                  <p className="text-xs text-neutral-500">Previous: {(summaryMetrics.previous.interactions / 1000).toFixed(1)}K</p>
                </div>
              </div>

            </div>

            {/* AI Summary - Coming Soon */}
            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden mb-8">
              <div
                className="h-1"
                style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
              />
              <div className="px-6 py-8 text-center">
                <svg className="w-6 h-6 mx-auto mb-3 text-neutral-950" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-neutral-700 font-medium">AI-Powered Revenue Insights (Coming Soon)</p>
              </div>
            </div>

            {/* Main table */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-950">Performance by Brand</h2>

                {/* Sort button and modal */}
                <div className="relative" ref={sortModalRef}>
                  <button
                    onClick={() => setShowSortModal(!showSortModal)}
                    className="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm font-medium bg-white cursor-pointer hover:bg-neutral-50 transition flex items-center gap-2"
                  >
                    Sort by: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
                    <svg className={`w-3 h-3 transition ${showSortModal ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {showSortModal && (
                    <div className="absolute top-full right-0 mt-2 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg p-6" style={{ width: '600px' }}>
                      <div className="grid grid-cols-3 gap-6">
                        {['Default', 'Revenue', 'Posts'].map(group => {
                          const groupOptions = SORT_OPTIONS.filter(o => o.group === group)
                          return (
                            <div key={group}>
                              <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-widest pb-2 border-b border-neutral-200 mb-3">
                                {group === 'Default' ? 'DEFAULT' : group}
                              </h3>
                              <div className="space-y-1">
                                {groupOptions.map(option => (
                                  <button
                                    key={option.value}
                                    onClick={() => {
                                      setSortBy(option.value)
                                      setShowSortModal(false)
                                    }}
                                    className={`w-full px-2 py-1.5 text-xs text-left rounded transition flex items-center justify-between ${
                                      sortBy === option.value
                                        ? 'text-neutral-950 font-medium bg-neutral-100'
                                        : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
                                    }`}
                                  >
                                    {option.label}
                                    {sortBy === option.value && (
                                      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                      </svg>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <WeeklyReportTable
                data={thisWeekData}
                prevWeekData={prevWeekData}
                targets={targets}
                sortBy={sortBy}
              />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
