import { useState } from 'react'
import type { AffiliateLinksResponse } from '../types'

const WEBHOOK_URL = import.meta.env.VITE_AFFILIATE_WEBHOOK_URL as string

export function useAffiliateLinks() {
  const [isLoading, setIsLoading] = useState(false)

  const run = async (file: File, brand: string): Promise<AffiliateLinksResponse> => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const url = new URL(WEBHOOK_URL)
      url.searchParams.append('brand', brand)

      const response = await fetch(url.toString(), {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(1200_000), //20 mins
      })

      if (!response.ok) {
        return { success: false, message: `Request failed (${response.status})` }
      }

      // Check if response is binary (Excel file)
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType === 'application/octet-stream') {
        // Binary response - trigger download
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        // Extract filename from Content-Disposition header if available
        const disposition = response.headers.get('content-disposition')
        let filename = 'Shopee_Products.xlsx'
        if (disposition) {
          const match = disposition.match(/filename="?([^"]+)"?/)
          if (match) filename = match[1]
        }

        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        return { success: true, filename }
      }

      // JSON response (error case)
      const data = await response.json()
      return data as AffiliateLinksResponse
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  return { run, isLoading }
}
