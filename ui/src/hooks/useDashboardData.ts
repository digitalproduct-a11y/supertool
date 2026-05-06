import { useState, useEffect, useCallback } from 'react'
import type { DashboardRow } from '../utils/dashboardUtils'

interface CachedData {
  data: DashboardRow[]
  lastUpdated: string
}

const STORAGE_KEY = 'engagement_dashboard_data'

export function useDashboardData() {
  const [data, setData] = useState<DashboardRow[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData
        if (Array.isArray(parsed.data)) {
          console.log('Loaded from cache:', parsed.data.length, 'rows')
          return parsed.data
        }
      }
    } catch {
      console.log('Cache corrupted, clearing')
      localStorage.removeItem(STORAGE_KEY)
    }
    return []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const webhookUrl = import.meta.env.VITE_ENGAGEMENT_DASHBOARD_WEBHOOK_URL as string | undefined
      console.log('Webhook URL:', webhookUrl)
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured')
      }

      const response = await fetch(webhookUrl)
      console.log('Webhook response status:', response.status)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      let result = await response.json() as unknown
      console.log('Webhook response parsed:', typeof result, 'keys:', Object.keys(result as any))

      // If result is a string (stringified JSON), parse it
      if (typeof result === 'string') {
        console.log('Response was stringified, parsing...')
        result = JSON.parse(result)
      }

      // Unwrap n8n response formats:
      // - raw array: DashboardRow[]
      // - wrapped object: { data: DashboardRow[], lastUpdated: string }
      // - n8n items array: [{ data: DashboardRow[], lastUpdated: string }]
      let dataArray: DashboardRow[]
      let unwrapped = result

      // n8n items array: [{ data: [...], lastUpdated: ... }]
      if (Array.isArray(unwrapped) && unwrapped.length === 1 && unwrapped[0] != null && 'data' in (unwrapped[0] as object)) {
        unwrapped = unwrapped[0]
      }

      if (Array.isArray(unwrapped)) {
        dataArray = unwrapped as DashboardRow[]
      } else if (typeof unwrapped === 'object' && unwrapped !== null && 'data' in unwrapped) {
        const inner = (unwrapped as { data: unknown }).data
        if (Array.isArray(inner)) {
          dataArray = inner as DashboardRow[]
        } else {
          throw new Error(`Expected data to be array but got ${typeof inner}`)
        }
      } else {
        throw new Error(`Unrecognised response format: ${JSON.stringify(unwrapped).slice(0, 100)}`)
      }

      console.log('Using data with', dataArray.length, 'rows')

      setData(dataArray)
      const updated = new Date()
      setLastUpdated(updated)

      // Cache in localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        data: dataArray,
        lastUpdated: updated.toISOString(),
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Fetch error:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    console.log('useDashboardData useEffect - calling fetchData')
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
