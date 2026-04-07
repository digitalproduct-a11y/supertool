import { useState, useEffect, useCallback } from 'react'

export interface RawEvent {
  timestamp: string
  event_type: string
  tool_id: string
  tool_label: string
  brand: string
  session_id: string
  error_message: string
  step: string
}

export type DatePreset = 'today' | 'last7' | 'last30' | 'custom'

export interface DateRange {
  from: Date
  to: Date
}

function subDays(d: Date, n: number): Date {
  return new Date(d.getTime() - n * 864e5)
}

function presetToRange(preset: DatePreset, custom?: DateRange): DateRange {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === 'today') return { from: startOfToday, to: now }
  if (preset === 'last7') return { from: subDays(startOfToday, 6), to: now }
  if (preset === 'last30') return { from: subDays(startOfToday, 29), to: now }
  return custom ?? { from: subDays(startOfToday, 6), to: now }
}

async function fetchEvents(range: DateRange): Promise<RawEvent[]> {
  const url = (import.meta.env.VITE_ANALYTICS_READ_URL as string | undefined)?.trim()
  if (!url) throw new Error('VITE_ANALYTICS_READ_URL is not configured.')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: range.from.toISOString(), to: range.to.toISOString() }),
  })

  if (res.status === 404) throw new Error('The analytics read endpoint has not been set up yet in n8n. Create a webhook workflow that queries the Google Sheet and returns a JSON array.')
  if (!res.ok) throw new Error(`Analytics fetch failed (HTTP ${res.status}).`)

  const data: unknown = await res.json()
  if (!Array.isArray(data)) throw new Error('Unexpected response format — expected a JSON array of events.')
  return data as RawEvent[]
}

export function useAnalyticsData() {
  const [preset, setPresetState] = useState<DatePreset>('last7')
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const dateRange = presetToRange(preset, customRange)

  const [events, setEvents] = useState<RawEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const range = presetToRange(preset, customRange)
    setLoading(true)
    setError(null)
    try {
      const data = await fetchEvents(range)
      setEvents(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [preset, customRange])

  useEffect(() => { void refetch() }, [refetch])

  const setPreset = (p: DatePreset) => {
    setPresetState(p)
    if (p !== 'custom') setCustomRange(undefined)
  }

  return { events, loading, error, dateRange, preset, setPreset, setCustomRange, refetch }
}
