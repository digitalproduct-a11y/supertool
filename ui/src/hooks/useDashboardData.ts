import { useState, useEffect, useCallback } from 'react'
import type { DashboardRow } from '../utils/dashboardUtils'

export interface TargetRow {
  Brand: string
  'Annual Revenue Target (USD)': number
  'Avg Posts Per Day': number
}

interface CachedData {
  data: DashboardRow[]
  targets: TargetRow[]
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
  const [targets, setTargets] = useState<TargetRow[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData
        if (Array.isArray(parsed.targets)) {
          console.log('Loaded targets from cache:', parsed.targets.length, 'brands')
          return parsed.targets
        }
      }
    } catch {
      return []
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
      console.log('Webhook response parsed:', typeof result)

      // If result is a string (stringified JSON), parse it
      if (typeof result === 'string') {
        console.log('Response was stringified, parsing...')
        result = JSON.parse(result)
      }

      // New format: [{ targets: [{json: {data: [...]}}], data: [{json: {data: [...]}}], ... }]
      let dataArray: DashboardRow[]
      let targetsArray: TargetRow[]

      if (Array.isArray(result) && result.length > 0 && result[0] != null) {
        const responseItem = result[0] as any

        // Extract targets from response[0].targets[0].json.data
        if (responseItem.targets && Array.isArray(responseItem.targets) && responseItem.targets[0]?.json?.data) {
          targetsArray = responseItem.targets[0].json.data as TargetRow[]
          console.log('Extracted targets:', targetsArray.length, 'brands')
        } else {
          targetsArray = []
        }

        // Extract and flatten data from response[0].data[...].json.data
        if (responseItem.data && Array.isArray(responseItem.data)) {
          dataArray = responseItem.data.flatMap((item: any) => {
            if (item?.json?.data && Array.isArray(item.json.data)) {
              return item.json.data
            }
            return []
          }) as DashboardRow[]
          console.log('Extracted engagement data:', dataArray.length, 'rows')
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

      // Cache in localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        data: dataArray,
        targets: targetsArray,
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
    targets,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
  }
}
