import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useDashboardData } from '../hooks/useDashboardData'
import { DashboardHeader } from '../components/DashboardHeader'
import { RevenueChart } from '../components/RevenueChart'
import { PostsChart } from '../components/PostsChart'
import { InteractionsChart } from '../components/InteractionsChart'
import { filterDashboardData, aggregateByWeek, getLast30Days } from '../utils/dashboardUtils'
import { DashboardRow } from '../utils/dashboardUtils'

interface DashboardPageProps {
  businessUnit?: string
}

export function DashboardPage({ businessUnit }: DashboardPageProps) {
  const { brand } = useParams<{ brand: string }>()
  if (!brand) return <div>Brand not found</div>

  const { data, loading, lastUpdated, refetch } = useDashboardData()
  const [startDate, setStartDate] = useState<Date>(() => getLast30Days()[0])
  const [endDate, setEndDate] = useState<Date>(() => getLast30Days()[1])
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily')

  const brandData = useMemo(() => {
    return data.find(row => row.brand === brand)
  }, [data, brand])

  const bu = businessUnit || brandData?.business_unit || ''

  const filteredData = useMemo(() => {
    const filtered = filterDashboardData(data, brand, startDate, endDate, bu)
    if (viewMode === 'weekly') {
      return aggregateByWeek(filtered) as DashboardRow[]
    }
    return filtered
  }, [data, brand, startDate, endDate, bu, viewMode])

  return (
    <div className="min-h-screen bg-neutral-50">
      <DashboardHeader
        brand={brand}
        businessUnit={bu}
        startDate={startDate}
        endDate={endDate}
        onDateRangeChange={(start, end) => {
          setStartDate(start)
          setEndDate(end)
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={refetch}
        isLoading={loading}
      />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {loading && data.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-600">Loading dashboard...</p>
          </div>
        )}

        {!loading && filteredData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-600">No data for selected date range</p>
          </div>
        )}

        {filteredData.length > 0 && (
          <div className="space-y-8">
            <RevenueChart data={filteredData} />
            <PostsChart data={filteredData} />
            <InteractionsChart data={filteredData} />
          </div>
        )}

        {lastUpdated && (
          <div className="mt-8 text-center">
            <p className="text-xs text-neutral-500">
              Last updated: {lastUpdated.toLocaleString()}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
