import { useState, useEffect, useCallback } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import type { DashboardRow } from '../utils/dashboardUtils'
import { normalizeN8NBrand } from '../constants/brands'
import { loginRequest } from '../auth/msalConfig'


export interface TargetRow {
  Brand: string
  'Annual Revenue Target (USD)': number
  'Avg Posts Per Day': number
}

export interface BonusRow {
  amount: number
  title: string
  description: string
  status: string
  progress: string
  bonusUrl: string
  dateScraped: string
}

interface CachedData {
  data: DashboardRow[]
  targets: TargetRow[]
  bonuses: Record<string, BonusRow[]>
  lastUpdated: string
}

const STORAGE_KEY = 'engagement_dashboard_data_v2'

export function useDashboardData() {
  const { instance } = useMsal()
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
  const [bonuses, setBonuses] = useState<Record<string, BonusRow[]>>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData
        if (parsed.bonuses && typeof parsed.bonuses === 'object') {
          console.log('Loaded bonuses from cache')
          return parsed.bonuses
        }
      }
    } catch {
      return {}
    }
    return {}
  })
  const [loading, setLoading] = useState(() => {
    // Start as not loading if we have cached data
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData
        if (Array.isArray(parsed.data) && parsed.data.length > 0) return false
      }
    } catch { /* ignore */ }
    return true
  })
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData
        if (parsed.lastUpdated) return new Date(parsed.lastUpdated)
      }
    } catch { /* ignore */ }
    return null
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const webhookUrl = import.meta.env.VITE_ENGAGEMENT_DASHBOARD_WEBHOOK_URL as string | undefined
      console.log('Webhook URL:', webhookUrl)
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured')
      }

      // Route through /api/n8n-proxy when running in prod OR when VITE_USE_PROXY=true
      // (set the flag in .env.local + run `vercel dev` to test the token path locally).
      let fetchUrl = webhookUrl
      const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      let fetchMethod: 'GET' | 'POST' = 'GET'
      let fetchBody: string | undefined

      const useProxy = import.meta.env.PROD || import.meta.env.VITE_USE_PROXY === 'true'
      if (useProxy) {
        const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
        try {
          const tokenResult = await instance.acquireTokenSilent({ ...loginRequest, account })
          fetchHeaders['Authorization'] = `Bearer ${tokenResult.idToken}`
        } catch (err) {
          // Silent failed — either the session needs user interaction (expired/changed)
          // or the iframe round-trip timed out (slow Vercel preview, blocked 3rd-party
          // cookies, etc.). Both are recoverable via a popup-based acquisition.
          if (err instanceof InteractionRequiredAuthError) {
            await instance.loginRedirect(loginRequest)
            return
          }
          try {
            const tokenResult = await instance.acquireTokenPopup(loginRequest)
            fetchHeaders['Authorization'] = `Bearer ${tokenResult.idToken}`
          } catch {
            throw err
          }
        }
        fetchUrl = '/api/n8n-proxy'
        fetchMethod = 'POST'
        fetchBody = JSON.stringify({ n8nUrl: webhookUrl })
      }

      const response = await fetch(fetchUrl, { method: fetchMethod, headers: fetchHeaders, body: fetchBody })
      console.log('Webhook response status:', response.status)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      let result = await response.json() as unknown
      console.log('Webhook response parsed:', typeof result)

      // If result is a string (stringified JSON), parse it
      if (typeof result === 'string') {
        console.log('Response was stringified, parsing...')
        result = JSON.parse(result)
      }

      // Get the response (handle both array and direct object)
      const responseItem = Array.isArray(result) && result.length > 0 ? result[0] : result

      if (!responseItem || typeof responseItem !== 'object') {
        throw new Error(`Unrecognised response format: ${JSON.stringify(result).slice(0, 100)}`)
      }

      // Extract targets directly (n8n returns already flattened array)
      let targetsArray: TargetRow[] = []
      if (Array.isArray(responseItem.targets)) {
        targetsArray = responseItem.targets as TargetRow[]
        console.log('Extracted targets:', targetsArray.length, 'brands')
      }

      // Extract data directly (n8n returns already flattened array)
      let dataArray: DashboardRow[] = []
      if (Array.isArray(responseItem.data)) {
        dataArray = (responseItem.data as any[]).map((row: any) => ({
          ...row,
          brand: normalizeN8NBrand(row.brand) || row.brand,
        })) as DashboardRow[]
        console.log('Extracted engagement data:', dataArray.length, 'rows')
      }

      // Extract and normalize bonus brand names
      let bonusesData: Record<string, BonusRow[]> = {}
      if (responseItem.bonuses && typeof responseItem.bonuses === 'object') {
        const rawBonuses = responseItem.bonuses as Record<string, BonusRow[]>
        // Normalize bonus brand names to match canonical names
        Object.entries(rawBonuses).forEach(([brandName, bonuses]) => {
          const canonicalBrand = normalizeN8NBrand(brandName) || brandName
          bonusesData[canonicalBrand] = bonuses
        })
        console.log('Extracted bonus data:', Object.keys(bonusesData).length, 'brands')
      }

      setData(dataArray)
      const normalizedTargets = targetsArray.map(t => {
        const canonicalBrand = normalizeN8NBrand(t.Brand) || t.Brand
        return {
          ...t,
          Brand: canonicalBrand,
        }
      })
      setTargets(normalizedTargets)
      setBonuses(bonusesData)
      const updated = new Date()
      setLastUpdated(updated)

      // Cache in localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        data: dataArray,
        targets: normalizedTargets,
        bonuses: bonusesData,
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
    // Only fetch on mount if there is no cached data — navigation and profile
    // switches reuse the cache. Use refetch() or the Refresh button for a forced reload.
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData
        if (Array.isArray(parsed.data) && parsed.data.length > 0) {
          console.log('useDashboardData useEffect - cache hit, skipping fetch')
          return
        }
      }
    } catch { /* fall through to fetch */ }
    console.log('useDashboardData useEffect - no cache, fetching')
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    targets,
    bonuses,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
  }
}
