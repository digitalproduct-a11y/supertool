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
  ReferenceLine,
} from 'recharts'
import { IconAdjustmentsHorizontal, IconUpload } from '@tabler/icons-react'
import type { DashboardRow } from '../utils/dashboardUtils'
import { formatDateLabel } from '../utils/dashboardUtils'
import { PasscodeModal } from './PasscodeModal'
import { RevenueUploadModal } from './RevenueUploadModal'
import { useBrand } from '../context/BrandContext'

interface RevenueChartProps {
  data: DashboardRow[]
  prevData?: DashboardRow[]
  showComparison?: boolean
  targetData?: { dailyRevenue: number; revenueTarget: number; targetLabel: string; interactions: null } | null
  showTargets?: boolean
  viewMode?: 'daily' | 'weekly' | 'monthly'
  startDate?: Date
  endDate?: Date
  brand: string
  onRefetch: () => void
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

export function RevenueChart({ data, prevData = [], showComparison = false, targetData, showTargets = true, brand, onRefetch }: RevenueChartProps) {
  const { isAdmin } = useBrand()
  const [active, setActive] = useState<Set<string>>(new Set(SERIES.map(s => s.key)))
  const [open, setOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const metricsRef = useRef<HTMLDivElement>(null)


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

  const handleUploadClick = () => {
    const isAuthenticated = sessionStorage.getItem('uploadAuth') === 'true'
    if (isAuthenticated) {
      setUploadModalOpen(true)
    } else {
      setPasscodeModalOpen(true)
    }
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

  const totals = {
    photo_revenue: chartData.reduce((sum, row) => sum + (active.has('photo_revenue') ? row.photo_revenue : 0), 0),
    video_revenue: chartData.reduce((sum, row) => sum + (active.has('video_revenue') ? row.video_revenue : 0), 0),
    story_revenue: chartData.reduce((sum, row) => sum + (active.has('story_revenue') ? row.story_revenue : 0), 0),
    text_link_revenue: chartData.reduce((sum, row) => sum + (active.has('text_link_revenue') ? row.text_link_revenue : 0), 0),
    bonus_revenue: chartData.reduce((sum, row) => sum + (active.has('bonus_revenue') ? row.bonus_revenue : 0), 0),
  }
  const total = Object.values(totals).reduce((sum, v) => sum + v, 0)

  const prevTotals = {
    photo_revenue: prevData.reduce((sum, row) => sum + (active.has('photo_revenue') ? toNum(row.photo_revenue) : 0), 0),
    video_revenue: prevData.reduce((sum, row) => sum + (active.has('video_revenue') ? toNum(row.video_revenue) : 0), 0),
    story_revenue: prevData.reduce((sum, row) => sum + (active.has('story_revenue') ? toNum(row.story_revenue) : 0), 0),
    text_link_revenue: prevData.reduce((sum, row) => sum + (active.has('text_link_revenue') ? toNum(row.text_link_revenue) : 0), 0),
    bonus_revenue: prevData.reduce((sum, row) => sum + (active.has('bonus_revenue') ? toNum(row.bonus_revenue) : 0), 0),
  }
  const prevTotal = Object.values(prevTotals).reduce((sum, v) => sum + v, 0)
  const delta = showComparison && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

  const getDelta = (current: number, prev: number) => showComparison && prev > 0 ? ((current - prev) / prev) * 100 : null

  const allSelected = active.size === SERIES.length
  const label = allSelected ? 'All types' : `${active.size} selected`

  // Calculate Y-axis domain to include target line
  const targetValue = showTargets && targetData ? targetData.revenueTarget : 0
  const maxBarValue = Math.max(...chartData.map(d => d.bar_total), 0)
  const maxValue = Math.max(maxBarValue, targetValue)
  const yAxisDomain = [0, Math.ceil(maxValue * 1.05)]

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div>
        <div className="flex items-center justify-between mb-4">
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
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                <button
                  onClick={() => setActive(new Set(SERIES.map(s => s.key)))}
                  disabled={active.size === SERIES.length}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-neutral-50 disabled:hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0 flex items-center justify-center border"
                    style={active.size === SERIES.length ? { backgroundColor: '#525252', borderColor: '#525252' } : { borderColor: '#d4d4d4' }}
                  >
                    {active.size === SERIES.length && (
                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 8 8">
                        <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-neutral-700 font-medium">Select All</span>
                </button>
                <div className="border-t border-neutral-100" />
                {SERIES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => toggle(s.key)}
                    className="w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs hover:bg-neutral-50 transition group"
                  >
                    <div className="flex items-center gap-2.5">
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
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActive(new Set([s.key]))
                      }}
                      className="px-2 py-0.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200 rounded text-xs opacity-0 group-hover:opacity-100 transition whitespace-nowrap"
                    >
                      Only
                    </button>
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={handleUploadClick}
              aria-label="Upload revenue data"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition"
            >
              <IconUpload className="w-3.5 h-3.5" />
              Upload revenue
            </button>
          )}
        </div>
        <div className="mb-4">
          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={() => {
                const container = metricsRef.current
                if (container) container.scrollBy({ left: -200, behavior: 'smooth' })
              }}
              className="text-neutral-400 hover:text-neutral-600 flex-shrink-0"
            >
              ←
            </button>
            <div ref={metricsRef} className="flex gap-8 overflow-x-auto px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="text-center flex-shrink-0">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total</p>
                <p className="text-lg font-semibold text-neutral-950">${total.toFixed(2)}</p>
                {showComparison && (
                  delta !== null
                    ? <p className={`text-xs font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {Math.abs(delta).toFixed(1)}%
                      </p>
                    : <p className="text-xs text-neutral-400">—</p>
                )}
              </div>
              {SERIES.map(s => {
                const catDelta = getDelta(totals[s.key as keyof typeof totals], prevTotals[s.key as keyof typeof prevTotals])
                return (
                  <div key={s.key} className={`text-center flex-shrink-0 ${active.has(s.key) ? 'text-neutral-700' : 'text-neutral-300'}`}>
                    <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className="text-lg font-semibold">${totals[s.key as keyof typeof totals].toFixed(2)}</p>
                    {showComparison && catDelta !== null && (
                      <p className={`text-xs font-medium ${catDelta > 0 ? 'text-green-600' : catDelta < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {catDelta > 0 ? '↑' : catDelta < 0 ? '↓' : '='} {Math.abs(catDelta).toFixed(1)}%
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => {
                const container = metricsRef.current
                if (container) container.scrollBy({ left: 200, behavior: 'smooth' })
              }}
              className="text-neutral-400 hover:text-neutral-600 flex-shrink-0"
            >
              →
            </button>
          </div>
        </div>
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
          <YAxis tick={{ fontSize: 11 }} domain={yAxisDomain} />
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
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
          {showTargets && targetData && (
            <ReferenceLine
              y={targetData.revenueTarget}
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ value: `${targetData.targetLabel}: $${targetData.revenueTarget.toFixed(2)} USD`, position: 'insideBottomLeft', offset: 5, fill: '#dc2626', fontSize: 12, fontWeight: 'bold' }}
            />
          )}
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

      {passcodeModalOpen && (
        <PasscodeModal
          onSuccess={() => {
            setPasscodeModalOpen(false)
            setUploadModalOpen(true)
          }}
          onClose={() => setPasscodeModalOpen(false)}
        />
      )}

      {uploadModalOpen && (
        <RevenueUploadModal
          // Empty brands array is safe here because fixedBrand mode hides the brand dropdown
          brands={[]}
          defaultBrand={brand}
          fixedBrand={brand}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={() => {
            onRefetch()
            setUploadModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
