import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { useBrand } from '../context/BrandContext'
import { BRANDS } from '../constants/brands'
import { BackButton } from '../components/ds'
import { toast } from '../hooks/useToast'
import { HistoryPasscodeModal } from '../components/HistoryPasscodeModal'
import { fetchHistory, logHistoryEvent, type HistoryRow } from '../services/historyLog'

const COLUMNS: { key: keyof HistoryRow; label: string }[] = [
  { key: 'server_time', label: 'Time' },
  { key: 'event_type', label: 'Event' },
  { key: 'user_name', label: 'User' },
  { key: 'user_email', label: 'Email' },
  { key: 'brand', label: 'Brand' },
  { key: 'tool_post_type', label: 'Type' },
  { key: 'source_page', label: 'Source' },
  { key: 'title', label: 'Title' },
  { key: 'article_url', label: 'Article URL' },
  { key: 'scheduled_for', label: 'Scheduled For' },
  { key: 'edited_fields', label: 'Edited' },
  { key: 'status', label: 'Status' },
  { key: 'error_message', label: 'Error' },
]

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

// Bundles all fetch params into one object so the effect dep is a stable reference
type FetchParams = { brand: string; from: string; to: string; seq: number }

function makeFetchParams(brand: string, from: string, to: string): FetchParams {
  return { brand, from, to, seq: Date.now() }
}

export function HistoryLogPage() {
  const { selectedBrand, isAdmin } = useBrand()
  const [adminBrand, setAdminBrand] = useState<string>(BRANDS[0])
  const effectiveBrand = isAdmin ? adminBrand : (selectedBrand ?? '')

  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(isoDaysAgo(0))

  // fetchParams drives the effect; a new object reference triggers a new fetch
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(
    effectiveBrand ? makeFetchParams(effectiveBrand, isoDaysAgo(30), isoDaysAgo(0)) : null
  )
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState<boolean>(!!effectiveBrand)
  const [downloading, setDownloading] = useState(false)
  const [showPasscode, setShowPasscode] = useState(false)

  // Sync when context-provided brand changes (non-admin path)
  useEffect(() => {
    if (isAdmin) return
    if (!selectedBrand) return
    const params = makeFetchParams(selectedBrand, from, to)
    setFetchParams(params)
    setLoading(true)
  // from/to intentionally excluded — brand switch resets to current window
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedBrand])

  // Main data fetch — runs whenever fetchParams changes
  useEffect(() => {
    if (!fetchParams) return
    const { brand, from: f, to: t, seq } = fetchParams
    fetchHistory(brand, { mode: 'view', from: f, to: t }).then(res => {
      // Discard if a newer fetch has been issued
      if (fetchParams.seq !== seq) return
      if (res.status === 'OK') setRows(res.rows)
      else {
        setRows([])
        toast.error(res.message ?? 'Failed to load history')
      }
      setLoading(false)
    })
  }, [fetchParams])

  function triggerFetch(brand: string, f: string, t: string) {
    setLoading(true)
    setFetchParams(makeFetchParams(brand, f, t))
  }

  function buildAndDownload(data: HistoryRow[]) {
    const aoa = [
      COLUMNS.map(c => c.label),
      ...data.map(r => COLUMNS.map(c => r[c.key] ?? '')),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, 'History')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const dlUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = dlUrl
    a.download = `KULT_History_${effectiveBrand.replace(/\s+/g, '_')}_${from}_${to}.xlsx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(dlUrl)
    document.body.removeChild(a)
  }

  async function runDownload(passcode?: string): Promise<{ ok: boolean; message?: string }> {
    setDownloading(true)
    const res = await fetchHistory(effectiveBrand, { mode: 'download', from, to, passcode, isAdmin })
    setDownloading(false)
    if (res.status === 'AUTH_ERROR') return { ok: false, message: res.message }
    if (res.status === 'ERROR') { toast.error(res.message ?? 'Download failed'); return { ok: false, message: res.message } }
    buildAndDownload(res.rows)
    logHistoryEvent({ eventType: 'downloaded', brand: effectiveBrand, toolPostType: 'history_export', sourcePage: 'history_log', status: 'success' })
    toast.success(`Downloaded ${res.rows.length} rows`)
    return { ok: true }
  }

  function onDownloadClick() {
    if (!effectiveBrand) { toast.error('Select a brand first'); return }
    if (isAdmin) void runDownload()
    else setShowPasscode(true)
  }

  function onFromChange(val: string) {
    setFrom(val)
    if (effectiveBrand) triggerFetch(effectiveBrand, val, to)
  }

  function onToChange(val: string) {
    setTo(val)
    if (effectiveBrand) triggerFetch(effectiveBrand, from, val)
  }

  function onAdminBrandChange(val: string) {
    setAdminBrand(val)
    triggerFetch(val, from, to)
  }

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <BackButton />
            <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">History Log</h1>
          </div>
          <p className="text-neutral-500 mt-1 text-sm">Generation &amp; scheduling activity{effectiveBrand ? ` for ${effectiveBrand}` : ''}</p>
          <div className="mt-6 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
                <select value={adminBrand} onChange={e => onAdminBrandChange(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
              <input type="date" value={from} max={to} onChange={e => onFromChange(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
              <input type="date" value={to} min={from} onChange={e => onToChange(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <button onClick={onDownloadClick} disabled={downloading || !effectiveBrand}
              className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-lg text-sm font-semibold transition">
              {downloading ? 'Downloading…' : 'Download Excel'}
            </button>
          </div>

          <div className="overflow-x-auto border border-neutral-100 rounded-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>{COLUMNS.map(c => <th key={c.key} className="text-left font-medium px-3 py-2 whitespace-nowrap">{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-neutral-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-neutral-400">No activity in this range.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.event_id} className="border-t border-neutral-100">
                    {COLUMNS.map(c => <td key={c.key} className="px-3 py-2 whitespace-nowrap max-w-[220px] truncate" title={String(r[c.key] ?? '')}>{String(r[c.key] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPasscode && (
        <HistoryPasscodeModal
          onSubmit={async (passcode) => {
            const res = await runDownload(passcode)
            if (res.ok) setShowPasscode(false)
            return res
          }}
          onClose={() => setShowPasscode(false)}
        />
      )}
    </main>
  )
}
