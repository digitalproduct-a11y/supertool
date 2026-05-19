import { useState, useEffect, useCallback } from 'react'
import type { YouTubeDashboardRow } from '../utils/youtubeDashboardUtils'

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

const STORAGE_KEY = 'youtube_dashboard_data'

export function useYouTubeDashboardData() {
  const [data, setData] = useState<YouTubeDashboardRow[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData
        if (Array.isArray(parsed.data)) return parsed.data
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    return []
  })
  const [targets, setTargets] = useState<YouTubeTargetRow[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData
        if (Array.isArray(parsed.targets)) return parsed.targets
      }
    } catch { /* ignore */ }
    return []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        data: dataArray,
        targets: targetsArray,
        lastUpdated: updated.toISOString(),
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('YT dashboard fetch error:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, targets, loading, error, lastUpdated, refetch: fetchData }
}
