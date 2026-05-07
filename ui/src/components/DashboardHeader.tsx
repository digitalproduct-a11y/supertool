import { useRef, useState } from 'react'

interface DashboardHeaderProps {
  brand: string
  businessUnit: string
  brands: { brand: string; bu: string }[]
  onBrandChange: (brand: string) => void
  startDate: Date
  endDate: Date
  onDateRangeChange: (start: Date, end: Date) => void
}

const toInput = (d: Date) => d.toISOString().split('T')[0]

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

const startOfMonth = (offset = 0) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfMonth = (offset = 0) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset + 1)
  d.setDate(d.getDate() - 1)
  d.setHours(23, 59, 59, 999)
  return d
}

const PRESETS = [
  { label: '7D', start: () => daysAgo(8), end: () => daysAgo(2) },
  { label: '14D', start: () => daysAgo(15), end: () => daysAgo(2) },
  { label: '30D', start: () => daysAgo(31), end: () => daysAgo(2) },
  { label: 'This month', start: () => startOfMonth(0), end: () => daysAgo(2) },
  { label: 'Last month', start: () => startOfMonth(-1), end: () => endOfMonth(-1) },
]

export function DashboardHeader({
  brand,
  businessUnit,
  brands,
  onBrandChange,
  startDate,
  endDate,
  onDateRangeChange,
}: DashboardHeaderProps) {
  const startInputRef = useRef<HTMLInputElement>(null)
  const endInputRef = useRef<HTMLInputElement>(null)
  const [, forceUpdate] = useState(0)

  const appliedStart = toInput(startDate)
  const appliedEnd = toInput(endDate)

  const startInputVal = startInputRef.current?.value ?? appliedStart
  const endInputVal = endInputRef.current?.value ?? appliedEnd
  const isDirty = startInputVal !== appliedStart || endInputVal !== appliedEnd

  const activePreset = PRESETS.findIndex(p =>
    toInput(p.start()) === appliedStart && toInput(p.end()) === appliedEnd
  )

  const applyPreset = (p: typeof PRESETS[number]) => {
    const start = p.start()
    const end = p.end()
    if (startInputRef.current) startInputRef.current.value = toInput(start)
    if (endInputRef.current) endInputRef.current.value = toInput(end)
    onDateRangeChange(start, end)
  }

  const handleApply = () => {
    const start = new Date(startInputRef.current?.value ?? appliedStart)
    const end = new Date(endInputRef.current?.value ?? appliedEnd)
    if (start < end) onDateRangeChange(start, end)
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4 mb-2">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {/* Brand dropdown */}
        <select
          value={brand}
          onChange={(e) => onBrandChange(e.target.value)}
          className="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm font-medium bg-white cursor-pointer hover:bg-neutral-50 transition"
        >
          {brands.map(({ brand: b }) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Preset chips */}
          <div className="flex gap-1.5 items-center">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  activePreset === i
                    ? 'bg-neutral-950 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <span className="text-neutral-300 text-sm">|</span>

          {/* Custom date range */}
          <div className="flex gap-2 items-center">
            <input
              ref={startInputRef}
              type="date"
              defaultValue={appliedStart}
              min="2026-01-16"
              onChange={() => forceUpdate(n => n + 1)}
              className="px-2 py-1 border border-neutral-200 rounded text-sm"
            />
            <span className="text-neutral-400 text-xs">to</span>
            <input
              ref={endInputRef}
              type="date"
              defaultValue={appliedEnd}
              min="2026-01-16"
              onChange={() => forceUpdate(n => n + 1)}
              className="px-2 py-1 border border-neutral-200 rounded text-sm"
            />
            <button
              onClick={handleApply}
              disabled={!isDirty}
              className="px-3 py-1 bg-neutral-950 text-white rounded text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <p className="text-xs font-medium text-amber-900">Data available from 16 Jan 2026 onwards.</p>
      </div>
    </div>
  )
}
