import { useState } from 'react'
import * as XLSX from 'xlsx'
import type { AffiliateLinksResponse } from '../types'

const WEBHOOK_URL = import.meta.env.VITE_AFFILIATE_WEBHOOK_URL as string
const BATCH_SIZE = 10

export function useAffiliateLinks() {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  const run = async (file: File, brand: string): Promise<AffiliateLinksResponse> => {
    setIsLoading(true)
    setProgress(null)
    try {
      // 1. Parse uploaded Excel to get all rows
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

      const header = rows[0]
      const dataRows = rows.slice(1).filter(r => (r as unknown[]).some(Boolean))

      // 2. Split into batches of BATCH_SIZE
      const batches: unknown[][][] = []
      for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        batches.push([header, ...dataRows.slice(i, i + BATCH_SIZE)])
      }

      // 3. Process each batch sequentially
      const responseSheets: unknown[][][] = []
      setProgress({ current: 0, total: batches.length })

      for (let i = 0; i < batches.length; i++) {
        setProgress({ current: i + 1, total: batches.length })

        // Create mini xlsx from this batch
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet(batches[i])
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
        const xlsxBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
        const batchFile = new File([xlsxBuffer], file.name, { type: file.type })

        const formData = new FormData()
        formData.append('file', batchFile)

        const url = new URL(WEBHOOK_URL)
        url.searchParams.append('brand', brand)

        const response = await fetch(url.toString(), {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(90_000), // 90s — safely under Cloudflare's 100s hard limit
        })

        if (!response.ok) {
          return { success: false, message: `Batch ${i + 1} of ${batches.length} failed (${response.status})` }
        }

        // Parse response Excel and collect rows
        const respBuffer = await response.arrayBuffer()
        const respWb = XLSX.read(respBuffer)
        const respSheet = respWb.Sheets[respWb.SheetNames[0]]
        const respRows = XLSX.utils.sheet_to_json(respSheet, { header: 1 }) as unknown[][]

        if (i === 0) {
          responseSheets.push(respRows) // include header from first batch
        } else {
          responseSheets.push(respRows.slice(1)) // skip header for subsequent batches
        }
      }

      // 4. Merge all response rows into one Excel file
      const allRows = responseSheets.flat()
      const mergedWb = XLSX.utils.book_new()
      const mergedWs = XLSX.utils.aoa_to_sheet(allRows)
      XLSX.utils.book_append_sheet(mergedWb, mergedWs, 'Sheet1')
      const mergedBuffer = XLSX.write(mergedWb, { type: 'array', bookType: 'xlsx' })

      // 5. Trigger download
      const blob = new Blob([mergedBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const dlUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = 'Shopee_Products.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(dlUrl)
      document.body.removeChild(a)

      return { success: true, filename: 'Shopee_Products.xlsx' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      return { success: false, message }
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }

  return { run, isLoading, progress }
}
