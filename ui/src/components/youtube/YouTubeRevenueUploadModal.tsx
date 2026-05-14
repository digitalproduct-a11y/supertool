import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { parseYouTubeRevenueCsv, type YouTubeParseResult } from '../../utils/youtubeRevenueCsvParser'

interface Props {
  brand: string
  onClose: () => void
  onSuccess: () => void
}

type Tab = 'upload' | 'clear'

const UPLOAD_URL = import.meta.env.VITE_YT_REVENUE_UPLOAD_WEBHOOK_URL as string | undefined
const CLEAR_URL = import.meta.env.VITE_YT_REVENUE_CLEAR_WEBHOOK_URL as string | undefined

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function extractServerError(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text()
    if (!text) return `${fallback} (HTTP ${res.status})`
    try {
      const data = JSON.parse(text)
      const msg = data?.message || data?.error?.message || data?.error
      const node = data?.node?.name || data?.error?.node?.name
      if (msg) return node ? `${msg} (node: ${node})` : String(msg)
      return `${fallback} (HTTP ${res.status})`
    } catch {
      return text.length > 300 ? `${text.slice(0, 300)}…` : text
    }
  } catch {
    return `${fallback} (HTTP ${res.status})`
  }
}

function networkErrorMessage(e: any): string {
  const raw = e?.message || ''
  if (raw.toLowerCase().includes('failed to fetch') || raw.toLowerCase().includes('networkerror')) {
    return 'Could not reach the upload service. Check your network or VPN.'
  }
  return raw || 'Request failed'
}

export function YouTubeRevenueUploadModal({ brand, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<Tab>('upload')

  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<YouTubeParseResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [skippedDates, setSkippedDates] = useState<{ date: string; reason: string }[]>([])

  const [clearStart, setClearStart] = useState('')
  const [clearEnd, setClearEnd] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)

  const dateRange = useMemo(() => {
    if (!parseResult || parseResult.rows.length === 0) return null
    return { start: parseResult.rows[0].date, end: parseResult.rows[parseResult.rows.length - 1].date }
  }, [parseResult])

  const acceptFile = async (f: File) => {
    setFile(f); setParseError(null); setParseResult(null); setSubmitError(null)
    try {
      setParseResult(await parseYouTubeRevenueCsv(f))
    } catch (e: any) {
      setParseError(e?.message || 'Failed to parse file')
    }
  }

  const resetFile = () => { setFile(null); setParseResult(null); setParseError(null); setSubmitError(null) }

  const handleSubmit = async () => {
    if (!parseResult || !brand || submitting) return
    if (!UPLOAD_URL) {
      setSubmitError('VITE_YT_REVENUE_UPLOAD_WEBHOOK_URL is not configured')
      return
    }
    setSubmitting(true); setSubmitError(null); setSkippedDates([])
    try {
      const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, rows: parseResult.rows }),
      })
      if (!res.ok) {
        setSubmitError(await extractServerError(res, 'Upload failed'))
        return
      }
      let skipped: { date: string; reason: string }[] = []
      try {
        const data = await res.json()
        if (Array.isArray(data?.skipped)) skipped = data.skipped
      } catch { /* ignore */ }
      onSuccess()
      if (skipped.length > 0) setSkippedDates(skipped)
      else onClose()
    } catch (e: any) {
      setSubmitError(networkErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleClear = async () => {
    if (!brand || !clearStart || !clearEnd || clearing) return
    if (!CLEAR_URL) {
      setClearError('VITE_YT_REVENUE_CLEAR_WEBHOOK_URL is not configured')
      return
    }
    setClearing(true); setClearError(null)
    try {
      const res = await fetch(CLEAR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, startDate: clearStart, endDate: clearEnd }),
      })
      if (!res.ok) {
        setClearError(await extractServerError(res, 'Clear failed'))
        return
      }
      onSuccess(); onClose()
    } catch (e: any) {
      setClearError(networkErrorMessage(e))
    } finally {
      setClearing(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-3 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-950">
            Upload YouTube revenue for {brand}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none">×</button>
        </div>

        <div className="px-6 pt-3 flex gap-1 border-b border-neutral-100">
          <button
            onClick={() => setTab('upload')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
              tab === 'upload' ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >Upload CSV</button>
          <button
            onClick={() => setTab('clear')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
              tab === 'clear' ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >Clear revenue data</button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {tab === 'upload' && (
            <div className="space-y-4">
              <div className="text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">
                CSV needs two columns: <code className="font-mono">Date</code> and <code className="font-mono">Revenue</code> (or <code className="font-mono">Est.Revenue (USD)</code>). Date accepts <code>YYYY-MM-DD</code> or <code>DD/MM/YYYY</code>.
              </div>

              {!file && (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={e => { e.preventDefault(); setIsDragging(false) }}
                  onDrop={e => {
                    e.preventDefault(); setIsDragging(false)
                    const f = e.dataTransfer.files?.[0]
                    if (f) acceptFile(f)
                  }}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
                    isDragging ? 'border-neutral-950 bg-neutral-50' : 'border-neutral-200'
                  }`}
                >
                  <p className="text-sm text-neutral-600 mb-2">Drop your YouTube revenue CSV here</p>
                  <p className="text-xs text-neutral-400 mb-3">or</p>
                  <label className="inline-block px-4 py-1.5 bg-neutral-950 text-white rounded-lg text-sm cursor-pointer hover:bg-neutral-800 transition">
                    Choose file
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) acceptFile(f)
                      }}
                    />
                  </label>
                </div>
              )}

              {file && (
                <div className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-neutral-700 truncate">{file.name}</span>
                  <button onClick={resetFile} className="text-xs text-neutral-500 hover:text-neutral-900 underline">Replace file</button>
                </div>
              )}

              {parseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-900 whitespace-pre-wrap break-words">
                  {parseError}
                </div>
              )}

              {parseResult && dateRange && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900">
                    This will upsert <strong>{parseResult.rows.length}</strong> {parseResult.rows.length === 1 ? 'row' : 'rows'} for <strong>{brand}</strong> covering <strong>{dateRange.start}</strong> – <strong>{dateRange.end}</strong>. Existing revenue for these dates will be replaced.
                  </div>

                  {parseResult.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-900 space-y-0.5">
                      {parseResult.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}

                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-neutral-600">Date</th>
                          <th className="text-right px-3 py-2 font-medium text-neutral-600">Revenue (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.rows.map(r => (
                          <tr key={r.date} className="border-t border-neutral-100">
                            <td className="px-3 py-1.5 text-neutral-700">{r.date}</td>
                            <td className="px-3 py-1.5 text-right text-neutral-700">{fmt(r.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-900 whitespace-pre-wrap break-words">
                  <div className="font-medium mb-0.5">Upload failed</div>
                  {submitError}
                </div>
              )}

              {skippedDates.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-900">
                  <div className="font-medium mb-1">
                    {skippedDates.length} {skippedDates.length === 1 ? 'date was' : 'dates were'} skipped — no matching row in the sheet yet.
                  </div>
                  <ul className="text-xs space-y-0.5 list-disc pl-5">
                    {skippedDates.map((s, i) => (
                      <li key={i}><span className="font-medium">{s.date}</span> — {s.reason}</li>
                    ))}
                  </ul>
                  <div className="text-xs mt-1 text-yellow-800">
                    These rows will fill in automatically the next time Sprout writes data for those dates.
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'clear' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">This action will clear YouTube revenue values for the date range you select.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Start date</label>
                  <input type="date" value={clearStart} onChange={e => setClearStart(e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">End date</label>
                  <input type="date" value={clearEnd} onChange={e => setClearEnd(e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
              </div>

              {clearStart && clearEnd && clearStart <= clearEnd && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900">
                  This will blank revenue for <strong>{brand}</strong> from <strong>{clearStart}</strong> to <strong>{clearEnd}</strong>.
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={clearConfirm} onChange={() => setClearConfirm(v => !v)} className="w-4 h-4 accent-neutral-950" />
                I understand this will overwrite existing revenue values.
              </label>

              {clearError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-900 whitespace-pre-wrap break-words">
                  <div className="font-medium mb-0.5">Clear failed</div>
                  {clearError}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={submitting || clearing} className="px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg transition disabled:opacity-50">Cancel</button>
          {tab === 'upload' ? (
            <button onClick={handleSubmit} disabled={!parseResult || submitting} className="px-4 py-1.5 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'Uploading…' : 'Submit'}
            </button>
          ) : (
            <button onClick={handleClear} disabled={!clearStart || !clearEnd || clearStart > clearEnd || !clearConfirm || clearing} className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {clearing ? 'Clearing…' : 'Clear data'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
