import { useState, useMemo, useEffect } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { useYouTubeDashboardData } from '../hooks/useYouTubeDashboardData'
import { YouTubeDashboardHeader } from '../components/youtube/YouTubeDashboardHeader'
import { VideosPublishedChart } from '../components/youtube/VideosPublishedChart'
import { WatchHoursChart } from '../components/youtube/WatchHoursChart'
import { YouTubeRevenueChart } from '../components/youtube/YouTubeRevenueChart'
import {
  filterYouTubeData,
  aggregateByWeek,
  aggregateByMonth,
} from '../utils/youtubeDashboardUtils'
import type { YouTubeDashboardRow } from '../utils/youtubeDashboardUtils'
import { BackButton } from '../components/ds'
import { useBrand } from '../context/BrandContext'
import { BRANDS, N8N_TO_CANONICAL_BRAND, YT_BRAND_ALIASES } from '../constants/brands'

export function YouTubeDashboardPage() {
  const { data, targets, loading, lastUpdated, refetch } = useYouTubeDashboardData()
  const { selectedBrand: globalBrand } = useBrand()
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 31); d.setHours(0,0,0,0); return d
  })
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(23,59,59,999); return d
  })
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [showComparison, setShowComparison] = useState(true)
  const [showTargets, setShowTargets] = useState(true)
  const [showMonthsModal, setShowMonthsModal] = useState(false)
  const [monthsPage, setMonthsPage] = useState(0)

  const brands = useMemo(() => {
    const stripAstro = (s: string) => s.toLowerCase().replace(/^astro\s+/, '').trim()
    const seen = new Set<string>()
    const list: { brand: string; bu: string; label: string }[] = []
    data.forEach(row => {
      if (!seen.has(row.brand)) {
        seen.add(row.brand)
        const norm = stripAstro(row.brand)
        const aliased = YT_BRAND_ALIASES[row.brand]
        const canonical = aliased ?? BRANDS.find(b => stripAstro(b) === norm)
        list.push({ brand: row.brand, bu: row.business_unit, label: canonical ?? row.brand })
      }
    })
    return list.sort((a, b) => a.label.localeCompare(b.label))
  }, [data])

  useEffect(() => {
    if (brands.length === 0) return
    if (globalBrand && globalBrand !== 'Admin') {
      const stripAstro = (s: string) => s.toLowerCase().replace(/^astro\s+/, '').trim()
      const globalNorm = stripAstro(globalBrand)
      const match = brands.find(
        b =>
          b.brand.toLowerCase() === globalBrand.toLowerCase() ||
          stripAstro(b.brand) === globalNorm ||
          N8N_TO_CANONICAL_BRAND[b.brand.toUpperCase()] === globalBrand ||
          YT_BRAND_ALIASES[b.brand] === globalBrand
      )
      if (match) {
        setSelectedBrand(match.brand)
        return
      }
    }
    setSelectedBrand(prev => prev ?? brands[0].brand)
  }, [brands, globalBrand])

  const selectedBrandInfo = brands.find(b => b.brand === selectedBrand)

  const filteredData = useMemo(() => {
    if (!selectedBrand) return []
    const bu = selectedBrandInfo?.bu || ''
    const filtered = filterYouTubeData(data, selectedBrand, startDate, endDate, bu)
    if (viewMode === 'weekly') return aggregateByWeek(filtered) as YouTubeDashboardRow[]
    if (viewMode === 'monthly') return aggregateByMonth(filtered) as YouTubeDashboardRow[]
    return filtered
  }, [data, selectedBrand, startDate, endDate, viewMode, selectedBrandInfo])

  const prevFilteredData = useMemo(() => {
    if (!showComparison || !selectedBrand) return []
    const duration = endDate.getTime() - startDate.getTime() + 86400000
    const prevEnd = new Date(startDate.getTime() - 86400000)
    const prevStart = new Date(startDate.getTime() - duration)
    const bu = selectedBrandInfo?.bu || ''
    const filtered = filterYouTubeData(data, selectedBrand, prevStart, prevEnd, bu)
    if (viewMode === 'weekly') return aggregateByWeek(filtered) as YouTubeDashboardRow[]
    if (viewMode === 'monthly') return aggregateByMonth(filtered) as YouTubeDashboardRow[]
    return filtered
  }, [showComparison, data, selectedBrand, startDate, endDate, viewMode, selectedBrandInfo])

  const targetData = useMemo(() => {
    if (!selectedBrand) return null
    const normalize = (s: string) => s.trim().toLowerCase().replace(/^astro\s+/, '')
    const normalized = normalize(selectedBrand)
    const brandTarget = targets.find(t => normalize(String(t.Brand ?? '')) === normalized)
    if (!brandTarget) return null

    const annualRevenue = Number(brandTarget['Annual Revenue Target (USD)']) || 0
    const dailyRevenue = annualRevenue / 365
    const dailyVideos = Number(brandTarget['Avg Vids Per Day']) || 0
    const dailyWatchHours = Number(brandTarget['Daily Avg Watch Hour']) || 0

    const multiplier = viewMode === 'weekly' ? 7 : viewMode === 'monthly' ? 30 : 1
    const label = viewMode === 'weekly' ? 'WEEKLY TARGET'
      : viewMode === 'monthly' ? 'MONTHLY TARGET'
      : 'DAILY TARGET'

    return {
      revenueTarget: annualRevenue > 0 ? dailyRevenue * multiplier : null,
      videosTarget: dailyVideos > 0 ? dailyVideos * multiplier : null,
      watchHoursTarget: dailyWatchHours > 0 ? dailyWatchHours * multiplier : null,
      label,
    }
  }, [selectedBrand, targets, viewMode])

  const monthToDateData = useMemo(() => {
    if (!selectedBrand) return []
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    const bu = selectedBrandInfo?.bu || ''
    return filterYouTubeData(data, selectedBrand, monthStart, today, bu)
  }, [data, selectedBrand, selectedBrandInfo])

  const monthTargetData = useMemo(() => {
    if (!selectedBrand) return null
    const normalize = (s: string) => s.trim().toLowerCase().replace(/^astro\s+/, '')
    const normalized = normalize(selectedBrand)
    const brandTarget = targets.find(t => normalize(String(t.Brand ?? '')) === normalized)
    if (!brandTarget) return null

    const annualRevenue = Number(brandTarget['Annual Revenue Target (USD)']) || 0
    const dailyWatchHours = Number(brandTarget['Daily Avg Watch Hour']) || 0

    return {
      revenueTarget: (annualRevenue / 365) * 30,
      watchHoursTarget: dailyWatchHours * 30,
    }
  }, [selectedBrand, targets])

  const allMonthsData = useMemo(() => {
    if (!selectedBrand || !monthTargetData) return []
    const bu = selectedBrandInfo?.bu || ''
    const months = []
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date()
      monthStart.setMonth(monthStart.getMonth() - i)
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const monthEnd = new Date(monthStart)
      monthEnd.setMonth(monthEnd.getMonth() + 1)
      monthEnd.setDate(0)
      monthEnd.setHours(23, 59, 59, 999)

      const monthData = filterYouTubeData(data, selectedBrand, monthStart, monthEnd, bu)
      const revenue = monthData.reduce((sum, row) => sum + (row.revenue || 0), 0)
      const watchHours = monthData.reduce((sum, row) => sum + (row.watch_time || 0), 0)

      months.push({
        date: monthStart,
        label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue,
        watchHours,
        revenuePercent: (revenue / (monthTargetData.revenueTarget || 1)) * 100,
        watchHoursPercent: (watchHours / (monthTargetData.watchHoursTarget || 1)) * 100,
      })
    }
    return months
  }, [selectedBrand, selectedBrandInfo, data, monthTargetData])

  const monthlyRevenue = monthToDateData.reduce((sum, row) => sum + (row.revenue || 0), 0)
  const monthlyWatchHours = monthToDateData.reduce((sum, row) => sum + (row.watch_time || 0), 0)
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth = today.getDate()
  const monthProgressPct = (dayOfMonth / daysInMonth) * 100

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <BackButton />
              <div>
                <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                  YouTube Performance & Revenue Dashboard
                </h1>
                <p className="text-neutral-500 mt-1 text-sm">
                  Track watch hours, videos published and revenue across all brand channels
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 shrink-0">
              <button
                onClick={refetch}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
              >
                <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          <div
            className="mt-3 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF0000, #FF3FBF, #00E5D4, #0055EE)' }}
          />
        </div>

        {selectedBrand ? (
          <>
            <YouTubeDashboardHeader
              brand={selectedBrandInfo?.label ?? selectedBrand}
              businessUnit={selectedBrandInfo?.bu || ''}
              brands={brands}
              onBrandChange={setSelectedBrand}
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={(start, end) => { setStartDate(start); setEndDate(end) }}
            />

            <div className="mt-4 flex gap-4 items-center">
              <div className="flex gap-1 border border-neutral-200 rounded-lg p-1">
                {(['daily','weekly','monthly'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded text-sm font-medium transition capitalize ${
                      viewMode === mode ? 'bg-neutral-950 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showComparison}
                  onChange={() => setShowComparison(v => !v)}
                  className="w-4 h-4 rounded border-neutral-300 accent-neutral-950 cursor-pointer"
                />
                <span className="text-sm text-neutral-600 whitespace-nowrap">vs Previous Period</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTargets}
                  onChange={() => setShowTargets(v => !v)}
                  className="w-4 h-4 rounded border-neutral-300 accent-neutral-950 cursor-pointer"
                />
                <span className="text-sm text-neutral-600 whitespace-nowrap">Show targets</span>
              </label>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-neutral-500">{loading ? 'Loading brands…' : 'No data yet'}</p>
          </div>
        )}

        {selectedBrand && monthTargetData && monthToDateData.length > 0 && (
          <div className="mt-4">
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-950">Monthly Progress ({today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})</h2>
                <button
                  onClick={() => { setShowMonthsModal(true); setMonthsPage(0) }}
                  className="text-sm text-neutral-600 hover:text-neutral-950 transition-colors underline"
                >
                  View previous months
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Revenue Progress */}
                <div className="space-y-1">
                  <div>
                    <p className="text-xs text-neutral-600 font-medium mb-0.5">Revenue</p>
                    <p className="text-lg font-semibold text-neutral-950">${(monthlyRevenue / 1000).toFixed(1)}K</p>
                  </div>
                  <div className="relative h-4">
                    <div
                      className="absolute text-xs text-neutral-600 font-medium whitespace-nowrap"
                      style={{ left: `${monthProgressPct}%`, transform: 'translateX(-50%)' }}
                    >
                      {dayOfMonth}/{daysInMonth} days
                    </div>
                  </div>
                  <div className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(100, (monthlyRevenue / (monthTargetData.revenueTarget || 1)) * 100)}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                      style={{ left: `${monthProgressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">{((monthlyRevenue / (monthTargetData.revenueTarget || 1)) * 100).toFixed(0)}% of ${(monthTargetData.revenueTarget / 1000).toFixed(0)}K</p>
                </div>

                {/* Watch Hours Progress */}
                <div className="space-y-1">
                  <div>
                    <p className="text-xs text-neutral-600 font-medium mb-0.5">Watch Hours</p>
                    <p className="text-lg font-semibold text-neutral-950">{monthlyWatchHours >= 1000 ? `${(monthlyWatchHours / 1000).toFixed(1)}K` : monthlyWatchHours.toFixed(0)}</p>
                  </div>
                  <div className="relative h-4">
                    <div
                      className="absolute text-xs text-neutral-600 font-medium whitespace-nowrap"
                      style={{ left: `${monthProgressPct}%`, transform: 'translateX(-50%)' }}
                    >
                      {dayOfMonth}/{daysInMonth} days
                    </div>
                  </div>
                  <div className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, (monthlyWatchHours / (monthTargetData.watchHoursTarget || 1)) * 100)}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                      style={{ left: `${monthProgressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">{((monthlyWatchHours / (monthTargetData.watchHoursTarget || 1)) * 100).toFixed(0)}% of {monthTargetData.watchHoursTarget >= 1000 ? `${(monthTargetData.watchHoursTarget / 1000).toFixed(1)}K` : Math.round(monthTargetData.watchHoursTarget)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showMonthsModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMonthsModal(false)}>
            <div className="bg-white rounded-2xl shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-950">Monthly Progress History</h3>
                <button onClick={() => setShowMonthsModal(false)} className="text-neutral-500 hover:text-neutral-950">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-6 space-y-4">
                {allMonthsData.filter(m => m.revenue > 0 || m.watchHours > 0).slice(monthsPage * 12, (monthsPage + 1) * 12).map(month => (
                  <div key={month.label} className="bg-neutral-50 rounded-lg border border-neutral-200 p-4">
                    <p className="text-sm font-semibold text-neutral-950 mb-4">{month.label}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-neutral-600 font-medium mb-1">Revenue</p>
                          <p className="text-2xl font-semibold text-neutral-950">${(month.revenue / 1000).toFixed(1)}K</p>
                        </div>
                        <div className="space-y-1">
                          <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, month.revenuePercent)}%` }} />
                          </div>
                          <p className="text-xs text-neutral-500">{month.revenuePercent.toFixed(0)}% of target</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-neutral-600 font-medium mb-1">Watch Hours</p>
                          <p className="text-2xl font-semibold text-neutral-950">{month.watchHours >= 1000 ? `${(month.watchHours / 1000).toFixed(1)}K` : month.watchHours.toFixed(0)}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, month.watchHoursPercent)}%` }} />
                          </div>
                          <p className="text-xs text-neutral-500">{month.watchHoursPercent.toFixed(0)}% of target</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {(() => {
                const filtered = allMonthsData.filter(m => m.revenue > 0 || m.watchHours > 0)
                return filtered.length > 12 ? (
                  <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
                    <button
                      onClick={() => setMonthsPage(p => Math.max(0, p - 1))}
                      disabled={monthsPage === 0}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Previous
                    </button>
                    <p className="text-xs text-neutral-600">Page {monthsPage + 1} of {Math.ceil(filtered.length / 12)}</p>
                    <button
                      onClick={() => setMonthsPage(p => p + 1)}
                      disabled={(monthsPage + 1) * 12 >= filtered.length}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                ) : null
              })()}
            </div>
          </div>
        )}

        <div className="mt-6">
          {!loading && selectedBrand && filteredData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-neutral-500">No data for selected date range</p>
            </div>
          )}

          {filteredData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <VideosPublishedChart
                data={filteredData}
                prevData={prevFilteredData}
                showComparison={showComparison}
                showTargets={showTargets}
                targetValue={targetData?.videosTarget ?? null}
                targetLabel={targetData?.label}
              />
              <WatchHoursChart
                data={filteredData}
                prevData={prevFilteredData}
                showComparison={showComparison}
                showTargets={showTargets}
                targetValue={targetData?.watchHoursTarget ?? null}
                targetLabel={targetData?.label}
              />
              <YouTubeRevenueChart
                data={filteredData}
                prevData={prevFilteredData}
                showComparison={showComparison}
                showTargets={showTargets}
                targetValue={targetData?.revenueTarget ?? null}
                targetLabel={targetData?.label}
              />
            </div>
          )}
        </div>

        {lastUpdated && (
          <div className="mt-8 text-center">
            <p className="text-xs text-neutral-400">
              Last updated: {lastUpdated.toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
