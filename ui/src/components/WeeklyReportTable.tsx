import { useMemo } from 'react'
import type { DashboardRow } from '../utils/dashboardUtils'

type SortBy = 'brand-name' | 'revenue-decline' | 'revenue-improvement' | 'revenue-decline-amount' | 'revenue-improvement-amount' | 'posts-decline' | 'posts-improvement' | 'posts-decline-amount' | 'posts-improvement-amount'

interface BrandMetrics {
  brand: string
  bu: string
  postsTarget: number
  postsActual: number
  postsPercent: number
  postsWoW: number
  revenueTarget: number
  revenueActual: number
  revenuePercent: number
  revenueWoW: number
  interactions: number
  interactionsWoW: number
  pic?: string
  weeklyMeetingStatus?: string
  isFlagged?: boolean
  flagStatus?: 'Yes' | 'Partial' | 'No'
}

interface WeeklyReportTableProps {
  data: DashboardRow[]
  prevWeekData: DashboardRow[]
  targets: Array<{ Brand: string; 'Annual Revenue Target (USD)': number; 'Avg Posts Per Day': number; PIC?: string; 'WEEKLY MEETING'?: string }>
  sortBy: SortBy
  weeklyMeetingMode?: boolean
}

const BUSINESS_UNIT_LABELS: Record<string, string> = {
  'AASB': 'Astro',
  'MBNS': 'Astro',
  'ARSB': 'Astro Radio',
  'NISB': 'Nu Ideaktiv',
}

function aggregateByBrand(data: DashboardRow[]) {
  const grouped: Record<string, { posts: number; revenue: number; interactions: number; bu: string }> = {}
  data.forEach(row => {
    if (!grouped[row.brand]) {
      grouped[row.brand] = { posts: 0, revenue: 0, interactions: 0, bu: row.business_unit }
    }
    grouped[row.brand].posts += row.total_posts || 0
    grouped[row.brand].revenue += row.total_revenue || 0
    grouped[row.brand].interactions += row.total_interactions || 0
  })
  return grouped
}

export function WeeklyReportTable({ data, prevWeekData, targets, sortBy, weeklyMeetingMode }: WeeklyReportTableProps) {
  const metrics = useMemo(() => {
    const current = aggregateByBrand(data)
    const prevWeek = aggregateByBrand(prevWeekData)

    const result: BrandMetrics[] = []

    Object.entries(current).forEach(([brand, brandData]) => {
      const target = targets.find(t => t.Brand === brand)
      const dailyTarget = target ? target['Annual Revenue Target (USD)'] / 365 : 0
      const weeklyRevenueTarget = dailyTarget * 7
      const weeklyPostsTarget = target ? target['Avg Posts Per Day'] * 7 : 0

      const prevWeekBrand = prevWeek[brand]
      const revenueWoW = prevWeekBrand?.revenue ? ((brandData.revenue - prevWeekBrand.revenue) / prevWeekBrand.revenue) * 100 : 0
      const postsWoW = prevWeekBrand?.posts ? ((brandData.posts - prevWeekBrand.posts) / prevWeekBrand.posts) * 100 : 0
      const interactionsWoW = prevWeekBrand?.interactions ? ((brandData.interactions - prevWeekBrand.interactions) / prevWeekBrand.interactions) * 100 : 0

      const revenuePercent = weeklyRevenueTarget > 0 ? (brandData.revenue / weeklyRevenueTarget) * 100 : 0
      const postsPercent = weeklyPostsTarget > 0 ? (brandData.posts / weeklyPostsTarget) * 100 : 0

      const revenueUnderTarget = revenuePercent < 80
      const postsUnderTarget = postsPercent < 80

      let flagStatus: 'Yes' | 'Partial' | 'No'
      if (revenueUnderTarget && postsUnderTarget) {
        flagStatus = 'Yes'
      } else if (revenueUnderTarget || postsUnderTarget) {
        flagStatus = 'Partial'
      } else {
        flagStatus = 'No'
      }

      result.push({
        brand,
        bu: brandData.bu,
        postsTarget: Math.round(weeklyPostsTarget),
        postsActual: brandData.posts,
        postsPercent,
        postsWoW,
        revenueTarget: Math.round(weeklyRevenueTarget),
        revenueActual: Math.round(brandData.revenue),
        revenuePercent,
        revenueWoW,
        interactions: brandData.interactions,
        interactionsWoW,
        pic: target?.PIC,
        weeklyMeetingStatus: target?.['WEEKLY MEETING'],
        isFlagged: revenueUnderTarget || postsUnderTarget,
        flagStatus,
      })
    })

    // Filter for weekly meeting mode
    let filtered = result
    if (weeklyMeetingMode) {
      filtered = result.filter(m => m.weeklyMeetingStatus === 'PRIORITY' || m.weeklyMeetingStatus === 'TO GROW')
    }

    // Apply sorting
    if (weeklyMeetingMode) {
      // Weekly Meeting mode: sort by priority first, then by revenue target
      return filtered.sort((a, b) => {
        const priorityOrder = { 'PRIORITY': 0, 'TO GROW': 1 }
        const aPriority = priorityOrder[a.weeklyMeetingStatus as keyof typeof priorityOrder] ?? 2
        const bPriority = priorityOrder[b.weeklyMeetingStatus as keyof typeof priorityOrder] ?? 2
        if (aPriority !== bPriority) return aPriority - bPriority
        return b.revenueTarget - a.revenueTarget
      })
    } else if (sortBy === 'revenue-decline') {
      return filtered.sort((a, b) => a.revenueWoW - b.revenueWoW)
    } else if (sortBy === 'revenue-improvement') {
      return filtered.sort((a, b) => b.revenueWoW - a.revenueWoW)
    } else if (sortBy === 'revenue-decline-amount') {
      return filtered.sort((a, b) => (a.revenueActual * a.revenueWoW / 100) - (b.revenueActual * b.revenueWoW / 100))
    } else if (sortBy === 'revenue-improvement-amount') {
      return filtered.sort((a, b) => (b.revenueActual * b.revenueWoW / 100) - (a.revenueActual * a.revenueWoW / 100))
    } else if (sortBy === 'posts-decline') {
      return filtered.sort((a, b) => a.postsWoW - b.postsWoW)
    } else if (sortBy === 'posts-improvement') {
      return filtered.sort((a, b) => b.postsWoW - a.postsWoW)
    } else if (sortBy === 'posts-decline-amount') {
      return filtered.sort((a, b) => (a.postsActual * a.postsWoW / 100) - (b.postsActual * b.postsWoW / 100))
    } else if (sortBy === 'posts-improvement-amount') {
      return filtered.sort((a, b) => (b.postsActual * b.postsWoW / 100) - (a.postsActual * a.postsWoW / 100))
    } else {
      // Default: brand name
      return filtered.sort((a, b) => a.brand.localeCompare(b.brand))
    }
  }, [data, prevWeekData, targets, sortBy, weeklyMeetingMode])

  const groupedByBU = useMemo(() => {
    const grouped: Record<string, BrandMetrics[]> = {}
    metrics.forEach(m => {
      const entity = BUSINESS_UNIT_LABELS[m.bu] || m.bu
      if (!grouped[entity]) grouped[entity] = []
      grouped[entity].push(m)
    })
    return grouped
  }, [metrics])

  const entityOrder = ['Astro', 'Astro Radio', 'Nu Ideaktiv']

  const getWoWColor = (value: number) => {
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-neutral-600'
  }

  const formatWoW = (value: number, amount?: number, currency?: string) => {
    const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→'
    const percent = Math.abs(value).toFixed(1)
    if (amount !== undefined) {
      const prefix = currency ? currency : ''
      return `${arrow}${percent}% (${amount >= 0 ? '+' : ''}${prefix}${amount})`
    }
    return `${arrow}${percent}%`
  }

  if (weeklyMeetingMode) {
    // Group by PIC
    const groupedByPIC: Record<string, BrandMetrics[]> = {}
    metrics.forEach(m => {
      const pic = m.pic || 'Unassigned'
      if (!groupedByPIC[pic]) groupedByPIC[pic] = []
      groupedByPIC[pic].push(m)
    })

    return (
      <div className="space-y-6">
        {Object.entries(groupedByPIC).map(([pic, brands]) => (
          <div key={pic}>
            {/* PIC header */}
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-widest mb-2">
              {pic}
            </h3>

            {/* Table */}
            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '100px' }}>Brand</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '80px' }}>Flag</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '320px' }}>Revenue</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '320px' }}>Posts</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '120px' }}>Interactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {brands.map((m, i) => (
                    <tr key={m.brand} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                      {/* Brand */}
                      <td className="px-3 py-3 text-sm font-medium text-neutral-950 break-words" style={{ width: '100px' }}>{m.brand}</td>

                      {/* Flag */}
                      <td className="px-4 py-3 text-xs font-semibold" style={{ width: '80px' }}>
                        <span className={m.flagStatus === 'Yes' ? 'text-red-600' : m.flagStatus === 'Partial' ? 'text-yellow-600' : 'text-green-600'}>
                          {m.flagStatus}
                        </span>
                      </td>

                      {/* Revenue */}
                      <td className="px-4 py-3" style={{ width: '320px' }}>
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
                              {formatWoW(m.revenueWoW, Math.round(m.revenueActual * m.revenueWoW / 100), '$')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Posts */}
                      <td className="px-4 py-3" style={{ width: '320px' }}>
                        <div className="space-y-0.5">
                          <div className="h-4 bg-neutral-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-blue-500 flex items-center justify-center"
                              style={{ width: `${Math.min(100, m.postsPercent)}%` }}
                            >
                              {m.postsPercent > 30 && (
                                <span className="text-[9px] font-semibold text-white">
                                  {m.postsPercent.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-neutral-500">
                              {m.postsActual} / {m.postsTarget}
                            </p>
                            <span className={`text-[10px] font-medium ${getWoWColor(m.postsWoW)}`}>
                              {formatWoW(m.postsWoW, Math.round(m.postsActual * m.postsWoW / 100))}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Interactions */}
                      <td className="px-3 py-3" style={{ width: '120px' }}>
                        <div>
                          <div className="text-sm font-semibold text-neutral-950 leading-tight">
                            {(m.interactions / 1000).toFixed(1)}K
                          </div>
                          <span className={`text-[10px] font-medium ${getWoWColor(m.interactionsWoW)}`}>
                            {formatWoW(m.interactionsWoW, Math.round(m.interactions * m.interactionsWoW / 100))}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Normal mode: entity-grouped view
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

            {/* Table */}
            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '120px' }}>Brand</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '350px' }}>Revenue</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '350px' }}>Posts</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '150px' }}>Interactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {brandMetrics.map((m, i) => (
                    <tr key={m.brand} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                      {/* Brand */}
                      <td className="px-3 py-3" style={{ width: '120px' }}>
                        <div>
                          <div className="text-sm font-medium text-neutral-950 truncate">{m.brand}</div>
                          {m.pic && (
                            <div className="text-[10px] text-neutral-500">{m.pic}</div>
                          )}
                        </div>
                      </td>

                      {/* Revenue */}
                      <td className="px-4 py-3" style={{ width: '350px' }}>
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
                              {formatWoW(m.revenueWoW, Math.round(m.revenueActual * m.revenueWoW / 100), '$')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Posts */}
                      <td className="px-4 py-3" style={{ width: '350px' }}>
                        <div className="space-y-0.5">
                          <div className="h-4 bg-neutral-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-blue-500 flex items-center justify-center"
                              style={{ width: `${Math.min(100, m.postsPercent)}%` }}
                            >
                              {m.postsPercent > 30 && (
                                <span className="text-[9px] font-semibold text-white">
                                  {m.postsPercent.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-neutral-500">
                              {m.postsActual} / {m.postsTarget}
                            </p>
                            <span className={`text-[10px] font-medium ${getWoWColor(m.postsWoW)}`}>
                              {formatWoW(m.postsWoW, Math.round(m.postsActual * m.postsWoW / 100))}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Interactions */}
                      <td className="px-3 py-3" style={{ width: '150px' }}>
                        <div>
                          <div className="text-sm font-semibold text-neutral-950 leading-tight">
                            {(m.interactions / 1000).toFixed(1)}K
                          </div>
                          <span className={`text-[10px] font-medium ${getWoWColor(m.interactionsWoW)}`}>
                            {formatWoW(m.interactionsWoW, Math.round(m.interactions * m.interactionsWoW / 100))}
                          </span>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
