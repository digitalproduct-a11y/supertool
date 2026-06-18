import { useEffect, useState } from 'react'
import { IconRefresh, IconCheck } from '@tabler/icons-react'

interface SnapshotStatus {
  last_run_at: string
  last_meta_rows: number
  last_youtube_rows: number
  last_status: 'ok' | 'failed'
  last_error?: string
}

interface Props {
  adminToken: string
  onRefreshed?: () => void
}

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 30_000

export function SnapshotControl({ adminToken, onRefreshed }: Props) {
  const [status, setStatus] = useState<SnapshotStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchStatus(): Promise<SnapshotStatus | null> {
    try {
      const resp = await fetch('/api/dashboard-snapshot?type=status', {
        credentials: 'include',
        headers: { 'X-Admin-Token': adminToken },
      })
      if (!resp.ok) return null
      const next = await resp.json() as SnapshotStatus
      setStatus(next)
      return next
    } catch {
      return null
    }
  }

  async function triggerRefresh() {
    setRefreshing(true)
    setError(null)
    const triggeredAt = Date.now()
    try {
      const resp = await fetch('/api/dashboard-snapshot/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Admin-Token': adminToken },
      })
      if (!resp.ok) throw new Error(`Trigger failed: HTTP ${resp.status}`)

      const deadline = Date.now() + POLL_TIMEOUT_MS
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
        const next = await fetchStatus()
        if (next && new Date(next.last_run_at).getTime() > triggeredAt) {
          if (next.last_status === 'failed') {
            setError(next.last_error ?? 'Producer reported failure')
          } else {
            onRefreshed?.()
          }
          return
        }
      }
      setError('Refresh did not complete within 30s — check n8n executions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const lastRunLabel = status
    ? `Last snapshot: ${new Date(status.last_run_at).toLocaleString()}`
    : 'No snapshot recorded yet'

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-600">{lastRunLabel}</span>
      <button
        onClick={triggerRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
      >
        <IconRefresh className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        {refreshing ? 'Refreshing snapshot…' : 'Refresh snapshot'}
      </button>
      {error && (
        <span className="text-xs text-red-600" title={error}>⚠ {error.slice(0, 60)}</span>
      )}
      {!error && status?.last_status === 'ok' && !refreshing && (
        <IconCheck className="w-4 h-4 text-emerald-600" />
      )}
    </div>
  )
}
