import { useMemo, useState, useRef, useEffect } from 'react'
import { useYouTubeDashboardData } from '../hooks/useYouTubeDashboardData'
import { useBrand } from '../context/BrandContext'
import { BackButton } from '../components/ds'
import {
  normalizeBrand,
  dayOfYear,
  daysInYear,
} from '../utils/youtubeDashboardUtils'

type SortBy = 'rev-pace-asc' | 'rev-pace-desc' | 'watch-pace-asc' | 'watch-pace-desc' | 'brand'

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'rev-pace-asc', label: 'Worst revenue pace first' },
  { value: 'rev-pace-desc', label: 'Best revenue pace first' },
  { value: 'watch-pace-asc', label: 'Worst watch pace first' },
  { value: 'watch-pace-desc', label: 'Best watch pace first' },
  { value: 'brand', label: 'Brand name' },
]

const BUSINESS_UNIT_LABELS: Record<string, string> = {
  AASB: 'Astro',
  MBNS: 'Astro',
  ARSB: 'Astro Radio',
  NISB: 'Nu Ideaktiv',
}

const cleanBrand = (s: string) => s.replace(/\s+/g, ' ').trim()

function formatHours(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${Math.round(n)}`
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`
}

interface PacingRow {
  brand: string
  bu: string
  revActual: number
  revExpected: number | null
  revPace: number | null
  revProjected: number
  revTarget: number | null
  watchActual: number
  watchExpected: number | null
  watchPace: number | null
  watchProjected: number
  watchAnnualTarget: number | null
}

export function YouTubeTargetPacingPage() {
  const { data, targets } = useYouTubeDashboardData()
  const { isAdmin } = useBrand()
  const [sortBy, setSortBy] = useState<SortBy>('rev-pace-asc')
  const [showSortModal, setShowSortModal] = useState(false)
  const sortModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortModalRef.current && !sortModalRef.current.contains(e.target as Node)) {
        setShowSortModal(false)
      }
    }
    if (showSortModal) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [showSortModal])

  // As-of = latest date in the data (so we pace against ingested data, not the literal calendar
  // today — avoids penalising the 1–3 day ingest lag).
  const asOf = useMemo(() => {
    let max = ''
    for (const row of data) if (row.date > max) max = row.date
    return max
  }, [data])

  const pacing = useMemo(() => {
    if (!asOf) return { rows: [] as PacingRow[], daysElapsed: 0, diy: 365, yearFraction: 0, year: 0, lastRevenueDate: '' }

    const year = Number(asOf.slice(0, 4))
    const diy = daysInYear(year)
    const daysElapsed = dayOfYear(asOf)
    const yearFraction = daysElapsed / diy
    const yearStart = `${year}-01-01`

    // Aggregate YTD actuals per normalized brand.
    const buckets: Record<string, { brand: string; bu: string; revenue: number; watch: number }> = {}
    let lastRevenueDate = ''
    for (const row of data) {
      if (row.date < yearStart || row.date > asOf) continue
      const key = normalizeBrand(row.brand)
      if (!buckets[key]) buckets[key] = { brand: cleanBrand(row.brand), bu: row.business_unit, revenue: 0, watch: 0 }
      const rev = Number(row.revenue) || 0
      buckets[key].revenue += rev
      buckets[key].watch += Number(row.watch_time) || 0
      if (rev > 0 && row.date > lastRevenueDate) lastRevenueDate = row.date
    }

    const rows: PacingRow[] = Object.entries(buckets).map(([key, b]) => {
      const target = targets.find(t => normalizeBrand(String(t.Brand ?? '')) === key)
      const annualRevenueRaw = Number(target?.['Annual Revenue Target (USD)'])
      const dailyWatchRaw = Number(target?.['Daily Avg Watch Hour'])
      const annualRevenue = Number.isFinite(annualRevenueRaw) && annualRevenueRaw > 0 ? annualRevenueRaw : null
      const dailyWatch = Number.isFinite(dailyWatchRaw) && dailyWatchRaw > 0 ? dailyWatchRaw : null

      const revExpected = annualRevenue !== null ? annualRevenue * yearFraction : null
      const revPace = revExpected && revExpected > 0 ? (b.revenue / revExpected) * 100 : null
      const revProjected = daysElapsed > 0 ? (b.revenue / daysElapsed) * diy : 0

      const watchExpected = dailyWatch !== null ? dailyWatch * daysElapsed : null
      const watchPace = watchExpected && watchExpected > 0 ? (b.watch / watchExpected) * 100 : null
      const watchProjected = daysElapsed > 0 ? (b.watch / daysElapsed) * diy : 0

      return {
        brand: b.brand,
        bu: b.bu,
        revActual: b.revenue,
        revExpected,
        revPace,
        revProjected,
        revTarget: annualRevenue,
        watchActual: b.watch,
        watchExpected,
        watchPace,
        watchProjected,
        watchAnnualTarget: dailyWatch !== null ? dailyWatch * diy : null,
      }
    })

    const sorted = [...rows]
    if (sortBy === 'rev-pace-asc') sorted.sort((a, b) => (a.revPace ?? Infinity) - (b.revPace ?? Infinity))
    else if (sortBy === 'rev-pace-desc') sorted.sort((a, b) => (b.revPace ?? -Infinity) - (a.revPace ?? -Infinity))
    else if (sortBy === 'watch-pace-asc') sorted.sort((a, b) => (a.watchPace ?? Infinity) - (b.watchPace ?? Infinity))
    else if (sortBy === 'watch-pace-desc') sorted.sort((a, b) => (b.watchPace ?? -Infinity) - (a.watchPace ?? -Infinity))
    else sorted.sort((a, b) => a.brand.localeCompare(b.brand))

    return { rows: sorted, daysElapsed, diy, yearFraction, year, lastRevenueDate }
  }, [data, targets, asOf, sortBy])

  // Portfolio totals (over brands that have a target for the metric).
  const portfolio = useMemo(() => {
    let revActual = 0, revExpected = 0, watchActual = 0, watchExpected = 0
    for (const r of pacing.rows) {
      if (r.revExpected !== null) { revActual += r.revActual; revExpected += r.revExpected }
      if (r.watchExpected !== null) { watchActual += r.watchActual; watchExpected += r.watchExpected }
    }
    return {
      revActual, revExpected,
      revPace: revExpected > 0 ? (revActual / revExpected) * 100 : null,
      watchActual, watchExpected,
      watchPace: watchExpected > 0 ? (watchActual / watchExpected) * 100 : null,
    }
  }, [pacing.rows])

  if (!isAdmin) {
    return (
      <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-neutral-500">This feature is only available for admins.</p>
          </div>
        </div>
      </main>
    )
  }

  const paceColor = (pace: number | null) => {
    if (pace === null) return 'bg-neutral-300'
    if (pace >= 100) return 'bg-emerald-500'
    if (pace >= 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const statusLabel = (pace: number | null) => {
    if (pace === null) return { label: 'No target', cls: 'text-neutral-400' }
    if (pace >= 100) return { label: 'On track', cls: 'text-green-600' }
    if (pace >= 80) return { label: 'Behind', cls: 'text-yellow-600' }
    return { label: 'At risk', cls: 'text-red-600' }
  }

  const PaceBar = ({ pace }: { pace: number | null }) => (
    <div className="space-y-0.5">
      <div className="h-4 bg-neutral-100 rounded overflow-hidden">
        <div
          className={`h-full ${paceColor(pace)} flex items-center justify-center`}
          style={{ width: `${pace === null ? 0 : Math.min(100, pace)}%` }}
        >
          {pace !== null && pace > 25 && (
            <span className="text-[9px] font-semibold text-white">{pace.toFixed(0)}%</span>
          )}
        </div>
      </div>
      {pace === null && <p className="text-[10px] text-neutral-400">No target set</p>}
    </div>
  )

  const asOfLabel = asOf
    ? new Date(asOf).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <BackButton />
              <div>
                <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                  YouTube Target Pacing
                </h1>
                <p className="text-neutral-500 mt-1 text-sm">
                  {pacing.year || ''} · data through {asOfLabel} · {pacing.daysElapsed}/{pacing.diy} days
                  ({(pacing.yearFraction * 100).toFixed(0)}% of year)
                </p>
              </div>
            </div>
            <div className="relative" ref={sortModalRef}>
              <button
                onClick={() => setShowSortModal(!showSortModal)}
                className="px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition border-neutral-200 bg-white text-neutral-700 cursor-pointer hover:bg-neutral-50"
              >
                Sort by: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
                <svg className={`w-3 h-3 transition ${showSortModal ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {showSortModal && (
                <div className="absolute top-full right-0 mt-2 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 w-64">
                  {SORT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => { setSortBy(option.value); setShowSortModal(false) }}
                      className={`w-full px-2 py-1.5 text-xs text-left rounded transition flex items-center justify-between ${
                        sortBy === option.value
                          ? 'text-neutral-950 font-medium bg-neutral-100'
                          : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
                      }`}
                    >
                      {option.label}
                      {sortBy === option.value && (
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            className="h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF0000, #FF3FBF, #00E5D4, #0055EE)' }}
          />
        </div>

        {!asOf ? (
          <div className="text-center py-12">
            <p className="text-neutral-500">No YouTube data available yet.</p>
          </div>
        ) : (
          <>
            {/* Portfolio summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                <p className="text-xs text-neutral-500 uppercase font-medium mb-3">Portfolio Revenue Pace</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-2xl font-semibold text-neutral-950">
                    {portfolio.revPace !== null ? `${portfolio.revPace.toFixed(0)}%` : '—'}
                  </p>
                  <span className={`text-sm font-medium ${statusLabel(portfolio.revPace).cls}`}>
                    {statusLabel(portfolio.revPace).label}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  YTD {formatMoney(portfolio.revActual)} vs on-pace {formatMoney(portfolio.revExpected)}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-6 py-4">
                <p className="text-xs text-neutral-500 uppercase font-medium mb-3">Portfolio Watch Hours Pace</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-2xl font-semibold text-neutral-950">
                    {portfolio.watchPace !== null ? `${portfolio.watchPace.toFixed(0)}%` : '—'}
                  </p>
                  <span className={`text-sm font-medium ${statusLabel(portfolio.watchPace).cls}`}>
                    {statusLabel(portfolio.watchPace).label}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  YTD {formatHours(portfolio.watchActual)}h vs on-pace {formatHours(portfolio.watchExpected)}h
                </p>
              </div>
            </div>

            {pacing.lastRevenueDate && pacing.lastRevenueDate < asOf && (
              <p className="text-xs text-amber-600 mb-3">
                Note: revenue is uploaded manually — last revenue entry is{' '}
                {new Date(pacing.lastRevenueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},
                so revenue pacing may understate recent weeks.
              </p>
            )}

            {/* Pacing table */}
            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '110px' }}>Brand</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-neutral-700" style={{ width: '90px' }}>Annual $</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-neutral-700" style={{ width: '90px' }}>YTD $</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '170px' }}>Revenue Pace</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-neutral-700" style={{ width: '100px' }}>Proj. $</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-neutral-700" style={{ width: '90px' }}>YTD Watch</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '170px' }}>Watch Pace</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700" style={{ width: '90px' }}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {pacing.rows.map((r, i) => {
                    const status = statusLabel(r.revPace)
                    return (
                      <tr key={r.brand} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                        <td className="px-3 py-3 text-sm font-medium text-neutral-950 break-words" style={{ width: '110px' }}>
                          {r.brand}
                          <div className="text-[10px] text-neutral-400">{BUSINESS_UNIT_LABELS[r.bu] || r.bu}</div>
                        </td>
                        <td className="px-3 py-3 text-right text-[11px] text-neutral-600" style={{ width: '90px' }}>
                          {r.revTarget !== null ? formatMoney(r.revTarget) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-[11px] text-neutral-900 font-medium" style={{ width: '90px' }}>
                          {formatMoney(r.revActual)}
                        </td>
                        <td className="px-4 py-3" style={{ width: '170px' }}>
                          <PaceBar pace={r.revPace} />
                        </td>
                        <td className="px-3 py-3 text-right text-[11px] text-neutral-600" style={{ width: '100px' }}>
                          {r.revTarget !== null ? formatMoney(r.revProjected) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-[11px] text-neutral-900 font-medium" style={{ width: '90px' }}>
                          {formatHours(r.watchActual)}h
                        </td>
                        <td className="px-4 py-3" style={{ width: '170px' }}>
                          <PaceBar pace={r.watchPace} />
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold" style={{ width: '90px' }}>
                          <span className={status.cls}>{status.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-neutral-400 mt-3">
              Pace = YTD actual ÷ amount expected by {asOfLabel} to stay on the annual target
              (assumes an even pace across the year — directional, not a forecast).
            </p>
          </>
        )}
      </div>
    </main>
  )
}
