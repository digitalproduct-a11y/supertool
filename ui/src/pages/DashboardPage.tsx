import { useState, useMemo, useEffect } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useBrand } from '../context/BrandContext'
import { DashboardHeader } from '../components/DashboardHeader'
import { RevenueChart } from '../components/RevenueChart'
import { PostsChart } from '../components/PostsChart'
import { InteractionsChart } from '../components/InteractionsChart'
import { RPPChart } from '../components/RPPChart'
import { TopPostsChart } from '../components/TopPostsChart'
import { filterDashboardData, aggregateByWeek, aggregateByMonth } from '../utils/dashboardUtils'
import type { DashboardRow } from '../utils/dashboardUtils'
import { BackButton } from '../components/ds'
import { useBrandNavigate } from '../hooks/useBrandNavigate'

export function DashboardPage() {
  const { data, targets, bonuses, loading, lastUpdated, refetch } = useDashboardData()
  const { selectedBrand: globalBrand, isAdmin } = useBrand()
  const brandNavigate = useBrandNavigate()
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showMonthsModal, setShowMonthsModal] = useState(false)
  const [monthsPage, setMonthsPage] = useState(0)
  const [selectedBonusIndex, setSelectedBonusIndex] = useState(0)
  const [dateRangeCustomized, setDateRangeCustomized] = useState(false)

  // When fresh data arrives (refetch updates lastUpdated), advance the default
  // date window to today so a long-lived tab doesn't keep filtering against a
  // stale "yesterday". Skipped if the user has manually picked a custom range.
  useEffect(() => {
    if (!lastUpdated || dateRangeCustomized) return
    const newStart = new Date(); newStart.setDate(newStart.getDate() - 31); newStart.setHours(0, 0, 0, 0)
    const newEnd = new Date(); newEnd.setDate(newEnd.getDate() - 1); newEnd.setHours(23, 59, 59, 999)
    setStartDate(prev => prev.getTime() === newStart.getTime() ? prev : newStart)
    setEndDate(prev => prev.getTime() === newEnd.getTime() ? prev : newEnd)
  }, [lastUpdated, dateRangeCustomized])

  // Extract unique brands from data (preserving order of first appearance)
  const brands = useMemo(() => {
    const seen = new Set<string>()
    const list: { brand: string; bu: string }[] = []
    data.forEach(row => {
      if (!seen.has(row.brand)) {
        seen.add(row.brand)
        list.push({ brand: row.brand, bu: row.business_unit })
      }
    })
    return list.sort((a, b) => a.brand.localeCompare(b.brand))
  }, [data])

  // Auto-select brand when data loads
  useEffect(() => {
    if (brands.length > 0 && selectedBrand === null) {
      let brand: string | undefined

      // Priority 1: Global brand from URL (set by BrandLayout) — works for both admin and non-admin
      if (globalBrand) {
        const match = brands.find(b => b.brand === globalBrand)
        brand = match?.brand
      }

      // Priority 2: First brand
      if (!brand) {
        brand = brands[0].brand
      }

      setSelectedBrand(brand)
    }
  }, [brands, selectedBrand, globalBrand])


  const selectedBrandInfo = brands.find(b => b.brand === selectedBrand)
  const brandProfileId = useMemo(() => {
    if (!selectedBrand || data.length === 0) return 0
    const row = data.find(d => d.brand === selectedBrand)
    return row?.profile_id || 0
  }, [data, selectedBrand])

  const filteredData = useMemo(() => {
    if (!selectedBrand) return []
    const bu = selectedBrandInfo?.bu || ''
    const filtered = filterDashboardData(data, selectedBrand, startDate, endDate, bu)
    if (viewMode === 'weekly') return aggregateByWeek(filtered) as DashboardRow[]
    if (viewMode === 'monthly') return aggregateByMonth(filtered) as DashboardRow[]
    return filtered
  }, [data, selectedBrand, startDate, endDate, viewMode, selectedBrandInfo])

  const prevFilteredData = useMemo(() => {
    if (!showComparison || !selectedBrand) return []
    const duration = endDate.getTime() - startDate.getTime() + 86400000
    const prevEnd = new Date(startDate.getTime() - 86400000)
    const prevStart = new Date(startDate.getTime() - duration)
    const bu = selectedBrandInfo?.bu || ''
    const filtered = filterDashboardData(data, selectedBrand, prevStart, prevEnd, bu)
    if (viewMode === 'weekly') return aggregateByWeek(filtered) as DashboardRow[]
    if (viewMode === 'monthly') return aggregateByMonth(filtered) as DashboardRow[]
    return filtered
  }, [showComparison, data, selectedBrand, startDate, endDate, viewMode, selectedBrandInfo])

  const targetData = useMemo(() => {
    if (!selectedBrand) return null
    const brandTarget = targets.find(t => t.Brand === selectedBrand)
    if (!brandTarget) return null

    const annualRevenue = brandTarget['Annual Revenue Target (USD)']
    const avgPostsPerDay = brandTarget['Avg Posts Per Day']

    // Calculate daily target
    const dailyRevenueTarget = annualRevenue / 365
    const dailyPostsTarget = avgPostsPerDay

    // Calculate target based on view mode
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
      dailyRevenue: dailyRevenueTarget,
      dailyPosts: dailyPostsTarget,
      revenueTarget,
      postsTarget,
      targetLabel,
      interactions: null, // TBD - user will add this later
    }
  }, [selectedBrand, targets, viewMode])

  // Month-to-date data (independent of date selection)
  const monthToDateData = useMemo(() => {
    if (!selectedBrand) return []
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    const bu = selectedBrandInfo?.bu || ''
    return filterDashboardData(data, selectedBrand, monthStart, today, bu)
  }, [data, selectedBrand, selectedBrandInfo])

  const monthTargetData = useMemo(() => {
    if (!selectedBrand) return null
    const brandTarget = targets.find(t => t.Brand === selectedBrand)
    if (!brandTarget) return null

    const annualRevenue = brandTarget['Annual Revenue Target (USD)']
    const avgPostsPerDay = brandTarget['Avg Posts Per Day']
    const dailyRevenueTarget = annualRevenue / 365
    const dailyPostsTarget = avgPostsPerDay

    // Calculate month target (using 30 days as standard month)
    return {
      revenueTarget: dailyRevenueTarget * 30,
      postsTarget: dailyPostsTarget * 30,
    }
  }, [selectedBrand, targets])

  // Get data for all months (for modal)
  const allMonthsData = useMemo(() => {
    if (!selectedBrand || !monthTargetData) return []
    const bu = selectedBrandInfo?.bu || ''
    const months = []

    // Get current month and up to 11 previous months
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date()
      monthStart.setMonth(monthStart.getMonth() - i)
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const monthEnd = new Date(monthStart)
      monthEnd.setMonth(monthEnd.getMonth() + 1)
      monthEnd.setDate(0)
      monthEnd.setHours(23, 59, 59, 999)

      const monthData = filterDashboardData(data, selectedBrand, monthStart, monthEnd, bu)
      const revenue = monthData.reduce((sum, row) => sum + (row.total_revenue || 0), 0)
      const posts = monthData.reduce((sum, row) => sum + (row.total_posts || 0), 0)

      months.push({
        date: monthStart,
        label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue,
        posts,
        revenuePercent: (revenue / (monthTargetData.revenueTarget || 1)) * 100,
        postsPercent: (posts / (monthTargetData.postsTarget || 1)) * 100,
      })
    }

    return months
  }, [selectedBrand, selectedBrandInfo, data, monthTargetData])

  return (
    <main className="pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-[#f7f7f6]">
        <div className="pt-20 md:pt-10 px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Page header */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <BackButton />
                  <div>
                    <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                      Meta Performance & Revenue Dashboard
                    </h1>
                    <p className="text-neutral-500 mt-1 text-sm">
                      Track revenue, posts and engagement across all brands
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => brandNavigate('/diagnosis')}
                      className="px-3 py-1.5 bg-neutral-950 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition whitespace-nowrap"
                    >
                      Diagnosis
                    </button>
                    <button
                      onClick={() => brandNavigate('/weekly-report')}
                      className="px-3 py-1.5 bg-neutral-950 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition whitespace-nowrap"
                    >
                      Weekly Analysis
                    </button>
                  </div>
                )}
              </div>
              <div
                className="mt-3 h-[3px] rounded-full animate-stripe-grow"
                style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
              />
            </div>

            {/* Dashboard header */}
            {selectedBrand && (
              <div className="pb-4 mb-2">
                <DashboardHeader
                  brand={selectedBrand}
                  businessUnit={selectedBrandInfo?.bu || ''}
                  brands={brands}
                  onBrandChange={setSelectedBrand}
                  startDate={startDate}
                  endDate={endDate}
                  onDateRangeChange={(start, end) => {
                    setStartDate(start)
                    setEndDate(end)
                    setDateRangeCustomized(true)
                  }}
                  onRefresh={refetch}
                  loading={loading}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  showComparison={showComparison}
                  onShowComparisonChange={setShowComparison}
                  showTargets={showTargets}
                  onShowTargetsChange={setShowTargets}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {selectedBrand ? (
            <>
              {/* Monthly Progress and Bonus Cards */}
              {selectedBrand && monthTargetData && monthToDateData.length > 0 && (
              <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Monthly Progress Card */}
                <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-neutral-950">Monthly Progress ({new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})</h2>
                    <button
                      onClick={() => {
                        setShowMonthsModal(true)
                        setMonthsPage(0)
                      }}
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
                        <p className="text-lg font-semibold text-neutral-950">${(monthToDateData.reduce((sum, row) => sum + (row.total_revenue || 0), 0) / 1000).toFixed(1)}K</p>
                      </div>
                      <div className="relative h-4">
                        <div
                          className="absolute text-xs text-neutral-600 font-medium whitespace-nowrap"
                          style={{ left: `${(new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100}%`, transform: 'translateX(-50%)' }}
                        >
                          {new Date().getDate()}/{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()} days
                        </div>
                      </div>
                      <div className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${Math.min(100, (monthToDateData.reduce((sum, row) => sum + (row.total_revenue || 0), 0) / (monthTargetData.revenueTarget || 1)) * 100)}%` }}
                        />
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                          style={{ left: `${(new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-neutral-500">{((monthToDateData.reduce((sum, row) => sum + (row.total_revenue || 0), 0) / (monthTargetData.revenueTarget || 1)) * 100).toFixed(0)}% of ${(monthTargetData.revenueTarget / 1000).toFixed(0)}K</p>
                    </div>

                    {/* Posts Progress */}
                    <div className="space-y-1">
                      <div>
                        <p className="text-xs text-neutral-600 font-medium mb-0.5">Posts</p>
                        <p className="text-lg font-semibold text-neutral-950">{monthToDateData.reduce((sum, row) => sum + (row.total_posts || 0), 0)}</p>
                      </div>
                      <div className="relative h-4">
                        <div
                          className="absolute text-xs text-neutral-600 font-medium whitespace-nowrap"
                          style={{ left: `${(new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100}%`, transform: 'translateX(-50%)' }}
                        >
                          {new Date().getDate()}/{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()} days
                        </div>
                      </div>
                      <div className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(100, (monthToDateData.reduce((sum, row) => sum + (row.total_posts || 0), 0) / (monthTargetData.postsTarget || 1)) * 100)}%` }}
                        />
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                          style={{ left: `${(new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-neutral-500">{((monthToDateData.reduce((sum, row) => sum + (row.total_posts || 0), 0) / (monthTargetData.postsTarget || 1)) * 100).toFixed(0)}% of {Math.round(monthTargetData.postsTarget)}</p>
                    </div>
                  </div>
                </div>

                {/* Bonus Card */}
                {bonuses[selectedBrand] && bonuses[selectedBrand].length > 0 ? (
                  <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                    <h2 className="text-lg font-semibold text-neutral-950 mb-4">Extra Bonus from Facebook</h2>
                    {/* Bonus Tabs */}
                    <div className="flex gap-1 border-b border-neutral-200 mb-4">
                      {bonuses[selectedBrand].map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedBonusIndex(idx)}
                          className={`px-3 py-2 text-xs font-medium transition ${
                            selectedBonusIndex === idx
                              ? 'text-blue-600 border-b-2 border-blue-600 -mb-px bg-blue-50 rounded-t-lg'
                              : 'text-neutral-600 hover:text-neutral-950'
                          }`}
                        >
                          Bonus {idx + 1}
                        </button>
                      ))}
                    </div>

                    {/* Bonus Content */}
                    {bonuses[selectedBrand][selectedBonusIndex] && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-neutral-950">{bonuses[selectedBrand][selectedBonusIndex].title}</h3>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                              bonuses[selectedBrand][selectedBonusIndex].status === 'In Progress'
                                ? 'bg-green-100 text-green-700'
                                : bonuses[selectedBrand][selectedBonusIndex].status === 'Not Activated'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}>
                              {bonuses[selectedBrand][selectedBonusIndex].status}
                            </span>
                          </div>
                          <a
                            href={bonuses[selectedBrand][selectedBonusIndex].bonusUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 font-medium hover:text-blue-700 transition-colors text-xs whitespace-nowrap flex-shrink-0"
                          >
                            View →
                          </a>
                        </div>
                        <p className="text-xs text-neutral-600">{bonuses[selectedBrand][selectedBonusIndex].description}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-neutral-950">{bonuses[selectedBrand][selectedBonusIndex].progress}</span>
                          <span className="text-neutral-600">Last updated: {bonuses[selectedBrand][selectedBonusIndex].dateScraped}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                    <h2 className="text-lg font-semibold text-neutral-950 mb-4">Extra Bonus from Facebook</h2>
                    <p className="text-neutral-500 text-center py-4">No bonuses available for now, check back again soon!</p>
                  </div>
                )}
              </div>
            )}

            {/* Previous Months Modal */}
            {showMonthsModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMonthsModal(false)}>
                <div className="bg-white rounded-2xl shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-neutral-950">Monthly Progress History</h3>
                    <button onClick={() => setShowMonthsModal(false)} className="text-neutral-500 hover:text-neutral-950">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Content */}
                  <div className="overflow-y-auto flex-1 px-6 py-6 space-y-4">
                    {allMonthsData.filter(m => m.revenue > 0 || m.posts > 0).slice(monthsPage * 12, (monthsPage + 1) * 12).map(month => (
                      <div key={month.label} className="bg-neutral-50 rounded-lg border border-neutral-200 p-4">
                        <p className="text-sm font-semibold text-neutral-950 mb-4">{month.label}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Revenue Progress */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-neutral-600 font-medium mb-1">Revenue</p>
                              <p className="text-2xl font-semibold text-neutral-950">${(month.revenue / 1000).toFixed(1)}K</p>
                            </div>
                            <div className="space-y-1">
                              <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500"
                                  style={{ width: `${Math.min(100, month.revenuePercent)}%` }}
                                />
                              </div>
                              <p className="text-xs text-neutral-500">{month.revenuePercent.toFixed(0)}% of target</p>
                            </div>
                          </div>

                          {/* Posts Progress */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-neutral-600 font-medium mb-1">Posts</p>
                              <p className="text-2xl font-semibold text-neutral-950">{month.posts}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500"
                                  style={{ width: `${Math.min(100, month.postsPercent)}%` }}
                                />
                              </div>
                              <p className="text-xs text-neutral-500">{month.postsPercent.toFixed(0)}% of target</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {(() => {
                    const filteredMonths = allMonthsData.filter(m => m.revenue > 0 || m.posts > 0)
                    return filteredMonths.length > 12 ? (
                      <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
                        <button
                          onClick={() => setMonthsPage(p => Math.max(0, p - 1))}
                          disabled={monthsPage === 0}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Previous
                        </button>
                        <p className="text-xs text-neutral-600">
                          Page {monthsPage + 1} of {Math.ceil(filteredMonths.length / 12)}
                        </p>
                        <button
                          onClick={() => setMonthsPage(p => p + 1)}
                          disabled={(monthsPage + 1) * 12 >= filteredMonths.length}
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
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-neutral-500">Loading brands...</p>
          </div>
        )}

        {/* Charts */}
        <div className="mt-6">

          {!loading && selectedBrand && filteredData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-neutral-500">No data for selected date range</p>
            </div>
          )}

          {filteredData.length > 0 && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <RevenueChart data={filteredData} prevData={prevFilteredData} showComparison={showComparison} targetData={targetData} showTargets={showTargets} viewMode={viewMode} startDate={startDate} endDate={endDate} brand={selectedBrand || ''} onRefetch={refetch} />
                <PostsChart data={filteredData} prevData={prevFilteredData} showComparison={showComparison} targetData={targetData} showTargets={showTargets} viewMode={viewMode} startDate={startDate} endDate={endDate} />
                <InteractionsChart data={filteredData} prevData={prevFilteredData} showComparison={showComparison} targetData={targetData} showTargets={showTargets} viewMode={viewMode} startDate={startDate} endDate={endDate} onDateSelect={setSelectedDate} selectedDate={selectedDate} />
                <RPPChart data={filteredData} prevData={prevFilteredData} showComparison={showComparison} />
              </div>
              <div className="mt-8">
                <TopPostsChart brand={selectedBrand || ''} profileId={brandProfileId} />
              </div>
            </>
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
      </div>
    </main>
  )
}
