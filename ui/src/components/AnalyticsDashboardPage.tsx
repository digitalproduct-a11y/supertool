import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { IconAlertTriangle, IconChartBar } from '@tabler/icons-react'
import { useAnalyticsData, type RawEvent, type DatePreset, type DateRange } from '../hooks/useAnalyticsData'
import { Spinner } from './ds/Spinner'

const CHART_COLORS = ['#0055EE', '#FF3FBF', '#00E5D4', '#F05A35']

function toInputValue(d: Date): string {
  return d.toISOString().split('T')[0]
}

interface StatCardProps {
  label: string
  value: number
  color: string
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</span>
      <span className="font-display text-4xl font-semibold tracking-tight" style={{ color }}>
        {value.toLocaleString()}
      </span>
    </div>
  )
}

interface DateRangeFilterProps {
  preset: DatePreset
  onPreset: (p: DatePreset) => void
  dateRange: DateRange
  onCustomRange: (r: DateRange) => void
}

function DateRangeFilter({ preset, onPreset, dateRange, onCustomRange }: DateRangeFilterProps) {
  const presets: { id: DatePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'last7', label: 'Last 7 days' },
    { id: 'last30', label: 'Last 30 days' },
    { id: 'custom', label: 'Custom' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <button
          key={p.id}
          onClick={() => onPreset(p.id)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            preset === p.id
              ? 'bg-neutral-950 text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={toInputValue(dateRange.from)}
            onChange={e => onCustomRange({ from: new Date(e.target.value), to: dateRange.to })}
            className="text-sm border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
          <span className="text-neutral-400 text-sm">to</span>
          <input
            type="date"
            value={toInputValue(dateRange.to)}
            max={toInputValue(new Date())}
            onChange={e => onCustomRange({ from: dateRange.from, to: new Date(e.target.value) })}
            className="text-sm border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>
      )}
    </div>
  )
}

export function AnalyticsDashboardPage() {
  const { events, loading, error, dateRange, preset, setPreset, setCustomRange, refetch } = useAnalyticsData()

  // Stat card calculations
  const uniqueSessions = useMemo(
    () => new Set(events.map(e => e.session_id)).size,
    [events]
  )

  const totalGenerated = useMemo(
    () => events.filter(e => e.event_type === 'asset_generated').length,
    [events]
  )

  // Chart 1 — Feature Traffic (page_visit count per tool_id)
  const trafficData = useMemo(() => {
    const map = new Map<string, { tool_label: string; visits: number }>()
    for (const e of events) {
      if (e.event_type !== 'page_visit') continue
      const existing = map.get(e.tool_id)
      if (existing) {
        existing.visits++
      } else {
        map.set(e.tool_id, { tool_label: e.tool_label, visits: 1 })
      }
    }
    return Array.from(map.entries())
      .map(([tool_id, v]) => ({ tool_id, ...v }))
      .sort((a, b) => b.visits - a.visits)
  }, [events])

  // Chart 2 — Success Funnel (page_visit vs asset_generated per tool)
  const funnelData = useMemo(() => {
    const map = new Map<string, { tool_label: string; page_visit: number; asset_generated: number }>()
    for (const e of events) {
      if (e.event_type !== 'page_visit' && e.event_type !== 'asset_generated') continue
      const row = map.get(e.tool_id) ?? { tool_label: e.tool_label, page_visit: 0, asset_generated: 0 }
      row[e.event_type as 'page_visit' | 'asset_generated']++
      if (!map.has(e.tool_id)) map.set(e.tool_id, row)
    }
    return Array.from(map.entries()).map(([tool_id, data]) => ({ tool_id, ...data }))
  }, [events])

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
            Analytics
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">Tool usage, traffic, and conversion overview</p>
          <div
            className="mt-3 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Date filter */}
        <div className="glass-card rounded-2xl p-4 mb-6">
          <DateRangeFilter preset={preset} onPreset={setPreset} dateRange={dateRange} onCustomRange={setCustomRange} />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-neutral-500">Loading analytics data…</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="glass-card rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto">
              <IconAlertTriangle className="w-6 h-6 text-orange-400" />
            </div>
            <p className="font-semibold text-neutral-900">Could not load analytics</p>
            <p className="text-sm text-neutral-500 max-w-md mx-auto">{error}</p>
            <button
              onClick={refetch}
              className="mt-2 px-4 py-2 bg-neutral-950 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && events.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <IconChartBar className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-semibold text-neutral-700">No events in this date range</p>
            <p className="text-sm text-neutral-400 mt-1">Try selecting a wider range or check back later.</p>
          </div>
        )}

        {/* Dashboard content */}
        {!loading && !error && events.length > 0 && (
          <div className="space-y-6">

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 md:gap-6">
              <StatCard label="Unique Sessions" value={uniqueSessions} color="#0055EE" />
              <StatCard label="Assets Generated" value={totalGenerated} color="#FF3FBF" />
            </div>

            {/* Traffic chart */}
            {trafficData.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-display text-base font-semibold text-neutral-950 mb-4">
                  Feature Traffic
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart layout="vertical" data={trafficData} margin={{ left: 160, right: 24, top: 8, bottom: 8 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="tool_label"
                      width={150}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                      formatter={(value: number) => [value, 'Page visits']}
                    />
                    <Bar dataKey="visits" radius={[0, 6, 6, 0]} maxBarSize={28}>
                      {trafficData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Funnel chart */}
            {funnelData.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-display text-base font-semibold text-neutral-950 mb-4">
                  Page Visits vs Assets Generated
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funnelData} margin={{ left: 8, right: 8, top: 8, bottom: 60 }} barCategoryGap="25%" barGap={4}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      dataKey="tool_label"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (value === 'page_visit' ? 'Page Visits' : 'Assets Generated')}
                    />
                    <Bar dataKey="page_visit" fill="#0055EE" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="asset_generated" fill="#FF3FBF" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  )
}
