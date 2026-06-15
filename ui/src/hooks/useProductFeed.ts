import { useState } from 'react'

// Calls the "Product Feed Generator" n8n webhook directly (not via /api/n8n-proxy,
// which is JSON-only). The workflow is async: a "start" request returns a jobId
// immediately, then we poll a "status" request until the combined Excel is ready
// (tagging ~1000 rows runs ~5-6 min server-side, well over the ~100s sync limit).
const WEBHOOK_URL = import.meta.env.VITE_PRODUCT_FEED_WEBHOOK_URL as string

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Poll cadence + overall ceiling. A 1000-row pull takes ~5-6 min here, so we
// allow generous headroom before giving up.
const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

export interface FeedSelection {
  merchant: string
}

export interface ProductFeedResult {
  success: boolean
  message?: string
  filename?: string
  url?: string
  counts?: Record<string, number>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Decode a base64 string (the xlsx the workflow stored) into a Blob.
function base64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

export function useProductFeed() {
  const [isLoading, setIsLoading] = useState(false)

  const run = async (
    partner: string,
    selections: FeedSelection[],
  ): Promise<ProductFeedResult> => {
    if (!WEBHOOK_URL) return { success: false, message: 'Webhook URL is not configured.' }
    if (!selections.length) return { success: false, message: 'Select at least one merchant.' }

    setIsLoading(true)
    try {
      // 1. Start the job — returns { jobId, status: 'processing' } fast.
      let jobId = ''
      try {
        const startRes = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', partner, selections }),
          signal: AbortSignal.timeout(30_000),
        })
        if (!startRes.ok) {
          return { success: false, message: `Could not start the job (${startRes.status}).` }
        }
        const startData = await startRes.json()
        jobId = startData?.jobId
      } catch {
        return { success: false, message: 'Could not reach the feed service to start the job.' }
      }
      if (!jobId) return { success: false, message: 'The feed service did not return a job id.' }

      // 2. Poll status until ready/failed (or we hit the timeout ceiling).
      const deadline = Date.now() + POLL_TIMEOUT_MS
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS)

        let statusData: {
          status?: string
          file_b64?: string
          filename?: string
          counts?: Record<string, number>
          error?: string
        } | null = null
        try {
          const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', jobId }),
            signal: AbortSignal.timeout(60_000),
          })
          if (!res.ok) continue // transient — keep polling
          statusData = await res.json()
        } catch {
          continue // transient network/poll error — keep polling
        }

        const status = statusData?.status
        if (status === 'ready') {
          if (!statusData?.file_b64) {
            return { success: false, message: 'The feed finished but no file was returned.' }
          }
          const blob = base64ToBlob(statusData.file_b64, XLSX_MIME)
          const url = window.URL.createObjectURL(blob) // caller owns revocation
          const filename =
            statusData.filename || `ProductFeed_${partner}.xlsx`
          return { success: true, filename, url, counts: statusData.counts }
        }
        if (status === 'failed') {
          return { success: false, message: statusData?.error || 'Feed generation failed.' }
        }
        // status === 'processing' → keep polling
      }

      return {
        success: false,
        message:
          'Timed out waiting for the feed (over 10 minutes). Try fewer brands and run it again.',
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  return { run, isLoading }
}
