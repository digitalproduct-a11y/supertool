export interface YouTubeDashboardRow {
  date: string
  month: string
  week: string
  day: string
  brand: string
  business_unit: string
  videos_published: number
  watch_time: number
  revenue: number
}

export interface YouTubeAggregated extends Omit<YouTubeDashboardRow, 'date' | 'day'> {
  date: string
  daysInfo?: string
  weekRange?: string
}

// The YT_Data sheet holds whitespace/casing/"Astro " variants of the same channel
// (e.g. "热点 Hotspot" with single vs double space). Normalize before comparing so
// variants merge into one brand instead of splitting into duplicates.
export const normalizeBrand = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^astro\s+/, '')

export function filterYouTubeData(
  data: YouTubeDashboardRow[],
  brand: string,
  startDate: Date,
  endDate: Date,
  businessUnit?: string
): YouTubeDashboardRow[] {
  return data.filter(row => {
    const rowDate = new Date(row.date)
    const isBrandMatch = normalizeBrand(row.brand) === normalizeBrand(brand)
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

const SUM_KEYS = ['videos_published', 'watch_time', 'revenue'] as const

function sumRows(rows: YouTubeDashboardRow[]) {
  const acc: Record<typeof SUM_KEYS[number], number> = {
    videos_published: 0,
    watch_time: 0,
    revenue: 0,
  }
  for (const r of rows) {
    acc.videos_published += Number(r.videos_published) || 0
    acc.watch_time += Number(r.watch_time) || 0
    acc.revenue += Number(r.revenue) || 0
  }
  return acc
}

export function aggregateByMonth(data: YouTubeDashboardRow[]): YouTubeAggregated[] {
  const grouped = new Map<string, YouTubeDashboardRow[]>()
  data.forEach(row => {
    const key = row.date.slice(0, 7)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  })
  const entries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
  return entries.map(([month, rows]) => {
    const totalDays = daysInMonth(month)
    const isPartial = rows.length < totalDays
    return {
      ...rows[0],
      ...sumRows(rows),
      date: monthDisplayLabel(month),
      week: month,
      daysInfo: isPartial ? `${rows.length}/${totalDays} days` : undefined,
    }
  })
}

export function aggregateByWeek(data: YouTubeDashboardRow[]): YouTubeAggregated[] {
  const grouped = new Map<string, YouTubeDashboardRow[]>()
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
      ...sumRows(rows),
      week: row0.week,
      date: `${monthLabel} ${row0.week}`,
      daysInfo: isPartial ? `${rows.length}/7 days` : undefined,
      weekRange,
    }
  })
}

// Day-of-year (1-based) for a "YYYY-MM-DD" string. Jan 1 → 1.
export function dayOfYear(yyyyMMdd: string): number {
  const [y, m, d] = yyyyMMdd.split('-').map(Number)
  const start = Date.UTC(y, 0, 1)
  const current = Date.UTC(y, m - 1, d)
  return Math.floor((current - start) / 86400000) + 1
}

export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365
}

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
