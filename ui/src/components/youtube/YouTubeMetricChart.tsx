import type { ReactNode } from 'react'
import {
  ComposedChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { YouTubeDashboardRow } from '../../utils/youtubeDashboardUtils'
import { formatDateLabel } from '../../utils/youtubeDashboardUtils'

interface YouTubeMetricChartProps {
  title: string
  data: YouTubeDashboardRow[]
  prevData?: YouTubeDashboardRow[]
  showComparison?: boolean
  metricKey: 'videos_published' | 'watch_time' | 'revenue'
  color: string
  format: (n: number) => string
  targetValue?: number | null
  targetLabel?: string
  showTargets?: boolean
  headerRight?: ReactNode
}

export function YouTubeMetricChart({
  title,
  data,
  prevData = [],
  showComparison = false,
  metricKey,
  color,
  format,
  targetValue,
  targetLabel,
  showTargets = true,
  headerRight,
}: YouTubeMetricChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6 h-96 flex items-center justify-center">
        <p className="text-neutral-500">No data available</p>
      </div>
    )
  }

  const chartData = data.map(row => {
    const value = Number((row as any)[metricKey]) || 0
    return {
      date: row.date,
      daysInfo: (row as any).daysInfo as string | undefined,
      weekRange: (row as any).weekRange as string | undefined,
      value,
      bar_total: value,
    }
  })

  const total = chartData.reduce((s, r) => s + r.value, 0)
  const prevTotal = prevData.reduce((s, r) => s + (Number((r as any)[metricKey]) || 0), 0)
  const delta = showComparison && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

  const target = showTargets && targetValue ? targetValue : 0
  const maxBar = Math.max(...chartData.map(d => d.value), 0)
  const yAxisDomain = [0, Math.ceil(Math.max(maxBar, target) * 1.05)]

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
        {headerRight}
      </div>

      <div className="mb-4 text-center">
        <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total</p>
        <p className="text-lg font-semibold text-neutral-950">{format(total)}</p>
        {showComparison && (
          delta !== null
            ? <p className={`text-xs font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {Math.abs(delta).toFixed(1)}%
              </p>
            : <p className="text-xs text-neutral-400">—</p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400} style={{ paddingBottom: 80 }}>
        <ComposedChart data={chartData} margin={{ top: 20, bottom: 60, left: 0, right: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            interval={Math.max(0, Math.floor(data.length / 7) - 1)}
            height={60}
            tick={{ fontSize: 11, angle: -45, textAnchor: 'end' }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : String(v)}
            domain={yAxisDomain}
          />
          <Tooltip
            content={({ active: a, payload, label }) => {
              if (!a || !payload?.length) return null
              const p = payload.find(x => x.dataKey === 'value')
              if (!p) return null
              return (
                <div className="bg-white border border-neutral-200 rounded-lg shadow p-3 text-xs">
                  <p className="font-semibold text-neutral-700 mb-1">{formatDateLabel(String(label))}</p>
                  {(p.payload as any)?.weekRange && (
                    <p className="text-neutral-400 mb-2">{(p.payload as any).weekRange}</p>
                  )}
                  {!(p.payload as any)?.weekRange && (p.payload as any)?.daysInfo && (
                    <p className="text-neutral-400 mb-2">{(p.payload as any).daysInfo}</p>
                  )}
                  {(p.payload as any)?.daysInfo && (
                    <p className="text-amber-500 font-bold mb-3 flex items-center gap-2 text-sm">
                      <span className="text-base">⚠</span>
                      {(p.payload as any).daysInfo}
                    </p>
                  )}
                  <div className="flex justify-between gap-4">
                    <span style={{ color }}>{title}</span>
                    <span className="text-neutral-700">{format(Number(p.value))}</span>
                  </div>
                </div>
              )
            }}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
          {showTargets && targetValue != null && targetValue > 0 && (
            <ReferenceLine
              y={targetValue}
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `${targetLabel || 'TARGET'}: ${format(targetValue)}`,
                position: 'insideBottomLeft',
                offset: 5,
                fill: '#dc2626',
                fontSize: 12,
                fontWeight: 'bold',
              }}
            />
          )}
          <Bar dataKey="value" fill={color} name={title}>
            <LabelList
              dataKey="bar_total"
              content={(props: any) => {
                const { x, y, width, index } = props
                const row = chartData[index]
                if (!row || !row.value) return null
                return (
                  <g>
                    {row.daysInfo && (
                      <text x={x + width / 2} y={y - 16} fill="#f59e0b" fontSize={16} fontWeight="bold" textAnchor="middle">⚠</text>
                    )}
                    <text x={x + width / 2} y={y - 4} fill="#525252" fontSize={10} textAnchor="middle">
                      {format(row.value)}
                    </text>
                  </g>
                )
              }}
            />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
