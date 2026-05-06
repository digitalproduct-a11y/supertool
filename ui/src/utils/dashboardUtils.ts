export interface DashboardRow {
  date: string
  month: string
  week: string
  day: string
  brand: string
  business_unit: string
  profile_id: number
  total_posts: number
  photo_posts: number
  video_posts: number
  text_link_posts: number
  total_interactions: number
  reactions: number
  comments: number
  shares: number
  total_revenue: number
  bonus_revenue: number
  photo_revenue: number
  video_revenue: number
  story_revenue: number
  text_link_revenue: number
}

export interface WeeklyAggregated extends Omit<DashboardRow, 'date' | 'day'> {
  date: string
  daysInfo?: string   // e.g. "3/7 days" — set when period is incomplete
  weekRange?: string  // e.g. "2 Feb – 8 Feb" — set for weekly aggregation only
}

// Filter data by brand, date range, and business unit
export function filterDashboardData(
  data: DashboardRow[],
  brand: string,
  startDate: Date,
  endDate: Date,
  businessUnit?: string
): DashboardRow[] {
  return data.filter(row => {
    const rowDate = new Date(row.date)
    const isBrandMatch = row.brand === brand
    const isBUMatch = !businessUnit || row.business_unit === businessUnit
    const isDateMatch = rowDate >= startDate && rowDate <= endDate
    return isBrandMatch && isBUMatch && isDateMatch
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function daysInMonth(yyyyMM: string): number {
  const [y, m] = yyyyMM.split('-')
  return new Date(Number(y), Number(m), 0).getDate()
}

function monthDisplayLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

// Aggregate daily data by month
export function aggregateByMonth(data: DashboardRow[]): WeeklyAggregated[] {
  const grouped = new Map<string, DashboardRow[]>()

  data.forEach(row => {
    const key = row.date.slice(0, 7) // "YYYY-MM"
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  })

  const entries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))

  return entries.map(([month, rows]) => {
    const totalDays = daysInMonth(month)
    const isPartial = rows.length < totalDays
    return {
      ...rows[0],
      date: monthDisplayLabel(month),
      week: month,
      daysInfo: isPartial ? `${rows.length}/${totalDays} days` : undefined,
      total_posts: rows.reduce((s, r) => s + r.total_posts, 0),
      photo_posts: rows.reduce((s, r) => s + r.photo_posts, 0),
      video_posts: rows.reduce((s, r) => s + r.video_posts, 0),
      text_link_posts: rows.reduce((s, r) => s + r.text_link_posts, 0),
      total_interactions: rows.reduce((s, r) => s + r.total_interactions, 0),
      reactions: rows.reduce((s, r) => s + r.reactions, 0),
      comments: rows.reduce((s, r) => s + r.comments, 0),
      shares: rows.reduce((s, r) => s + r.shares, 0),
      total_revenue: rows.reduce((s, r) => s + r.total_revenue, 0),
      bonus_revenue: rows.reduce((s, r) => s + r.bonus_revenue, 0),
      photo_revenue: rows.reduce((s, r) => s + r.photo_revenue, 0),
      video_revenue: rows.reduce((s, r) => s + r.video_revenue, 0),
      story_revenue: rows.reduce((s, r) => s + r.story_revenue, 0),
      text_link_revenue: rows.reduce((s, r) => s + r.text_link_revenue, 0),
    }
  })
}

// Aggregate daily data by week
export function aggregateByWeek(data: DashboardRow[]): WeeklyAggregated[] {
  const grouped = new Map<string, DashboardRow[]>()

  data.forEach(row => {
    const key = `${row.month}|${row.week}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  })

  const entries = Array.from(grouped.entries()).sort(([, a], [, b]) => {
    const aMin = a.reduce((m, r) => r.date < m ? r.date : m, a[0].date)
    const bMin = b.reduce((m, r) => r.date < m ? r.date : m, b[0].date)
    return aMin.localeCompare(bMin)
  })

  return entries.map(([, rows]) => {
    const row0 = rows[0]
    const isPartial = rows.length < 7
    const dates = rows.map(r => r.date).sort()
    const fmtDay = (d: string) => {
      const [, m, day] = d.split('-')
      return `${Number(day)} ${MONTHS[Number(m) - 1]}`
    }
    const weekRange = `${fmtDay(dates[0])} – ${fmtDay(dates[dates.length - 1])}`
    const monthLabel = /^\d{4}-\d{2}$/.test(row0.month)
      ? monthDisplayLabel(row0.month)
      : row0.month.split(' ')[0]
    return {
      ...row0,
      week: row0.week,
      date: `${monthLabel} ${row0.week}`,
      daysInfo: isPartial ? `${rows.length}/7 days` : undefined,
      weekRange,
      total_posts: rows.reduce((sum, r) => sum + r.total_posts, 0),
      photo_posts: rows.reduce((sum, r) => sum + r.photo_posts, 0),
      video_posts: rows.reduce((sum, r) => sum + r.video_posts, 0),
      text_link_posts: rows.reduce((sum, r) => sum + r.text_link_posts, 0),
      total_interactions: rows.reduce((sum, r) => sum + r.total_interactions, 0),
      reactions: rows.reduce((sum, r) => sum + r.reactions, 0),
      comments: rows.reduce((sum, r) => sum + r.comments, 0),
      shares: rows.reduce((sum, r) => sum + r.shares, 0),
      total_revenue: rows.reduce((sum, r) => sum + r.total_revenue, 0),
      bonus_revenue: rows.reduce((sum, r) => sum + r.bonus_revenue, 0),
      photo_revenue: rows.reduce((sum, r) => sum + r.photo_revenue, 0),
      video_revenue: rows.reduce((sum, r) => sum + r.video_revenue, 0),
      story_revenue: rows.reduce((sum, r) => sum + r.story_revenue, 0),
      text_link_revenue: rows.reduce((sum, r) => sum + r.text_link_revenue, 0),
    }
  })
}

// Get last 30 days from today
export function getLast30Days(): [Date, Date] {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  return [startDate, endDate]
}

// Format date for display
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Format a "YYYY-MM-DD" or "YYYY-MM" string to DD/MM/YYYY or MM/YYYY
export function formatDateLabel(value: string): string {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-')
    return `${m}/${y}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return value
}
