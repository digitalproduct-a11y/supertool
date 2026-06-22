import { useMemo } from 'react'
import { normalizeBrand } from '../utils/youtubeDashboardUtils'
import type { YouTubeDashboardRow } from '../utils/youtubeDashboardUtils'
import type { YouTubeTargetRow } from '../hooks/useYouTubeDashboardData'

export type SortBy =
  | 'brand-name'
  | 'revenue-decline'
  | 'revenue-improvement'
  | 'revenue-decline-amount'
  | 'revenue-improvement-amount'
  | 'videos-decline'
  | 'videos-improvement'
  | 'videos-decline-amount'
  | 'videos-improvement-amount'
  | 'watch-decline'
  | 'watch-improvement'
  | 'watch-decline-amount'
  | 'watch-improvement-amount'

interface BrandMetrics {
  brand: string
  bu: string
  videosTarget: number
  videosActual: number
  videosPercent: number
  videosWoW: number
  videosChange: number
  watchTarget: number
  watchActual: number
  watchPercent: number
  watchWoW: number
  watchChange: number
  revenueTarget: number
  revenueActual: number
  revenuePercent: number
  revenueWoW: number
  revenueChange: number
  flagStatus: 'Yes' | 'Partial' | 'No'
}

interface YouTubeWeeklyReportTableProps {
  data: YouTubeDashboardRow[]
  prevWeekData: YouTubeDashboardRow[]
  targets: YouTubeTargetRow[]
  sortBy: SortBy
}

const BUSINESS_UNIT_LABELS: Record<string, string> = {
  'AASB': 'Astro',
  'MBNS': 'Astro',
  'ARSB': 'Astro Radio',
  'NISB': 'Nu Ideaktiv',
}

const entityOrder = ['Astro', 'Astro Radio', 'Nu Ideaktiv']

function formatHours(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${Math.round(n)}`
}

// Brand names differ between YT_Data and YT_Targets (casing / "Astro " prefix) and the YT_Data
// sheet itself holds whitespace variants of the same channel (e.g. "热点 Hotspot" twice), which
// would otherwise split into duplicate rows. `normalizeBrand` (shared from youtubeDashboardUtils)
// collapses internal whitespace so variants merge into one bucket.

// Cleaned display name (collapse whitespace, trim) — keeps original casing for the table.
const cleanBrand = (s: string) => s.replace(/\s+/g, ' ').trim()

function aggregateByBrand(data: YouTubeDashboardRow[]) {
  const grouped: Record<string, { brand: string; videos: number; watch: number; revenue: number; bu: string }> = {}
  data.forEach(row => {
    const key = normalizeBrand(row.brand)
    if (!grouped[key]) {
      grouped[key] = { brand: cleanBrand(row.brand), videos: 0, watch: 0, revenue: 0, bu: row.business_unit }
    }
    grouped[key].videos += Number(row.videos_published) || 0
    grouped[key].watch += Number(row.watch_time) || 0
    grouped[key].revenue += Number(row.revenue) || 0
  })
  return grouped
}

export function YouTubeWeeklyReportTable({ data, prevWeekData, targets, sortBy }: YouTubeWeeklyReportTableProps) {
  const metrics = useMemo(() => {
    const current = aggregateByBrand(data)
    const prevWeek = aggregateByBrand(prevWeekData)

    const result: BrandMetrics[] = []

    Object.entries(current).forEach(([key, brandData]) => {
      const target = targets.find(t => normalizeBrand(String(t.Brand ?? '')) === key)
      const annualRevenue = Number(target?.['Annual Revenue Target (USD)']) || 0
      const dailyVideos = Number(target?.['Avg Vids Per Day\n2026 Target']) || 0
      const dailyWatch = Number(target?.['Daily Avg Watch Hour']) || 0
      const weeklyRevenueTarget = (annualRevenue / 365) * 7
      const weeklyVideosTarget = dailyVideos * 7
      const weeklyWatchTarget = dailyWatch * 7

      const prevWeekBrand = prevWeek[key]
      const prevRevenue = prevWeekBrand?.revenue || 0
      const prevVideos = prevWeekBrand?.videos || 0
      const prevWatch = prevWeekBrand?.watch || 0

      // True period-over-period change (this week − last week). Used for the "$ / # amount"
      // sorts and the displayed parenthetical change. WoW % stays relative (0 when there is no
      // prior week to compare against).
      const revenueChange = Math.round(brandData.revenue - prevRevenue)
      const videosChange = brandData.videos - prevVideos
      const watchChange = Math.round(brandData.watch - prevWatch)

      const revenueWoW = prevRevenue ? ((brandData.revenue - prevRevenue) / prevRevenue) * 100 : 0
      const videosWoW = prevVideos ? ((brandData.videos - prevVideos) / prevVideos) * 100 : 0
      const watchWoW = prevWatch ? ((brandData.watch - prevWatch) / prevWatch) * 100 : 0

      const revenuePercent = weeklyRevenueTarget > 0 ? (brandData.revenue / weeklyRevenueTarget) * 100 : 0
      const videosPercent = weeklyVideosTarget > 0 ? (brandData.videos / weeklyVideosTarget) * 100 : 0
      const watchPercent = weeklyWatchTarget > 0 ? (brandData.watch / weeklyWatchTarget) * 100 : 0

      const revenueUnderTarget = revenuePercent < 80
      const watchUnderTarget = watchPercent < 80

      let flagStatus: 'Yes' | 'Partial' | 'No'
      if (revenueUnderTarget && watchUnderTarget) {
        flagStatus = 'Yes'
      } else if (revenueUnderTarget || watchUnderTarget) {
        flagStatus = 'Partial'
      } else {
        flagStatus = 'No'
      }

      result.push({
        brand: brandData.brand,
        bu: brandData.bu,
        videosTarget: Math.round(weeklyVideosTarget),
        videosActual: brandData.videos,
        videosPercent,
        videosWoW,
        videosChange,
        watchTarget: Math.round(weeklyWatchTarget),
        watchActual: Math.round(brandData.watch),
        watchPercent,
        watchWoW,
        watchChange,
        revenueTarget: Math.round(weeklyRevenueTarget),
        revenueActual: Math.round(brandData.revenue),
        revenuePercent,
        revenueWoW,
        revenueChange,
        flagStatus,
      })
    })

    if (sortBy === 'revenue-decline') {
      return result.sort((a, b) => a.revenueWoW - b.revenueWoW)
    } else if (sortBy === 'revenue-improvement') {
      return result.sort((a, b) => b.revenueWoW - a.revenueWoW)
    } else if (sortBy === 'revenue-decline-amount') {
      return result.sort((a, b) => a.revenueChange - b.revenueChange)
    } else if (sortBy === 'revenue-improvement-amount') {
      return result.sort((a, b) => b.revenueChange - a.revenueChange)
    } else if (sortBy === 'videos-decline') {
      return result.sort((a, b) => a.videosWoW - b.videosWoW)
    } else if (sortBy === 'videos-improvement') {
      return result.sort((a, b) => b.videosWoW - a.videosWoW)
    } else if (sortBy === 'videos-decline-amount') {
      return result.sort((a, b) => a.videosChange - b.videosChange)
    } else if (sortBy === 'videos-improvement-amount') {
      return result.sort((a, b) => b.videosChange - a.videosChange)
    } else if (sortBy === 'watch-decline') {
      return result.sort((a, b) => a.watchWoW - b.watchWoW)
    } else if (sortBy === 'watch-improvement') {
      return result.sort((a, b) => b.watchWoW - a.watchWoW)
    } else if (sortBy === 'watch-decline-amount') {
      return result.sort((a, b) => a.watchChange - b.watchChange)
    } else if (sortBy === 'watch-improvement-amount') {
      return result.sort((a, b) => b.watchChange - a.watchChange)
    } else {
      return result.sort((a, b) => a.brand.localeCompare(b.brand))
    }
  }, [data, prevWeekData, targets, sortBy])

  const groupedByBU = useMemo(() => {
    const grouped: Record<string, BrandMetrics[]> = {}
    metrics.forEach(m => {
      const entity = BUSINESS_UNIT_LABELS[m.bu] || m.bu
      if (!grouped[entity]) grouped[entity] = []
      grouped[entity].push(m)
    })
    return grouped
  }, [metrics])

  const getWoWColor = (value: number) => {
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-neutral-600'
  }

  const formatWoW = (value: number, amount?: number, prefix?: string, formatAmount?: (n: number) => string) => {
    const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→'
    const percent = Math.abs(value).toFixed(1)
    if (amount !== undefined) {
      // Custom formatter (e.g. watch-hours with K/M suffix) takes precedence; sign is rendered
      // separately so the suffix logic only ever sees a positive magnitude.
      if (formatAmount) {
        return `${arrow}${percent}% (${amount >= 0 ? '+' : '-'}${formatAmount(Math.abs(amount))})`
      }
      const p = prefix ? prefix : ''
      return `${arrow}${percent}% (${amount >= 0 ? '+' : ''}${p}${amount.toLocaleString()})`
    }
    return `${arrow}${percent}%`
  }

  const renderRow = (m: BrandMetrics, i: number) => (
    <tr key={m.brand} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
      {/* Brand */}
      <td className="px-3 py-3 text-sm font-medium text-neutral-950 break-words" style={{ width: '100px' }}>{m.brand}</td>

      {/* Flag (Revenue + Watch Time) */}
      <td className="px-3 py-3 text-xs font-semibold" style={{ width: '70px' }}>
        <span className={m.flagStatus === 'Yes' ? 'text-red-600' : m.flagStatus === 'Partial' ? 'text-yellow-600' : 'text-green-600'}>
          {m.flagStatus}
        </span>
      </td>

      {/* Revenue */}
      <td className="px-4 py-3" style={{ width: '300px' }}>
        <div className="space-y-0.5">
          <div className="h-4 bg-neutral-100 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 flex items-center justify-center"
              style={{ width: `${Math.min(100, m.revenuePercent)}%` }}
            >
              {m.revenuePercent > 30 && (
                <span className="text-[9px] font-semibold text-white">
                  {m.revenuePercent.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-neutral-500">
              ${m.revenueActual.toLocaleString()} / ${m.revenueTarget.toLocaleString()}
            </p>
            <span className={`text-[10px] font-medium ${getWoWColor(m.revenueWoW)}`}>
              {formatWoW(m.revenueWoW, m.revenueChange, '$')}
            </span>
          </div>
        </div>
      </td>

      {/* Videos */}
      <td className="px-4 py-3" style={{ width: '280px' }}>
        <div className="space-y-0.5">
          <div className="h-4 bg-neutral-100 rounded overflow-hidden">
            <div
              className="h-full bg-pink-500 flex items-center justify-center"
              style={{ width: `${Math.min(100, m.videosPercent)}%` }}
            >
              {m.videosPercent > 30 && (
                <span className="text-[9px] font-semibold text-white">
                  {m.videosPercent.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-neutral-500">
              {m.videosActual} / {m.videosTarget}
            </p>
            <span className={`text-[10px] font-medium ${getWoWColor(m.videosWoW)}`}>
              {formatWoW(m.videosWoW, m.videosChange)}
            </span>
          </div>
        </div>
      </td>

      {/* Watch Time */}
      <td className="px-4 py-3" style={{ width: '300px' }}>
        <div className="space-y-0.5">
          <div className="h-4 bg-neutral-100 rounded overflow-hidden">
            <div
              className="h-full bg-cyan-500 flex items-center justify-center"
              style={{ width: `${Math.min(100, m.watchPercent)}%` }}
            >
              {m.watchPercent > 30 && (
                <span className="text-[9px] font-semibold text-white">
                  {m.watchPercent.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-neutral-500">
              {formatHours(m.watchActual)}h / {formatHours(m.watchTarget)}h
            </p>
            <span className={`text-[10px] font-medium ${getWoWColor(m.watchWoW)}`}>
              {formatWoW(m.watchWoW, m.watchChange, undefined, (n) => `${formatHours(n)}h`)}
            </span>
          </div>
        </div>
      </td>
    </tr>
  )

  const renderTable = (rows: BrandMetrics[]) => (
    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
      <table className="w-full" style={{ tableLayout: 'fixed' }}>
        <thead className="bg-neutral-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '100px' }}>Brand</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '70px' }}>Flag</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '300px' }}>Revenue</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '280px' }}>Videos</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '300px' }}>Watch Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {rows.map((m, i) => renderRow(m, i))}
        </tbody>
      </table>
    </div>
  )

  // Default sort = grouped by business unit. Any explicit sort = a single flat global ranking
  // so the top row is the biggest mover across ALL brands (not just within its group).
  if (sortBy !== 'brand-name') {
    return <div className="space-y-6">{renderTable(metrics)}</div>
  }

  return (
    <div className="space-y-6">
      {entityOrder.map(entity => {
        const brandMetrics = groupedByBU[entity] || []
        if (brandMetrics.length === 0) return null

        return (
          <div key={entity}>
            {/* Entity header */}
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-widest mb-2">
              {entity}
            </h3>
            {renderTable(brandMetrics)}
          </div>
        )
      })}
    </div>
  )
}
