import { useEffect, useState } from 'react'

interface SnapshotStatus {
  last_run_at: string
  last_status: 'ok' | 'failed'
  last_error?: string
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000

export function SnapshotStaleBanner({ adminToken }: { adminToken: string }) {
  const [status, setStatus] = useState<SnapshotStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const resp = await fetch('/api/dashboard-snapshot?type=status', {
          credentials: 'include',
          headers: { 'X-Admin-Token': adminToken },
        })
        if (!resp.ok) return
        const next = await resp.json() as SnapshotStatus
        if (!cancelled) setStatus(next)
      } catch { /* banner is best-effort */ }
    }
    void load()
    return () => { cancelled = true }
  }, [adminToken])

  if (!status) return null

  const age = Date.now() - new Date(status.last_run_at).getTime()
  const isStale = age > STALE_THRESHOLD_MS
  const isFailed = status.last_status === 'failed'

  if (!isStale && !isFailed) return null

  const message = isFailed
    ? `Last snapshot failed — admins should investigate. ${status.last_error ?? ''}`.trim()
    : `Snapshot is ${Math.round(age / 3_600_000)} hours old. The producer cron may have stalled.`

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800 flex items-center gap-2">
      <span className="font-medium">⚠ Snapshot warning:</span>
      <span>{message}</span>
    </div>
  )
}
