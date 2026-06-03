import { useRef, useState, useEffect } from 'react'
import { IconCheck } from '@tabler/icons-react'

const BUSINESS_UNIT_LABELS: Record<string, string> = {
  'AASB': 'Astro',
  'MBNS': 'Astro',
  'ARSB': 'Astro Radio',
  'NISB': 'Nu Ideaktiv',
}

const BRAND_ENTITY_OVERRIDES: Record<string, string> = {
  'Astro Radio News': 'Astro Radio',
  'Era': 'Astro Radio',
  'Hitz': 'Astro Radio',
  'Lite': 'Astro Radio',
  'Mix': 'Astro Radio',
  'Sinar': 'Astro Radio',
  'Zayan My': 'Astro Radio',
  'Melody': 'Astro Radio',
  'BorakSeeni': 'Nu Ideaktiv',
  'Keluarga': 'Nu Ideaktiv',
  'Maskulin': 'Nu Ideaktiv',
  'Pa&Ma': 'Nu Ideaktiv',
  'Remaja': 'Nu Ideaktiv',
}

interface YouTubeDashboardHeaderProps {
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

const MIN_DATA_DATE = new Date(2025, 11, 1, 0, 0, 0, 0)

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
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const handleDayClick = (day: number) => {
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day, 0, 0, 0, 0)
    onSelect(newDate)
    if (!isStart) setDisplayMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1))
  }

  const monthName = displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="w-64">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))} className="text-neutral-500 hover:text-neutral-700">←</button>
        <p className="text-sm font-medium text-neutral-700">{monthName}</p>
        <button onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))} className="text-neutral-500 hover:text-neutral-700">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
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
                isSelected ? 'bg-neutral-950 text-white font-medium'
                  : isDisabled ? 'text-neutral-300 cursor-not-allowed'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >{day}</button>
          )
        })}
      </div>
    </div>
  )
}

const PRESETS = [
  { label: '7D', start: () => daysAgo(8), end: () => { const d = daysAgo(1); d.setHours(23,59,59,999); return d } },
  { label: '14D', start: () => daysAgo(15), end: () => { const d = daysAgo(1); d.setHours(23,59,59,999); return d } },
  { label: '30D', start: () => daysAgo(31), end: () => { const d = daysAgo(1); d.setHours(23,59,59,999); return d } },
  { label: 'Last 3M', start: () => daysAgo(91), end: () => { const d = daysAgo(1); d.setHours(23,59,59,999); return d } },
  { label: 'This month', start: () => startOfMonth(0), end: () => { const d = daysAgo(1); d.setHours(23,59,59,999); return d } },
  { label: 'Last month', start: () => startOfMonth(-1), end: () => endOfMonth(-1) },
]

export function YouTubeDashboardHeader({
  brand,
  brands,
  onBrandChange,
  startDate,
  endDate,
  onDateRangeChange,
}: YouTubeDashboardHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)
  const pickerRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLDivElement>(null)

  const appliedStart = toInput(startDate)
  const appliedEnd = toInput(endDate)

  const activePreset = PRESETS.findIndex(p =>
    toInput(p.start()) === appliedStart && toInput(p.end()) === appliedEnd
  )

  const applyPreset = (p: typeof PRESETS[number]) => {
    onDateRangeChange(p.start(), p.end())
    setPickerOpen(false)
  }

  const handleApply = () => {
    if (tempStart < tempEnd) {
      const start = new Date(tempStart); start.setHours(0,0,0,0)
      const end = new Date(tempEnd); end.setHours(23,59,59,999)
      onDateRangeChange(start, end)
      setPickerOpen(false)
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) setBrandDropdownOpen(false)
    }
    if (pickerOpen || brandDropdownOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [pickerOpen, brandDropdownOpen])

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4 mb-2">
      <div className="flex flex-wrap gap-3 items-center justify-between">
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
            const knownOrder = ['Astro', 'Astro Radio', 'Nu Ideaktiv']

            brands.forEach(item => {
              const label = BRAND_ENTITY_OVERRIDES[item.brand] || BUSINESS_UNIT_LABELS[item.bu] || 'Astro'
              if (!groupedByEntity[label]) groupedByEntity[label] = []
              groupedByEntity[label].push(item)
            })

            Object.values(groupedByEntity).forEach(list => list.sort((a, b) => a.brand.localeCompare(b.brand)))
            const entityOrder = knownOrder.filter(k => groupedByEntity[k]?.length)

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

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1.5 items-center">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  activePreset === i ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >{p.label}</button>
            ))}
          </div>
          <span className="text-neutral-300 text-sm">|</span>
          <div className="flex gap-2 items-center relative" ref={pickerRef}>
            <button onClick={() => setPickerOpen(v => !v)} className="px-3 py-1 border border-neutral-200 rounded text-sm hover:bg-neutral-50 transition">
              {appliedStart} to {appliedEnd}
            </button>
            {pickerOpen && (
              <div className="absolute top-full mt-2 z-50 bg-white border border-neutral-200 rounded-lg shadow-xl p-4" style={{ right: 0, width: '550px', paddingRight: '24px' }}>
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div>
                    <p className="text-xs font-medium text-neutral-600 mb-3">Start Date</p>
                    <CalendarMonth date={tempStart} onSelect={setTempStart} isStart maxDate={tempEnd} minDate={MIN_DATA_DATE} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-600 mb-3">End Date</p>
                    <CalendarMonth date={tempEnd} onSelect={setTempEnd} isStart={false} minDate={tempStart} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setPickerOpen(false)} className="px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 rounded transition">Cancel</button>
                  <button onClick={handleApply} className="px-3 py-1 bg-neutral-950 text-white rounded text-sm font-medium hover:bg-neutral-800 transition">Apply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <ul className="text-xs text-amber-900 space-y-1 list-disc list-inside">
          <li><span className="font-medium">Watch time + Videos Published pulled daily from Sprout Social</span></li>
          <li>Revenue is uploaded manually from YouTube Studio</li>
        </ul>
      </div>
    </div>
  )
}
