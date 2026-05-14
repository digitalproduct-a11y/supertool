export interface ParsedYouTubeRevenueRow {
  date: string
  revenue: number
}

export interface YouTubeParseResult {
  rows: ParsedYouTubeRevenueRow[]
  warnings: string[]
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
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function normalizeDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function toNum(raw: string, warnings: string[], context: string): number {
  if (raw === '' || raw == null) return 0
  const cleaned = String(raw).replace(/[$,\s]/g, '')
  const n = Number(cleaned)
  if (Number.isNaN(n)) {
    warnings.push(`${context}: non-numeric "${raw}" treated as 0`)
    return 0
  }
  if (n < 0) warnings.push(`${context}: negative value ${n}`)
  return n
}

/**
 * Accepts a CSV with header containing a Date column and a Revenue (or "Est.Revenue (USD)") column.
 * Case-insensitive header matching; ignores other columns.
 */
export async function parseYouTubeRevenueCsv(file: File): Promise<YouTubeParseResult> {
  const buf = await file.arrayBuffer()
  const text = decode(buf)
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)

  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase()
    if (lower.startsWith('sep=')) continue
    if (lower.includes('date') && (lower.includes('revenue') || lower.includes('est.revenue'))) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) {
    throw new Error('Could not find a header row containing both "Date" and "Revenue".')
  }

  const headers = splitCsvLine(lines[headerIdx]).map(h => h.replace(/^"|"$/g, '').toLowerCase())
  const dateCol = headers.findIndex(h => h === 'date' || h.startsWith('date'))
  const revCol = headers.findIndex(h =>
    h === 'revenue' ||
    h.includes('est.revenue') ||
    h.includes('estimated revenue') ||
    h === 'est revenue (usd)'
  )
  if (dateCol === -1 || revCol === -1) {
    throw new Error('CSV must contain a Date column and a Revenue column.')
  }

  const warnings: string[] = []
  const rowMap = new Map<string, ParsedYouTubeRevenueRow>()

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]).map(s => s.replace(/^"|"$/g, ''))
    if (parts.every(p => p === '')) continue

    const date = normalizeDate(parts[dateCol] ?? '')
    if (!date) {
      warnings.push(`Row ${i - headerIdx}: invalid date "${parts[dateCol]}", skipped`)
      continue
    }
    if (rowMap.has(date)) {
      warnings.push(`Duplicate date ${date} — later row overwrites earlier`)
    }
    rowMap.set(date, {
      date,
      revenue: toNum(parts[revCol] ?? '', warnings, `${date} revenue`),
    })
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  if (rows.length === 0) {
    throw new Error('No data rows found in file.')
  }
  return { rows, warnings }
}
