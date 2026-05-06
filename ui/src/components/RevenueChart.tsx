import { useState, useRef, useEffect } from 'react'
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
} from 'recharts'
import { IconAdjustmentsHorizontal } from '@tabler/icons-react'
import type { DashboardRow } from '../utils/dashboardUtils'
import { formatDateLabel } from '../utils/dashboardUtils'

interface RevenueChartProps {
  data: DashboardRow[]
  prevData?: DashboardRow[]
  showComparison?: boolean
}

const toNum = (v: unknown): number => {
  const n = parseFloat(String(v))
  return isNaN(n) ? 0 : n
}

const SERIES = [
  { key: 'photo_revenue', label: 'Photo', color: '#FF3FBF' },
  { key: 'video_revenue', label: 'Video', color: '#00E5D4' },
  { key: 'story_revenue', label: 'Story', color: '#0055EE' },
  { key: 'text_link_revenue', label: 'Text Link', color: '#F05A35' },
  { key: 'bonus_revenue', label: 'Bonus', color: '#9333EA' },
]

export function RevenueChart({ data, prevData = [], showComparison = false }: RevenueChartProps) {
  const [active, setActive] = useState<Set<string>>(new Set(SERIES.map(s => s.key)))
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (key: string) => {
    setActive(prev => {
      if (prev.has(key) && prev.size === 1) return prev
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6 h-96 flex items-center justify-center">
        <p className="text-neutral-500">No data available</p>
      </div>
    )
  }

  const chartData = data.map((row) => {
    const photo = toNum(row.photo_revenue)
    const video = toNum(row.video_revenue)
    const story = toNum(row.story_revenue)
    const text_link = toNum(row.text_link_revenue)
    const bonus = toNum(row.bonus_revenue)
    return {
      date: row.date,
      daysInfo: (row as any).daysInfo as string | undefined,
      weekRange: (row as any).weekRange as string | undefined,
      photo_revenue: photo,
      video_revenue: video,
      story_revenue: story,
      text_link_revenue: text_link,
      bonus_revenue: bonus,
      bar_total: parseFloat((photo + video + story + text_link + bonus).toFixed(2)),
      _anchor: 0.001,
    }
  })

  const total = chartData.reduce(
    (sum, row) => sum + row.photo_revenue + row.video_revenue + row.story_revenue + row.text_link_revenue + row.bonus_revenue,
    0
  )

  const prevTotal = prevData.reduce(
    (sum, row) => sum + toNum(row.photo_revenue) + toNum(row.video_revenue) + toNum(row.story_revenue) + toNum(row.text_link_revenue) + toNum(row.bonus_revenue),
    0
  )
  const delta = showComparison && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

  const allSelected = active.size === SERIES.length
  const label = allSelected ? 'All types' : `${active.size} selected`

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-950">REVENUE (USD)</h2>
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen(v => !v)}
                title={label}
                className={`p-1 rounded-md transition ${open ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'}`}
              >
                <IconAdjustmentsHorizontal className="w-4 h-4" />
              </button>
            {open && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                {SERIES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => toggle(s.key)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-neutral-50 transition"
                  >
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0 flex items-center justify-center border"
                      style={active.has(s.key) ? { backgroundColor: s.color, borderColor: s.color } : { borderColor: '#d4d4d4' }}
                    >
                      {active.has(s.key) && (
                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 8 8">
                          <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="text-neutral-700">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
          <p className="text-xs text-neutral-600 font-medium mt-0.5">Latest week (Revenue data refreshed every Tuesday for previous week)</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-neutral-400 uppercase tracking-wide">Total</p>
          <p className="text-lg font-semibold text-neutral-950">${total.toFixed(2)}</p>
          {showComparison && (
            delta !== null
              ? <p className={`text-xs font-medium mt-0.5 ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                  {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {Math.abs(delta).toFixed(1)}% vs prev
                </p>
              : <p className="text-xs text-neutral-400 mt-0.5">— vs prev</p>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400} style={{ paddingBottom: 80 }}>
        <ComposedChart data={chartData} margin={{ top: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            interval={Math.max(0, Math.floor(data.length / 7) - 1)}
            height={60}
            tick={{ fontSize: 11, angle: -45, textAnchor: 'end' }}
          />
          <YAxis />
          <Tooltip
            content={({ active: a, payload, label }) => {
              if (!a || !payload?.length) return null
              const items = payload.filter(p => p.dataKey !== '_anchor' && p.dataKey !== 'bar_total')
              const tooltipTotal = items.reduce((s, p) => s + (Number(p.value) || 0), 0)
              return (
                <div className="bg-white border border-neutral-200 rounded-lg shadow p-3 text-xs">
                  <p className="font-semibold text-neutral-700 mb-1">{formatDateLabel(String(label))}</p>
                  {payload[0]?.payload?.weekRange && (
                    <p className="text-neutral-400 mb-2">{payload[0].payload.weekRange}</p>
                  )}
                  {!payload[0]?.payload?.weekRange && payload[0]?.payload?.daysInfo && (
                    <p className="text-neutral-400 mb-2">{payload[0].payload.daysInfo}</p>
                  )}
                  {payload[0]?.payload?.daysInfo && (
                    <p className="text-amber-500 font-bold mb-3 flex items-center gap-2 text-sm">
                      <span className="text-base">⚠</span>
                      {payload[0].payload.daysInfo}
                    </p>
                  )}
                  {items.map(p => (
                    <div key={p.dataKey as string} className="flex justify-between gap-4">
                      <span style={{ color: p.color }}>{p.name}</span>
                      <span className="text-neutral-700">${(Number(p.value)).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-neutral-200 font-semibold text-neutral-900">
                    <span>Total</span>
                    <span>${tooltipTotal.toFixed(2)}</span>
                  </div>
                </div>
              )
            }}
          />
          <Legend verticalAlign="top" height={36} />
          {SERIES.map(s => (
            <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} name={s.label} hide={!active.has(s.key)} />
          ))}
          <Bar dataKey="_anchor" stackId="a" fill="transparent" stroke="none" legendType="none" isAnimationActive={false}>
            <LabelList
              dataKey="bar_total"
              content={(props: any) => {
                const { x, y, width, index } = props
                const row = chartData[index]
                if (!row) return null
                const activeTotal = parseFloat(
                  (
                    (active.has('photo_revenue') ? row.photo_revenue : 0) +
                    (active.has('video_revenue') ? row.video_revenue : 0) +
                    (active.has('story_revenue') ? row.story_revenue : 0) +
                    (active.has('text_link_revenue') ? row.text_link_revenue : 0) +
                    (active.has('bonus_revenue') ? row.bonus_revenue : 0)
                  ).toFixed(2)
                )
                if (!activeTotal) return null
                const daysInfo = row.daysInfo
                return (
                  <g>
                    {daysInfo && (
                      <text x={x + width / 2} y={y - 16} fill="#f59e0b" fontSize={16} fontWeight="bold" textAnchor="middle">
                        ⚠
                      </text>
                    )}
                    <text x={x + width / 2} y={y - 4} fill="#525252" fontSize={10} textAnchor="middle">
                      ${activeTotal.toFixed(2)}
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
