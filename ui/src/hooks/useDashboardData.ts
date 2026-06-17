import { useState, useEffect, useCallback, useRef } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import type { DashboardRow } from '../utils/dashboardUtils'
import { normalizeN8NBrand } from '../constants/brands'
import { loginRequest } from '../auth/msalConfig'

// True when `ts` falls on a different local calendar day than right now.
// Null (no prior fetch) counts as stale so a fresh open always fetches.
const isFromPreviousDay = (ts: Date | null): boolean => {
  if (!ts) return true
  return ts.toDateString() !== new Date().toDateString()
}


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

  // In-flight guard so rapid double-triggers (mount + visibilitychange, or
  // double-clicked Refresh button) collapse to a single network call.
  const inFlightRef = useRef<boolean>(false)

  const fetchData = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
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

      // Snapshot path (feature-flagged) — reads from /api/dashboard-snapshot which
      // hits Vercel KV. Session cookie attached automatically (credentials: include).
      // This path stays out of MSAL silent-renewal entirely after the cookie is minted.
      const useSnapshot = import.meta.env.VITE_USE_DASHBOARD_SNAPSHOT === 'true'
      if (useSnapshot) {
        let resp = await fetch('/api/dashboard-snapshot?type=meta', { credentials: 'include' })

        // Cookie expired? Re-mint once via /api/auth/session, then retry.
        if (resp.status === 401) {
          const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
          try {
            const tokenResult = await instance.acquireTokenSilent({ ...loginRequest, account })
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: { Authorization: `Bearer ${tokenResult.idToken}` },
              credentials: 'include',
            })
          } catch (err) {
            if (err instanceof InteractionRequiredAuthError) {
              await instance.loginRedirect(loginRequest)
              return
            }
            throw err
          }
          resp = await fetch('/api/dashboard-snapshot?type=meta', { credentials: 'include' })
        }

        if (resp.status === 404) {
          throw new Error('Snapshot not ready yet — please try again in a few minutes')
        }
        if (!resp.ok) {
          throw new Error(`Snapshot read failed: HTTP ${resp.status}`)
        }

        const responseItem = await resp.json() as any
        let dataArray: DashboardRow[] = []
        const targetsArray: TargetRow[] = Array.isArray(responseItem.targets) ? responseItem.targets : []
        const bonusesData: Record<string, BonusRow[]> = {}

        if (Array.isArray(responseItem.data)) {
          dataArray = (responseItem.data as any[]).map((row: any) => ({
            ...row,
            brand: normalizeN8NBrand(row.brand) || row.brand,
          })) as DashboardRow[]
        }
        if (responseItem.bonuses && typeof responseItem.bonuses === 'object') {
          Object.entries(responseItem.bonuses as Record<string, BonusRow[]>).forEach(([brandName, bonuses]) => {
            const canonicalBrand = normalizeN8NBrand(brandName) || brandName
            bonusesData[canonicalBrand] = bonuses
          })
        }

        setData(dataArray)
        const normalizedTargets = targetsArray.map(t => {
          const canonicalBrand = normalizeN8NBrand(t.Brand) || t.Brand
          return { ...t, Brand: canonicalBrand }
        })
        setTargets(normalizedTargets)
        setBonuses(bonusesData)
        const updated = new Date()
        setLastUpdated(updated)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          data: dataArray, targets: normalizedTargets, bonuses: bonusesData, lastUpdated: updated.toISOString(),
        }))
        return
      }

      const useProxy = import.meta.env.PROD || import.meta.env.VITE_USE_PROXY === 'true'
      if (!useProxy) {
        // Local dev: route through vite's dev proxy (see vite.config.ts) so the
        // dashboard-webhook-token is injected server-side and stays out of the
        // client bundle. Calling the absolute n8n URL would bypass the proxy
        // and 403 on the Header Auth check.
        try {
          const u = new URL(webhookUrl)
          fetchUrl = u.pathname + u.search
        } catch {
          // fall through to absolute URL
        }
      }
      if (useProxy) {
        const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
        try {
          const tokenResult = await instance.acquireTokenSilent({ ...loginRequest, account })
          fetchHeaders['Authorization'] = `Bearer ${tokenResult.idToken}`
        } catch (err) {
          // Only redirect when MSAL explicitly says interaction is required.
          // Iframe timeouts, network blips, and 3rd-party-cookie issues used to
          // also trigger loginRedirect here — that bounced users through `/`,
          // which wiped their brand passcode session.
          if (err instanceof InteractionRequiredAuthError) {
            await instance.loginRedirect(loginRequest)
            return
          }
          throw err
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
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    // Stale-while-revalidate on mount: cached data renders instantly from the
    // useState initializers above; here we trigger a background refetch when
    // there's no cache OR the cache was last refreshed on a previous local
    // calendar day. Otherwise navigation and brand switches keep reusing the
    // cache without re-hitting n8n.
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as CachedData
        if (Array.isArray(parsed.data) && parsed.data.length > 0) {
          const cachedAt = parsed.lastUpdated ? new Date(parsed.lastUpdated) : null
          if (!isFromPreviousDay(cachedAt)) {
            console.log('useDashboardData useEffect - cache hit (same day), skipping fetch')
            return
          }
          console.log('useDashboardData useEffect - cache is from a previous day, refetching')
        }
      }
    } catch { /* fall through to fetch */ }
    lastAutoAttemptDateRef.current = new Date().toDateString()
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when the tab becomes visible on a new calendar day. Catches the
  // "laptop closed for days with tab still open" case so users see today's
  // data without manually clicking Refresh.
  //
  // Once-per-day cooldown: after a single auto-attempt (success OR failure),
  // skip further automatic attempts for the rest of the local day. Stops the
  // runaway-loop case where a failing fetch (e.g. MSAL silent-renewal timeout)
  // would otherwise retry on every focus/visibility flip and burn n8n
  // executions. The manual Refresh button still bypasses this throttle since
  // it calls fetchData() directly via the returned `refetch`.
  //
  // Only `visibilitychange` is bound — `focus` fires alongside it on every
  // major browser for the cases we care about (tab switch, app switch,
  // laptop reopen) and binding both would double-trigger the handler.
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
        console.log('useDashboardData visibility - new day, refetching')
        fetchData()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
    }
  }, [fetchData])

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
