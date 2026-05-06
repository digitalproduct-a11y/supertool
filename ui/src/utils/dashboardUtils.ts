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
  date: string // First date of week
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

// Aggregate daily data by week
export function aggregateByWeek(data: DashboardRow[]): WeeklyAggregated[] {
  const grouped = new Map<string, DashboardRow[]>()

  data.forEach(row => {
    const key = row.week
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  })

  const result: WeeklyAggregated[] = []
  grouped.forEach((rows, week) => {
    const firstRow = rows[0]
    const aggregated: WeeklyAggregated = {
      ...firstRow,
      week: week,
      date: rows[0].date,
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
    result.push(aggregated)
  })

  return result
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
