import { useState, useRef, useEffect } from 'react'
import {
  ComposedChart,
  Line,
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

interface RPPChartProps {
  data: DashboardRow[]
  prevData?: DashboardRow[]
  showComparison?: boolean
}

const POST_TYPE_COLORS = {
  photo: '#FF3FBF',
  video: '#00E5D4',
  textLink: '#F05A35',
}

const SERIES = [
  { key: 'photo', label: 'Photo RPP', color: POST_TYPE_COLORS.photo },
  { key: 'video', label: 'Video RPP', color: POST_TYPE_COLORS.video },
  { key: 'textLink', label: 'Text/Link RPP', color: POST_TYPE_COLORS.textLink },
  { key: 'weightedAvg', label: 'Weighted Avg RPP', color: '#525252' },
]

const toNum = (v: unknown): number => {
  const n = parseFloat(String(v))
  return isNaN(n) ? 0 : n
}

export function RPPChart({ data, prevData = [], showComparison = false }: RPPChartProps) {
  const [active, setActive] = useState<Set<string>>(new Set(SERIES.map(s => s.key)))
  const [open, setOpen] = useState(false)
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

  const allSelected = active.size === SERIES.length
  const label = allSelected ? 'All types' : `${active.size} selected`

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6 h-96 flex items-center justify-center">
        <p className="text-neutral-500">No data available</p>
      </div>
    )
  }

  const chartData = data.map((row) => {
    const photoRpp = row.photo_posts > 0 ? toNum(row.photo_revenue) / row.photo_posts : 0
    const photoRppDotted = row.photo_posts === 0 ? 0 : null

    const videoRpp = row.video_posts > 0 ? toNum(row.video_revenue) / row.video_posts : 0
    const videoRppDotted = row.video_posts === 0 ? 0 : null

    const textLinkRpp = row.text_link_posts > 0 ? toNum(row.text_link_revenue) / row.text_link_posts : 0
    const textLinkRppDotted = row.text_link_posts === 0 ? 0 : null

    const totalRevenue = toNum(row.photo_revenue) + toNum(row.video_revenue) + toNum(row.text_link_revenue)
    const totalPosts = row.photo_posts + row.video_posts + row.text_link_posts
    const weightedAvgRpp = totalPosts > 0 ? totalRevenue / totalPosts : 0
    const weightedAvgRppDotted = totalPosts === 0 ? 0 : null

    return {
      date: row.date,
      daysInfo: (row as any).daysInfo as string | undefined,
      weekRange: (row as any).weekRange as string | undefined,
      photoRpp,
      photoRppDotted,
      videoRpp,
      videoRppDotted,
      textLinkRpp,
      textLinkRppDotted,
      weightedAvgRpp,
      weightedAvgRppDotted,
    }
  })

  const prevChartData = prevData.map((row) => {
    const photoRpp = row.photo_posts > 0 ? toNum(row.photo_revenue) / row.photo_posts : 0
    const photoRppDotted = row.photo_posts === 0 ? 0 : null

    const videoRpp = row.video_posts > 0 ? toNum(row.video_revenue) / row.video_posts : 0
    const videoRppDotted = row.video_posts === 0 ? 0 : null

    const textLinkRpp = row.text_link_posts > 0 ? toNum(row.text_link_revenue) / row.text_link_posts : 0
    const textLinkRppDotted = row.text_link_posts === 0 ? 0 : null

    const totalRevenue = toNum(row.photo_revenue) + toNum(row.video_revenue) + toNum(row.text_link_revenue)
    const totalPosts = row.photo_posts + row.video_posts + row.text_link_posts
    const weightedAvgRpp = totalPosts > 0 ? totalRevenue / totalPosts : 0
    const weightedAvgRppDotted = totalPosts === 0 ? 0 : null

    return {
      date: row.date,
      photoRpp,
      photoRppDotted,
      videoRpp,
      videoRppDotted,
      textLinkRpp,
      textLinkRppDotted,
      weightedAvgRpp,
      weightedAvgRppDotted,
    }
  })

  const photoRppValues = chartData.filter(row => row.photoRppDotted === null).map(row => row.photoRpp)
  const videoRppValues = chartData.filter(row => row.videoRppDotted === null).map(row => row.videoRpp)
  const textLinkRppValues = chartData.filter(row => row.textLinkRppDotted === null).map(row => row.textLinkRpp)
  const weightedAvgRppValues = chartData.filter(row => row.weightedAvgRppDotted === null).map(row => row.weightedAvgRpp)

  const photoRppAvg = photoRppValues.length > 0 ? photoRppValues.reduce((sum, v) => sum + v, 0) / photoRppValues.length : 0
  const videoRppAvg = videoRppValues.length > 0 ? videoRppValues.reduce((sum, v) => sum + v, 0) / videoRppValues.length : 0
  const textLinkRppAvg = textLinkRppValues.length > 0 ? textLinkRppValues.reduce((sum, v) => sum + v, 0) / textLinkRppValues.length : 0
  const weightedAvgRppAvg = weightedAvgRppValues.length > 0 ? weightedAvgRppValues.reduce((sum, v) => sum + v, 0) / weightedAvgRppValues.length : 0

  const prevPhotoRppValues = prevChartData.filter(row => row.photoRppDotted === null).map(row => row.photoRpp)
  const prevVideoRppValues = prevChartData.filter(row => row.videoRppDotted === null).map(row => row.videoRpp)
  const prevTextLinkRppValues = prevChartData.filter(row => row.textLinkRppDotted === null).map(row => row.textLinkRpp)
  const prevWeightedAvgRppValues = prevChartData.filter(row => row.weightedAvgRppDotted === null).map(row => row.weightedAvgRpp)

  const prevPhotoRppAvg = prevPhotoRppValues.length > 0 ? prevPhotoRppValues.reduce((sum, v) => sum + v, 0) / prevPhotoRppValues.length : 0
  const prevVideoRppAvg = prevVideoRppValues.length > 0 ? prevVideoRppValues.reduce((sum, v) => sum + v, 0) / prevVideoRppValues.length : 0
  const prevTextLinkRppAvg = prevTextLinkRppValues.length > 0 ? prevTextLinkRppValues.reduce((sum, v) => sum + v, 0) / prevTextLinkRppValues.length : 0
  const prevWeightedAvgRppAvg = prevWeightedAvgRppValues.length > 0 ? prevWeightedAvgRppValues.reduce((sum, v) => sum + v, 0) / prevWeightedAvgRppValues.length : 0

  const getDelta = (current: number, prev: number) => showComparison && prev > 0 ? ((current - prev) / prev) * 100 : null

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-950">Revenue Per Post (RPP)</h2>
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
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Photo RPP</p>
                <p className="text-lg font-semibold text-neutral-950">${photoRppAvg.toFixed(2)}</p>
                {showComparison && (
                  getDelta(photoRppAvg, prevPhotoRppAvg) !== null
                    ? <p className={`text-xs font-medium ${getDelta(photoRppAvg, prevPhotoRppAvg)! > 0 ? 'text-green-600' : getDelta(photoRppAvg, prevPhotoRppAvg)! < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {getDelta(photoRppAvg, prevPhotoRppAvg)! > 0 ? '↑' : getDelta(photoRppAvg, prevPhotoRppAvg)! < 0 ? '↓' : '='} {Math.abs(getDelta(photoRppAvg, prevPhotoRppAvg)!).toFixed(1)}%
                      </p>
                    : <p className="text-xs text-neutral-400">—</p>
                )}
              </div>
              <div className="text-center flex-shrink-0">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Video RPP</p>
                <p className="text-lg font-semibold text-neutral-950">${videoRppAvg.toFixed(2)}</p>
                {showComparison && (
                  getDelta(videoRppAvg, prevVideoRppAvg) !== null
                    ? <p className={`text-xs font-medium ${getDelta(videoRppAvg, prevVideoRppAvg)! > 0 ? 'text-green-600' : getDelta(videoRppAvg, prevVideoRppAvg)! < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {getDelta(videoRppAvg, prevVideoRppAvg)! > 0 ? '↑' : getDelta(videoRppAvg, prevVideoRppAvg)! < 0 ? '↓' : '='} {Math.abs(getDelta(videoRppAvg, prevVideoRppAvg)!).toFixed(1)}%
                      </p>
                    : <p className="text-xs text-neutral-400">—</p>
                )}
              </div>
              <div className="text-center flex-shrink-0">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Text/Link RPP</p>
                <p className="text-lg font-semibold text-neutral-950">${textLinkRppAvg.toFixed(2)}</p>
                {showComparison && (
                  getDelta(textLinkRppAvg, prevTextLinkRppAvg) !== null
                    ? <p className={`text-xs font-medium ${getDelta(textLinkRppAvg, prevTextLinkRppAvg)! > 0 ? 'text-green-600' : getDelta(textLinkRppAvg, prevTextLinkRppAvg)! < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {getDelta(textLinkRppAvg, prevTextLinkRppAvg)! > 0 ? '↑' : getDelta(textLinkRppAvg, prevTextLinkRppAvg)! < 0 ? '↓' : '='} {Math.abs(getDelta(textLinkRppAvg, prevTextLinkRppAvg)!).toFixed(1)}%
                      </p>
                    : <p className="text-xs text-neutral-400">—</p>
                )}
              </div>
              <div className="w-px bg-neutral-200" />
              <div className="text-center flex-shrink-0">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Weighted Avg RPP</p>
                <p className="text-lg font-semibold text-neutral-950">${weightedAvgRppAvg.toFixed(2)}</p>
                {showComparison && (
                  getDelta(weightedAvgRppAvg, prevWeightedAvgRppAvg) !== null
                    ? <p className={`text-xs font-medium ${getDelta(weightedAvgRppAvg, prevWeightedAvgRppAvg)! > 0 ? 'text-green-600' : getDelta(weightedAvgRppAvg, prevWeightedAvgRppAvg)! < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {getDelta(weightedAvgRppAvg, prevWeightedAvgRppAvg)! > 0 ? '↑' : getDelta(weightedAvgRppAvg, prevWeightedAvgRppAvg)! < 0 ? '↓' : '='} {Math.abs(getDelta(weightedAvgRppAvg, prevWeightedAvgRppAvg)!).toFixed(1)}%
                      </p>
                    : <p className="text-xs text-neutral-400">—</p>
                )}
              </div>
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
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          />
          <Tooltip
            content={({ active: a, payload, label }) => {
              if (!a || !payload?.length) return null
              return (
                <div className="bg-white border border-neutral-200 rounded-lg shadow p-3 text-xs">
                  <p className="font-semibold text-neutral-700 mb-1">{formatDateLabel(String(label))}</p>
                  {payload[0]?.payload?.weekRange && (
                    <p className="text-neutral-400 mb-2">{payload[0].payload.weekRange}</p>
                  )}
                  {payload[0]?.payload?.daysInfo && (
                    <p className="text-amber-500 font-bold mb-3 flex items-center gap-2 text-sm">
                      <span className="text-base">⚠</span>
                      {payload[0].payload.daysInfo}
                    </p>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span style={{ color: POST_TYPE_COLORS.photo }}>Photo RPP</span>
                      <span className="text-neutral-700">{payload[0]?.payload?.photoRppDotted !== null ? 'No posts' : `$${payload[0]?.payload?.photoRpp?.toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span style={{ color: POST_TYPE_COLORS.video }}>Video RPP</span>
                      <span className="text-neutral-700">{payload[0]?.payload?.videoRppDotted !== null ? 'No posts' : `$${payload[0]?.payload?.videoRpp?.toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span style={{ color: POST_TYPE_COLORS.textLink }}>Text/Link RPP</span>
                      <span className="text-neutral-700">{payload[0]?.payload?.textLinkRppDotted !== null ? 'No posts' : `$${payload[0]?.payload?.textLinkRpp?.toFixed(2)}`}</span>
                    </div>
                    <div className="border-t border-neutral-200 pt-1 mt-1">
                      <div className="flex justify-between gap-4">
                        <span style={{ color: '#525252' }}>Weighted Avg</span>
                        <span className="text-neutral-700">{payload[0]?.payload?.weightedAvgRppDotted !== null ? 'No posts' : `$${payload[0]?.payload?.weightedAvgRpp?.toFixed(2)}`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
          {active.has('photo') && (
            <Line
              type="monotone"
              dataKey="photoRpp"
              stroke={POST_TYPE_COLORS.photo}
              strokeWidth={2}
              name="Photo RPP"
              dot={(props: any) => {
                const { cx, cy, payload } = props
                if (payload.photoRppDotted !== null) {
                  const offset = 3
                  return (
                    <g key={`${cx}-${cy}`}>
                      <line x1={cx - offset} y1={cy - offset} x2={cx + offset} y2={cy + offset} stroke={POST_TYPE_COLORS.photo} strokeWidth={2} />
                      <line x1={cx - offset} y1={cy + offset} x2={cx + offset} y2={cy - offset} stroke={POST_TYPE_COLORS.photo} strokeWidth={2} />
                    </g>
                  )
                }
                return null
              }}
              isAnimationActive={false}
              connectNulls
            />
          )}
          {active.has('video') && (
            <Line
              type="monotone"
              dataKey="videoRpp"
              stroke={POST_TYPE_COLORS.video}
              strokeWidth={2}
              name="Video RPP"
              dot={(props: any) => {
                const { cx, cy, payload } = props
                if (payload.videoRppDotted !== null) {
                  const offset = 3
                  return (
                    <g key={`${cx}-${cy}`}>
                      <line x1={cx - offset} y1={cy - offset} x2={cx + offset} y2={cy + offset} stroke={POST_TYPE_COLORS.video} strokeWidth={2} />
                      <line x1={cx - offset} y1={cy + offset} x2={cx + offset} y2={cy - offset} stroke={POST_TYPE_COLORS.video} strokeWidth={2} />
                    </g>
                  )
                }
                return null
              }}
              isAnimationActive={false}
              connectNulls
            />
          )}
          {active.has('textLink') && (
            <Line
              type="monotone"
              dataKey="textLinkRpp"
              stroke={POST_TYPE_COLORS.textLink}
              strokeWidth={2}
              name="Text/Link RPP"
              dot={(props: any) => {
                const { cx, cy, payload } = props
                if (payload.textLinkRppDotted !== null) {
                  const offset = 3
                  return (
                    <g key={`${cx}-${cy}`}>
                      <line x1={cx - offset} y1={cy - offset} x2={cx + offset} y2={cy + offset} stroke={POST_TYPE_COLORS.textLink} strokeWidth={2} />
                      <line x1={cx - offset} y1={cy + offset} x2={cx + offset} y2={cy - offset} stroke={POST_TYPE_COLORS.textLink} strokeWidth={2} />
                    </g>
                  )
                }
                return null
              }}
              isAnimationActive={false}
              connectNulls
            />
          )}
          {active.has('weightedAvg') && (
            <Line
              type="monotone"
              dataKey="weightedAvgRpp"
              stroke="#525252"
              strokeWidth={2.5}
              name="Weighted Avg RPP"
              dot={(props: any) => {
                const { cx, cy, payload } = props
                if (payload.weightedAvgRppDotted !== null) {
                  const offset = 3
                  return (
                    <g key={`${cx}-${cy}`}>
                      <line x1={cx - offset} y1={cy - offset} x2={cx + offset} y2={cy + offset} stroke="#525252" strokeWidth={2} />
                      <line x1={cx - offset} y1={cy + offset} x2={cx + offset} y2={cy - offset} stroke="#525252" strokeWidth={2} />
                    </g>
                  )
                }
                return null
              }}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
