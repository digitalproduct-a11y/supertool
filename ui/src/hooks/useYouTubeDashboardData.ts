import { useState, useEffect, useCallback, useRef } from 'react'
import LZString from 'lz-string'
import type { YouTubeDashboardRow } from '../utils/youtubeDashboardUtils'

// True when `ts` falls on a different local calendar day than right now.
// Null (no prior fetch) counts as stale so a fresh open always fetches.
const isFromPreviousDay = (ts: Date | null): boolean => {
  if (!ts) return true
  return ts.toDateString() !== new Date().toDateString()
}

export interface YouTubeTargetRow {
  Brand: string
  'Annual Revenue Target (USD)'?: number
  'Avg Vids Per Day'?: number
  'Daily Avg Watch Hour'?: number
  [key: string]: unknown
}

interface CachedData {
  data: YouTubeDashboardRow[]
  targets: YouTubeTargetRow[]
  lastUpdated: string
}

const STORAGE_KEY = 'youtube_dashboard_data_v2'

// The Meta dashboard cache (~4.4MB) nearly fills the ~5MB localStorage quota,
// so an uncompressed YT write throws QuotaExceededError and never persists —
// forcing a loading skeleton on every remount. Compressing the YT payload
// (~0.3MB → ~40KB) lets it fit in the leftover space. Reads stay synchronous,
// preserving instant render-on-mount from cache.
function readCache(): CachedData | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const json = LZString.decompressFromUTF16(raw)
    if (json) return JSON.parse(json) as CachedData
  } catch { /* fall through to legacy uncompressed */ }
  try { return JSON.parse(raw) as CachedData } catch { return null }
}

function writeCache(value: CachedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, LZString.compressToUTF16(JSON.stringify(value)))
  } catch { /* quota/serialize failure — skip cache; data still lives in state */ }
}

export function useYouTubeDashboardData() {
  const [data, setData] = useState<YouTubeDashboardRow[]>(() => {
    const parsed = readCache()
    return parsed && Array.isArray(parsed.data) ? parsed.data : []
  })
  const [targets, setTargets] = useState<YouTubeTargetRow[]>(() => {
    const parsed = readCache()
    return parsed && Array.isArray(parsed.targets) ? parsed.targets : []
  })
  const [loading, setLoading] = useState(() => {
    const parsed = readCache()
    return !(parsed && Array.isArray(parsed.data) && parsed.data.length > 0)
  })
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    const parsed = readCache()
    return parsed?.lastUpdated ? new Date(parsed.lastUpdated) : null
  })

  // In-flight guard so rapid double-triggers (mount + visibilitychange, or
  // double-clicked Refresh) collapse to a single network call.
  const inFlightRef = useRef<boolean>(false)

  const fetchData = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    setError(null)
    try {
      const webhookUrl = import.meta.env.VITE_YT_DASHBOARD_WEBHOOK_URL as string | undefined
      if (!webhookUrl) throw new Error('VITE_YT_DASHBOARD_WEBHOOK_URL not configured')

      const response = await fetch(webhookUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      let result = await response.json() as unknown
      if (typeof result === 'string') result = JSON.parse(result)

      let dataArray: YouTubeDashboardRow[] = []
      let targetsArray: YouTubeTargetRow[] = []

      if (Array.isArray(result) && result.length > 0 && result[0] != null) {
        const responseItem = result[0] as any
        if (responseItem.targets && Array.isArray(responseItem.targets) && responseItem.targets[0]?.json?.data) {
          targetsArray = responseItem.targets[0].json.data as YouTubeTargetRow[]
        }
        if (responseItem.data && Array.isArray(responseItem.data)) {
          dataArray = responseItem.data.flatMap((item: any) => {
            if (item?.json?.data && Array.isArray(item.json.data)) return item.json.data
            return []
          }) as YouTubeDashboardRow[]
        } else {
          throw new Error('Response missing data array')
        }
      } else {
        throw new Error(`Unrecognised response format: ${JSON.stringify(result).slice(0, 100)}`)
      }

      setData(dataArray)
      setTargets(targetsArray)
      const updated = new Date()
      setLastUpdated(updated)
      writeCache({
        data: dataArray,
        targets: targetsArray,
        lastUpdated: updated.toISOString(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('YT dashboard fetch error:', message)
      setError(message)
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    // Stale-while-revalidate: render cached rows instantly but refetch if the
    // cache is from a previous local day (or missing). Same-day cache hits
    // skip the network round-trip.
    const parsed = readCache()
    if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
      const cachedAt = parsed.lastUpdated ? new Date(parsed.lastUpdated) : null
      if (!isFromPreviousDay(cachedAt)) return
    }
    lastAutoAttemptDateRef.current = new Date().toDateString()
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refetch when the tab becomes visible on a new calendar day so long-lived
  // tabs don't keep showing yesterday's numbers.
  //
  // Once-per-day cooldown via lastAutoAttemptDateRef: after a single auto
  // attempt today (success or failure), skip further automatic attempts
  // until the local day rolls over. Prevents a failing fetch from being
  // retried on every focus/visibility flip. Manual Refresh still bypasses
  // this since it calls fetchData() directly via the returned `refetch`.
  //
  // Only `visibilitychange` is bound — `focus` covers the same cases and
  // binding both would double-trigger the handler.
  const lastUpdatedRef = useRef(lastUpdated)
  useEffect(() => { lastUpdatedRef.current = lastUpdated }, [lastUpdated])
  const lastAutoAttemptDateRef = useRef<string | null>(null)

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== 'visible') return
      if (inFlightRef.current) return
      const today = new Date().toDateString()
      if (lastAutoAttemptDateRef.current === today) return
      if (isFromPreviousDay(lastUpdatedRef.current)) {
        lastAutoAttemptDateRef.current = today
        fetchData()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
    }
  }, [fetchData])

  return { data, targets, loading, error, lastUpdated, refetch: fetchData }
}
