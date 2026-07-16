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

// Session cache for the unlock passcode so re-entering the page doesn't re-prompt.
const PASS_KEY = 'kult_history_pass'

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function readCachedPass(): string {
  try { return sessionStorage.getItem(PASS_KEY) ?? '' } catch { return '' }
}

// Timestamp columns are stored as ISO strings; render them readably (e.g. "25 Jun 2026, 18:42").
const DATE_KEYS: (keyof HistoryRow)[] = ['server_time', 'scheduled_for']

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function cellValue(r: HistoryRow, key: keyof HistoryRow): string {
  const raw = String(r[key] ?? '')
  return DATE_KEYS.includes(key) ? formatTime(raw) : raw
}

// Bundles fetch params into one object so the effect dep is a stable reference; seq cancels stale responses.
type FetchParams = { brand: string; from: string; to: string; passcode: string; isAdmin: boolean; seq: number }

function makeFetchParams(brand: string, from: string, to: string, passcode: string, isAdmin: boolean): FetchParams {
  return { brand, from, to, passcode, isAdmin, seq: Date.now() }
}

export function HistoryLogPage() {
  const { selectedBrand, isAdmin } = useBrand()
  const [adminBrand, setAdminBrand] = useState<string>(BRANDS[0])
  const effectiveBrand = isAdmin ? adminBrand : (selectedBrand ?? '')

  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(isoDaysAgo(0))

  // Passcode gate: admins bypass; non-admins must unlock (cached per session).
  const [passcode, setPasscode] = useState<string>(() => readCachedPass())
  const [unlocked, setUnlocked] = useState<boolean>(() => isAdmin || readCachedPass() !== '')
  const [showGate, setShowGate] = useState<boolean>(() => !(isAdmin || readCachedPass() !== ''))

  const startUnlocked = isAdmin || readCachedPass() !== ''
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(
    startUnlocked && effectiveBrand
      ? makeFetchParams(effectiveBrand, isoDaysAgo(30), isoDaysAgo(0), readCachedPass(), isAdmin)
      : null
  )
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState<boolean>(startUnlocked && !!effectiveBrand)
  const [downloading, setDownloading] = useState(false)

  // Non-admin context-brand change → reload with the unlocked passcode.
  useEffect(() => {
    if (isAdmin || !unlocked || !selectedBrand) return
    setFetchParams(makeFetchParams(selectedBrand, from, to, passcode, false))
    setLoading(true)
  // from/to omitted on purpose — brand switch keeps the current window
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedBrand, unlocked])

  // Main data fetch.
  useEffect(() => {
    if (!fetchParams) return
    const { brand, from: f, to: t, passcode: pc, isAdmin: adm, seq } = fetchParams
    fetchHistory(brand, { mode: 'view', from: f, to: t, passcode: pc, isAdmin: adm }).then(res => {
      if (fetchParams.seq !== seq) return
      if (res.status === 'OK') {
        setRows(res.rows)
      } else if (res.status === 'AUTH_ERROR') {
        // Cached passcode no longer valid (e.g. rotated) — re-lock.
        try { sessionStorage.removeItem(PASS_KEY) } catch { /* ignore */ }
        setUnlocked(false); setPasscode(''); setShowGate(true); setRows([])
      } else {
        setRows([])
        toast.error(res.message ?? 'Failed to load history')
      }
      setLoading(false)
    })
  }, [fetchParams])

  function triggerFetch(brand: string, f: string, t: string, pc: string, adm: boolean) {
    setLoading(true)
    setFetchParams(makeFetchParams(brand, f, t, pc, adm))
  }

  // Gate submit (non-admin): validate the passcode by loading the view with it.
  async function handleUnlock(pc: string, captchaToken?: string): Promise<{ ok: boolean; message?: string; captchaRequired?: boolean }> {
    if (!effectiveBrand) return { ok: false, message: 'No brand selected.' }
    const res = await fetchHistory(effectiveBrand, { mode: 'view', from, to, passcode: pc, isAdmin: false, captchaToken })
    if (res.status === 'OK') {
      try { sessionStorage.setItem(PASS_KEY, pc) } catch { /* ignore */ }
      setPasscode(pc); setUnlocked(true); setShowGate(false); setRows(res.rows); setLoading(false)
      return { ok: true }
    }
    if (res.status === 'AUTH_ERROR') return { ok: false, message: res.message ?? 'Incorrect passcode.', captchaRequired: res.captchaRequired }
    return { ok: false, message: res.message ?? 'Could not load history.' }
  }

  function buildAndDownload(data: HistoryRow[]) {
    const aoa = [
      COLUMNS.map(c => c.label),
      ...data.map(r => COLUMNS.map(c => cellValue(r, c.key))),
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

  // Download uses the already-unlocked passcode (admins need none) — never re-prompts.
  async function onDownloadClick() {
    if (!effectiveBrand) { toast.error('Select a brand first'); return }
    setDownloading(true)
    const res = await fetchHistory(effectiveBrand, { mode: 'download', from, to, passcode, isAdmin })
    setDownloading(false)
    if (res.status === 'AUTH_ERROR') {
      try { sessionStorage.removeItem(PASS_KEY) } catch { /* ignore */ }
      setUnlocked(false); setPasscode(''); setShowGate(true)
      toast.error('Session passcode expired — please re-enter it.')
      return
    }
    if (res.status === 'ERROR') { toast.error(res.message ?? 'Download failed'); return }
    buildAndDownload(res.rows)
    logHistoryEvent({ eventType: 'downloaded', brand: effectiveBrand, toolPostType: 'history_export', sourcePage: 'history_log', status: 'success' })
    toast.success(`Downloaded ${res.rows.length} rows`)
  }

  function onFromChange(val: string) {
    setFrom(val)
    if (unlocked && effectiveBrand) triggerFetch(effectiveBrand, val, to, passcode, isAdmin)
  }

  function onToChange(val: string) {
    setTo(val)
    if (unlocked && effectiveBrand) triggerFetch(effectiveBrand, from, val, passcode, isAdmin)
  }

  function onAdminBrandChange(val: string) {
    setAdminBrand(val)
    triggerFetch(val, from, to, passcode, isAdmin)
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

        {!unlocked ? (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-2xl">🔒</div>
            <p className="text-sm text-neutral-600 mb-4">This history log is passcode-protected.</p>
            <button onClick={() => setShowGate(true)}
              className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-sm font-semibold transition">
              Enter passcode
            </button>
          </div>
        ) : (
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
                      {COLUMNS.map(c => { const val = cellValue(r, c.key); return <td key={c.key} className="px-3 py-2 whitespace-nowrap max-w-[220px] truncate" title={val}>{val}</td> })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showGate && !unlocked && (
        <HistoryPasscodeModal
          onSubmit={handleUnlock}
          onClose={() => setShowGate(false)}
        />
      )}
    </main>
  )
}
