import { useState, useMemo, useEffect } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { useDashboardData } from '../hooks/useDashboardData'
import { DashboardHeader } from '../components/DashboardHeader'
import { RevenueChart } from '../components/RevenueChart'
import { PostsChart } from '../components/PostsChart'
import { InteractionsChart } from '../components/InteractionsChart'
import { filterDashboardData, aggregateByWeek, aggregateByMonth } from '../utils/dashboardUtils'
import type { DashboardRow } from '../utils/dashboardUtils'

export function DashboardPage() {
  const { data, loading, lastUpdated, refetch } = useDashboardData()
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 9); d.setHours(0,0,0,0); return d
  })
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 2); d.setHours(23,59,59,999); return d
  })
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [showComparison, setShowComparison] = useState(true)

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

  // Auto-select first brand when data loads
  useEffect(() => {
    if (brands.length > 0 && selectedBrand === null) {
      setSelectedBrand(brands[0].brand)
    }
  }, [brands, selectedBrand])

  const selectedBrandInfo = brands.find(b => b.brand === selectedBrand)

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

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                Meta Performance & Revenue Dashboard
              </h1>
              <p className="text-neutral-500 mt-1 text-sm">
                Track revenue, posts and engagement across all brands
              </p>
            </div>
            <div className="flex items-center gap-3 pt-1 shrink-0">
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
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Brand chips */}
        {loading && brands.length === 0 ? (
          <div className="flex gap-2 flex-wrap mb-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 w-24 rounded-full bg-neutral-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap mb-6">
            {brands.map(({ brand }) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedBrand === brand
                    ? 'bg-neutral-950 text-white shadow'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        {selectedBrand && (
          <DashboardHeader
            brand={selectedBrand}
            businessUnit={selectedBrandInfo?.bu || ''}
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={(start, end) => {
              setStartDate(start)
              setEndDate(end)
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showComparison={showComparison}
            onToggleComparison={() => setShowComparison(v => !v)}
          />
        )}

        {/* Charts */}
        <div className="mt-6">
          {loading && data.length === 0 && (
            <div className="text-center py-12">
              <p className="text-neutral-500">Loading data...</p>
            </div>
          )}

          {!loading && selectedBrand && filteredData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-neutral-500">No data for selected date range</p>
            </div>
          )}

          {filteredData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <RevenueChart data={filteredData} prevData={prevFilteredData} showComparison={showComparison} />
              <PostsChart data={filteredData} prevData={prevFilteredData} showComparison={showComparison} />
              <div className="lg:col-span-2">
                <InteractionsChart data={filteredData} prevData={prevFilteredData} showComparison={showComparison} />
              </div>
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
