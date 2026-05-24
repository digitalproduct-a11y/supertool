import { useRef, useState, useEffect } from 'react'
import { IconRefresh, IconCheck } from '@tabler/icons-react'
import { RangeCalendarPicker } from './RangeCalendarPicker'

interface DashboardHeaderProps {
  brand: string
  businessUnit: string
  brands: { brand: string; bu: string }[]
  onBrandChange: (brand: string) => void
  startDate: Date
  endDate: Date
  onDateRangeChange: (start: Date, end: Date) => void
  onRefresh?: () => void
  loading?: boolean
  viewMode?: 'daily' | 'weekly' | 'monthly'
  onViewModeChange?: (mode: 'daily' | 'weekly' | 'monthly') => void
  showComparison?: boolean
  onShowComparisonChange?: (show: boolean) => void
  showTargets?: boolean
  onShowTargetsChange?: (show: boolean) => void
}

const toInput = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

const MIN_DATA_DATE = new Date(2026, 0, 2, 0, 0, 0, 0)

const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

interface CalendarMonthProps {
  date: Date
  onSelect: (date: Date) => void
  isStart: boolean
  minDate?: Date
  maxDate?: Date
}

function CalendarMonth({ date, onSelect, isStart, minDate, maxDate }: CalendarMonthProps) {
  const [displayMonth, setDisplayMonth] = useState(new Date(date.getFullYear(), date.getMonth(), 1))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysInMonth = getDaysInMonth(displayMonth)
  const firstDay = getFirstDayOfMonth(displayMonth)
  const days: (number | null)[] = Array(firstDay).fill(null)

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const handleDayClick = (day: number) => {
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day, 0, 0, 0, 0)
    onSelect(newDate)
    if (!isStart) setDisplayMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1))
  }

  const monthName = displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="w-64">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
          className="text-neutral-500 hover:text-neutral-700"
        >
          ←
        </button>
        <p className="text-sm font-medium text-neutral-700">{monthName}</p>
        <button
          onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
          className="text-neutral-500 hover:text-neutral-700"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <p key={d} className="text-xs text-neutral-400 text-center py-1 font-medium">{d}</p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const cellDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day, 0, 0, 0, 0)
          const isFuture = cellDate > today
          const isDisabled = isFuture || (minDate && cellDate < minDate) || (maxDate && cellDate > maxDate)
          const isSelected = date.toDateString() === cellDate.toDateString()

          return (
            <button
              key={day}
              onClick={() => !isDisabled && handleDayClick(day)}
              disabled={isDisabled}
              className={`w-7 h-7 text-xs text-center rounded transition ${
                isSelected
                  ? 'bg-neutral-950 text-white font-medium'
                  : isDisabled
                  ? 'text-neutral-300 cursor-not-allowed'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const BUSINESS_UNIT_LABELS: Record<string, string> = {
  'AASB': 'Astro',
  'MBNS': 'Astro',
  'ARSB': 'Astro Radio',
  'NISB': 'Nu Ideaktiv',
}

const PRESETS = [
  { label: 'Last 7 Days', start: () => daysAgo(9), end: () => { const d = daysAgo(2); d.setHours(23, 59, 59, 999); return d } },
  { label: 'Last 14 Days', start: () => daysAgo(16), end: () => { const d = daysAgo(2); d.setHours(23, 59, 59, 999); return d } },
  { label: 'Last 30 Days', start: () => daysAgo(32), end: () => { const d = daysAgo(2); d.setHours(23, 59, 59, 999); return d } },
  { label: 'Last 3 Months', start: () => daysAgo(92), end: () => { const d = daysAgo(2); d.setHours(23, 59, 59, 999); return d } },
  { label: 'This Month', start: () => startOfMonth(0), end: () => { const d = daysAgo(2); d.setHours(23, 59, 59, 999); return d } },
  { label: 'Last Month', start: () => startOfMonth(-1), end: () => endOfMonth(-1) },
]

export function DashboardHeader({
  brand,
  brands,
  onBrandChange,
  startDate,
  endDate,
  onDateRangeChange,
  onRefresh,
  loading,
  viewMode = 'daily',
  onViewModeChange,
  showComparison = true,
  onShowComparisonChange,
  showTargets = true,
  onShowTargetsChange,
}: DashboardHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [showViewOptions, setShowViewOptions] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLDivElement>(null)

  const appliedStart = toInput(startDate)
  const appliedEnd = toInput(endDate)

  const activePreset = PRESETS.findIndex(p =>
    toInput(p.start()) === appliedStart && toInput(p.end()) === appliedEnd
  )

  const applyPreset = (p: typeof PRESETS[number]) => {
    const start = p.start()
    const end = p.end()
    onDateRangeChange(start, end)
    setPickerOpen(false)
  }

  const handleApply = () => {
    if (tempStart < tempEnd) {
      const start = new Date(tempStart)
      start.setHours(0, 0, 0, 0)
      const end = new Date(tempEnd)
      end.setHours(23, 59, 59, 999)
      onDateRangeChange(start, end)
      setPickerOpen(false)
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setBrandDropdownOpen(false)
      }
    }
    if (pickerOpen || brandDropdownOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [pickerOpen, brandDropdownOpen])

  const maxSelectableDate = daysAgo(2)

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4 mb-2 flex gap-3 items-center justify-between">
      {/* Left section: Brand dropdown */}
      <div className="flex gap-3 items-center">
          {/* Brand dropdown */}
          <div className="relative" ref={brandRef}>
            <button
              onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
              className="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm font-medium bg-white cursor-pointer hover:bg-neutral-50 transition flex items-center gap-2"
            >
              {brand}
              <svg className={`w-3 h-3 transition ${brandDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {brandDropdownOpen && (() => {
              const groupedByEntity: Record<string, typeof brands> = {}
              const entityOrder = ['Astro', 'Astro Radio', 'Nu Ideaktiv']

              brands.forEach(item => {
                const label = BUSINESS_UNIT_LABELS[item.bu] || item.bu
                if (!groupedByEntity[label]) groupedByEntity[label] = []
                groupedByEntity[label].push(item)
              })

              return (
                <div className="absolute top-full left-0 mt-3 z-20 bg-white border border-neutral-200 rounded-lg shadow-xl p-6" style={{ width: '700px' }}>
                  <div className="grid grid-cols-3 gap-8">
                    {entityOrder.map(entity => (
                      <div key={entity}>
                        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-widest pb-2 border-b border-neutral-200 mb-3">
                          {entity}
                        </h3>
                        <div className="space-y-1">
                          {(groupedByEntity[entity] || []).map(({ brand: b }) => (
                            <button
                              key={b}
                              onClick={() => {
                                onBrandChange(b)
                                setBrandDropdownOpen(false)
                              }}
                              className={`w-full px-2 py-1.5 text-xs text-left rounded transition flex items-center justify-between ${
                                brand === b
                                  ? 'text-neutral-950 font-medium bg-neutral-100'
                                  : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
                              }`}
                            >
                              {b}
                              {brand === b && <IconCheck className="w-4 h-4 flex-shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Right section: Refresh, Data availability, View mode, Calendar picker */}
        <div className="flex gap-3 items-center">
          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh data
            </button>
          )}

          {/* Data availability button */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition"
            title="Data availability info"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Data availability
          </button>

          {/* View options dropdown */}
          <div className="relative">
          <button
            onClick={() => setShowViewOptions(!showViewOptions)}
            className="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition flex items-center gap-2"
          >
            View: {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
            <svg className={`w-3 h-3 transition ${showViewOptions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {showViewOptions && (
            <div className="absolute top-full mt-2 z-50 bg-white border border-neutral-200 rounded-lg shadow-xl p-4" style={{ width: '280px', right: 0 }}>
              {/* View mode */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-2">View Mode</p>
                <div className="flex gap-1 border border-neutral-200 rounded-lg p-1">
                  {(['daily', 'weekly', 'monthly'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => {
                        onViewModeChange?.(mode)
                        setShowViewOptions(false)
                      }}
                      className={`flex-1 px-2 py-1 rounded text-xs font-medium transition capitalize ${
                        viewMode === mode ? 'bg-neutral-950 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2 border-t border-neutral-200 pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showComparison}
                    onChange={() => onShowComparisonChange?.(!showComparison)}
                    className="w-4 h-4 rounded border-neutral-300 accent-neutral-950 cursor-pointer"
                  />
                  <span className="text-sm text-neutral-600">vs Previous Period</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showTargets}
                    onChange={() => onShowTargetsChange?.(!showTargets)}
                    className="w-4 h-4 rounded border-neutral-300 accent-neutral-950 cursor-pointer"
                  />
                  <span className="text-sm text-neutral-600">Show targets</span>
                </label>
              </div>
            </div>
          )}
          </div>

          {/* Date range picker */}
          <div className="flex gap-2 items-center relative" ref={pickerRef}>
            <button
              onClick={() => setPickerOpen(v => !v)}
              className="px-3 py-1 border border-neutral-200 rounded text-sm hover:bg-neutral-50 transition"
            >
              {appliedStart} to {appliedEnd}
            </button>

            {pickerOpen && (
              <div className="absolute top-full mt-2 z-50 bg-white border border-neutral-200 rounded-lg shadow-xl p-4" style={{ right: 0, width: '520px' }}>
                <RangeCalendarPicker
                  startDate={tempStart}
                  endDate={tempEnd}
                  onRangeChange={(start, end) => {
                    const adjustedStart = new Date(start)
                    adjustedStart.setHours(0, 0, 0, 0)
                    const adjustedEnd = new Date(end)
                    adjustedEnd.setHours(23, 59, 59, 999)
                    setTempStart(adjustedStart)
                    setTempEnd(adjustedEnd)
                    onDateRangeChange(adjustedStart, adjustedEnd)
                    setPickerOpen(false)
                  }}
                  minDate={MIN_DATA_DATE}
                  maxDate={maxSelectableDate}
                />
              </div>
            )}
          </div>
        </div>

      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowInfoModal(false)}>
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-950">Data Availability</h3>
              <button onClick={() => setShowInfoModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ul className="text-sm text-neutral-700 space-y-2 list-disc list-inside">
              <li><span className="font-medium">Data available from 2 Jan 2026 onwards</span></li>
              <li>All data available at T-2 (2 days delay). Revenue data may have additional delay</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
