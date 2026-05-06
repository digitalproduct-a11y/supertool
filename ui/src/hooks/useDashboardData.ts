import { useState, useEffect, useCallback } from 'react'
import { DashboardRow } from '../utils/dashboardUtils'

interface CachedData {
  data: DashboardRow[]
  lastUpdated: string
}

const STORAGE_KEY = 'engagement_dashboard_data'

export function useDashboardData() {
  const [data, setData] = useState<DashboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const webhookUrl = import.meta.env.VITE_ENGAGEMENT_DASHBOARD_WEBHOOK_URL as string | undefined
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured')
      }

      const response = await fetch(webhookUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json() as { data: DashboardRow[]; lastUpdated: string }

      setData(result.data)
      const updated = new Date(result.lastUpdated)
      setLastUpdated(updated)

      // Cache in localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        data: result.data,
        lastUpdated: result.lastUpdated,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)

      // Try to restore from cache
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CachedData
          setData(parsed.data)
          setLastUpdated(new Date(parsed.lastUpdated))
          setError(null)
        } catch {
          // Cache corrupted
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
  }
}
