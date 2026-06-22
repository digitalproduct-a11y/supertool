import { useMemo, useState, useRef, useEffect } from 'react'
import { useYouTubeDashboardData } from '../hooks/useYouTubeDashboardData'
import { useBrand } from '../context/BrandContext'
import { YouTubeWeeklyReportTable, type SortBy } from '../components/YouTubeWeeklyReportTable'
import { BackButton } from '../components/ds'

const SORT_OPTIONS: Array<{ value: SortBy; label: string; group: string }> = [
  { value: 'brand-name', label: 'Brand Name', group: 'Default' },
  { value: 'revenue-decline', label: 'Biggest Revenue Decline %', group: 'Revenue' },
  { value: 'revenue-improvement', label: 'Biggest Revenue Improvement %', group: 'Revenue' },
  { value: 'revenue-decline-amount', label: 'Biggest Revenue Decline $', group: 'Revenue' },
  { value: 'revenue-improvement-amount', label: 'Biggest Revenue Improved $', group: 'Revenue' },
  { value: 'videos-decline', label: 'Biggest Videos Decline %', group: 'Videos' },
  { value: 'videos-improvement', label: 'Biggest Videos Improvement %', group: 'Videos' },
  { value: 'videos-decline-amount', label: 'Biggest Videos Decline #', group: 'Videos' },
  { value: 'videos-improvement-amount', label: 'Biggest Videos Improved #', group: 'Videos' },
  { value: 'watch-decline', label: 'Biggest Watch Time Decline %', group: 'Watch Time' },
  { value: 'watch-improvement', label: 'Biggest Watch Time Improvement %', group: 'Watch Time' },
  { value: 'watch-decline-amount', label: 'Biggest Watch Time Decline (h)', group: 'Watch Time' },
  { value: 'watch-improvement-amount', label: 'Biggest Watch Time Improved (h)', group: 'Watch Time' },
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

function formatHours(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${Math.round(n)}`
}

export function YouTubeWeeklyReportPage() {
  const { data, targets } = useYouTubeDashboardData()
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

  const weekStart = selectedWeekStart
  const weekEnd = useMemo(() => weekStart ? getWeekEnd(weekStart) : null, [weekStart])
  const prevWeekStart = useMemo(() => {
    if (!weekStart) return null
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    return d
  }, [weekStart])
  const prevWeekEnd = useMemo(() => prevWeekStart ? getWeekEnd(prevWeekStart) : null, [prevWeekStart])

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

  const summaryMetrics = useMemo(() => {
    const current = {
      videos: thisWeekData.reduce((s, r) => s + (Number(r.videos_published) || 0), 0),
      watch: thisWeekData.reduce((s, r) => s + (Number(r.watch_time) || 0), 0),
      revenue: thisWeekData.reduce((s, r) => s + (Number(r.revenue) || 0), 0),
    }
    const previous = {
      videos: prevWeekData.reduce((s, r) => s + (Number(r.videos_published) || 0), 0),
      watch: prevWeekData.reduce((s, r) => s + (Number(r.watch_time) || 0), 0),
      revenue: prevWeekData.reduce((s, r) => s + (Number(r.revenue) || 0), 0),
    }
    const videosWoW = previous.videos > 0 ? ((current.videos - previous.videos) / previous.videos) * 100 : 0
    const watchWoW = previous.watch > 0 ? ((current.watch - previous.watch) / previous.watch) * 100 : 0
    const revenueWoW = previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0

    return { current, previous, videosWoW, watchWoW, revenueWoW }
  }, [thisWeekData, prevWeekData])

  const totalTargets = useMemo(() => {
    const revenue = targets.reduce((sum, t) => sum + ((Number(t['Annual Revenue Target (USD)']) || 0) / 365), 0) * 7
    const videos = targets.reduce((sum, t) => sum + (Number(t['Avg Vids Per Day\n2026 Target']) || 0), 0) * 7
    const watch = targets.reduce((sum, t) => sum + (Number(t['Daily Avg Watch Hour']) || 0), 0) * 7
    return {
      revenue: Math.round(revenue),
      videos: Math.round(videos),
      watch: Math.round(watch),
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
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <BackButton />
              <div>
                <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                  YouTube Weekly Report
                </h1>
                <p className="text-neutral-500 mt-1 text-sm">
                  {weekLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-neutral-700 whitespace-nowrap">Select week:</label>
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
          <div
            className="h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF0000, #FF3FBF, #00E5D4, #0055EE)' }}
          />
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
                  <p className="text-2xl font-semibold text-neutral-950">${summaryMetrics.current.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <span className={`text-sm font-medium ${summaryMetrics.revenueWoW >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summaryMetrics.revenueWoW >= 0 ? '↑' : '↓'}{Math.abs(summaryMetrics.revenueWoW).toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-neutral-600 mb-1">
                    <span>Actual vs Target</span>
                    <span>{totalTargets.revenue > 0 ? ((summaryMetrics.current.revenue / totalTargets.revenue) * 100).toFixed(0) : '0'}%</span>
                  </div>
                  <div className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${totalTargets.revenue > 0 ? Math.min(100, (summaryMetrics.current.revenue / totalTargets.revenue) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">Target: ${totalTargets.revenue.toLocaleString()}</p>
                </div>
              </div>

              {/* Videos Published */}
              <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                <p className="text-xs text-neutral-500 uppercase font-medium mb-3">Videos Published</p>
                <div className="flex items-baseline gap-2 mb-4">
                  <p className="text-2xl font-semibold text-neutral-950">{summaryMetrics.current.videos.toLocaleString()}</p>
                  <span className={`text-sm font-medium ${summaryMetrics.videosWoW >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summaryMetrics.videosWoW >= 0 ? '↑' : '↓'}{Math.abs(summaryMetrics.videosWoW).toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-neutral-600 mb-1">
                    <span>Actual vs Target</span>
                    <span>{totalTargets.videos > 0 ? ((summaryMetrics.current.videos / totalTargets.videos) * 100).toFixed(0) : '0'}%</span>
                  </div>
                  <div className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink-500"
                      style={{ width: `${totalTargets.videos > 0 ? Math.min(100, (summaryMetrics.current.videos / totalTargets.videos) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">Target: {totalTargets.videos.toLocaleString()}</p>
                </div>
              </div>

              {/* Watch Time */}
              <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                <p className="text-xs text-neutral-500 uppercase font-medium mb-3">Watch Time (hrs)</p>
                <div className="flex items-baseline gap-2 mb-4">
                  <p className="text-2xl font-semibold text-neutral-950">{formatHours(summaryMetrics.current.watch)}h</p>
                  <span className={`text-sm font-medium ${summaryMetrics.watchWoW >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summaryMetrics.watchWoW >= 0 ? '↑' : '↓'}{Math.abs(summaryMetrics.watchWoW).toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-neutral-600 mb-1">
                    <span>Actual vs Target</span>
                    <span>{totalTargets.watch > 0 ? ((summaryMetrics.current.watch / totalTargets.watch) * 100).toFixed(0) : '0'}%</span>
                  </div>
                  <div className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500"
                      style={{ width: `${totalTargets.watch > 0 ? Math.min(100, (summaryMetrics.current.watch / totalTargets.watch) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">Target: {formatHours(totalTargets.watch)}h</p>
                </div>
              </div>
            </div>

            {/* Main table */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-950">Performance by Brand</h2>

                <div className="flex items-center gap-3">
                  {/* Sort button and modal */}
                  <div className="relative" ref={sortModalRef}>
                    <button
                      onClick={() => setShowSortModal(!showSortModal)}
                      className="px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition border-neutral-200 bg-white text-neutral-700 cursor-pointer hover:bg-neutral-50"
                    >
                      Sort by: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
                      <svg className={`w-3 h-3 transition ${showSortModal ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {showSortModal && (
                      <div className="absolute top-full right-0 mt-2 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg p-6" style={{ width: '780px' }}>
                        <div className="grid grid-cols-4 gap-6">
                          {['Default', 'Revenue', 'Videos', 'Watch Time'].map(group => {
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
              </div>
              <YouTubeWeeklyReportTable
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
