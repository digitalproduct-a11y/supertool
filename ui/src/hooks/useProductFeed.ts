import { useState } from 'react'

// Calls the "Product Feed Generator" n8n webhook directly (not via /api/n8n-proxy,
// which is JSON-only) and downloads the combined Excel binary it returns — same
// pattern as useAffiliateLinks.
const WEBHOOK_URL = import.meta.env.VITE_PRODUCT_FEED_WEBHOOK_URL as string

export interface FeedSelection {
  merchant: string
  limit: number
}

export interface ProductFeedResult {
  success: boolean
  message?: string
  filename?: string
  url?: string
}

export function useProductFeed() {
  const [isLoading, setIsLoading] = useState(false)

  const run = async (partner: string, selections: FeedSelection[]): Promise<ProductFeedResult> => {
    if (!WEBHOOK_URL) return { success: false, message: 'Webhook URL is not configured.' }
    if (!selections.length) return { success: false, message: 'Select at least one merchant.' }

    setIsLoading(true)
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner, selections }),
        signal: AbortSignal.timeout(95_000), // under the ~100s n8n/Cloudflare hard limit
      })

      const contentType = response.headers.get('content-type') || ''

      // On error (or any non-spreadsheet response) the workflow returns a JSON { message }
      if (!response.ok || !contentType.includes('spreadsheet')) {
        try {
          const data = await response.json()
          return { success: false, message: data?.message || `Request failed (${response.status})` }
        } catch {
          return { success: false, message: `Request failed (${response.status})` }
        }
      }

      const buffer = await response.arrayBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const stamp = new Date().toISOString().slice(0, 10)
      const filename = `ProductFeed_${partner}_${stamp}.xlsx`

      // Caller owns the object URL (for the download button) and must revoke it.
      const url = window.URL.createObjectURL(blob)
      return { success: true, filename, url }
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        return {
          success: false,
          message: 'The request timed out. Try fewer products or fewer merchants.',
        }
      }
      const message = err instanceof Error ? err.message : 'Something went wrong'
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  return { run, isLoading }
}
