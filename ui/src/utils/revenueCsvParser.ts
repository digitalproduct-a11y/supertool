export interface ParsedRevenueRow {
  date: string
  total_revenue: number
  bonus_revenue: number
  photo_revenue: number
  video_revenue: number
  story_revenue: number
  text_link_revenue: number
}

export interface ParseResult {
  rows: ParsedRevenueRow[]
  warnings: string[]
}

const COLUMN_MAP: Record<string, keyof ParsedRevenueRow> = {
  Date: 'date',
  Primary: 'total_revenue',
  extra_bonus: 'bonus_revenue',
  image: 'photo_revenue',
  reel: 'video_revenue',
  story: 'story_revenue',
  text: 'text_link_revenue',
}

function decode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.slice(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.slice(2))
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (ch === ',' && !inQuote) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function normalizeDate(raw: string): string | null {
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function toNum(raw: string, warnings: string[], context: string): number {
  if (raw === '' || raw == null) return 0
  const n = Number(raw)
  if (Number.isNaN(n)) {
    warnings.push(`${context}: non-numeric value "${raw}" treated as 0`)
    return 0
  }
  if (n < 0) {
    warnings.push(`${context}: negative value ${n}`)
  }
  return n
}

export async function parseRevenueCsv(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer()
  const text = decode(buf)
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)

  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l.toLowerCase().startsWith('sep=')) continue
    if (l.toLowerCase().includes('approximate earnings') && !l.toLowerCase().includes('date')) continue
    if (l.startsWith('"Date"') || l.startsWith('Date,') || l.toLowerCase().startsWith('"date"')) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    throw new Error('Could not find header row (expected a row starting with "Date").')
  }

  const headers = splitCsvLine(lines[headerIdx]).map(h => h.replace(/^"|"$/g, ''))
  const missing = Object.keys(COLUMN_MAP).filter(k => !headers.includes(k))
  if (missing.length > 0) {
    throw new Error(`Missing expected columns: ${missing.join(', ')}`)
  }

  const warnings: string[] = []
  const seenDates = new Set<string>()
  const rowMap = new Map<string, ParsedRevenueRow>()

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]).map(s => s.replace(/^"|"$/g, ''))
    if (parts.every(p => p === '')) continue

    const rowObj: Record<string, string> = {}
    headers.forEach((h, idx) => { rowObj[h] = parts[idx] ?? '' })

    const date = normalizeDate(rowObj.Date)
    if (!date) {
      warnings.push(`Row ${i - headerIdx}: invalid date "${rowObj.Date}", skipped`)
      continue
    }

    if (seenDates.has(date)) {
      warnings.push(`Duplicate date ${date} — later row overwrites earlier`)
    }
    seenDates.add(date)

    rowMap.set(date, {
      date,
      total_revenue: toNum(rowObj.Primary, warnings, `${date} total`),
      bonus_revenue: toNum(rowObj.extra_bonus, warnings, `${date} bonus`),
      photo_revenue: toNum(rowObj.image, warnings, `${date} photo`),
      video_revenue: toNum(rowObj.reel, warnings, `${date} video`),
      story_revenue: toNum(rowObj.story, warnings, `${date} story`),
      text_link_revenue: toNum(rowObj.text, warnings, `${date} text_link`),
    })
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  if (rows.length === 0) {
    throw new Error('No data rows found in file.')
  }

  return { rows, warnings }
}
