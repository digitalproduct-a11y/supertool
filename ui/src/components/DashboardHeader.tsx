import { useRef, useState } from 'react'

interface DashboardHeaderProps {
  brand: string
  businessUnit: string
  startDate: Date
  endDate: Date
  onDateRangeChange: (start: Date, end: Date) => void
  viewMode: 'daily' | 'weekly' | 'monthly'
  onViewModeChange: (mode: 'daily' | 'weekly' | 'monthly') => void
  showComparison: boolean
  onToggleComparison: () => void
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
  startDate,
  endDate,
  onDateRangeChange,
  viewMode,
  onViewModeChange,
  showComparison,
  onToggleComparison,
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
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-950">{brand}</span>
          {businessUnit && (
            <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{businessUnit}</span>
          )}
        </div>

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

          {/* View mode */}
          <div className="flex gap-1 border border-neutral-200 rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`px-3 py-1 rounded text-sm font-medium transition capitalize ${
                  viewMode === mode ? 'bg-neutral-950 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showComparison}
              onChange={onToggleComparison}
              className="w-4 h-4 rounded border-neutral-300 accent-neutral-950 cursor-pointer"
            />
            <span className="text-sm text-neutral-600 whitespace-nowrap">vs Previous Period</span>
          </label>
        </div>
      </div>
      <p className="text-xs text-neutral-400 mt-3">Data available from 16 Jan 2026 onwards.</p>
    </div>
  )
}
