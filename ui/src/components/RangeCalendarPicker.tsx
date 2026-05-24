import { useState, useEffect } from 'react'

interface RangeCalendarPickerProps {
  startDate: Date
  endDate: Date
  onRangeChange: (start: Date, end: Date) => void
  minDate?: Date
  maxDate?: Date
}

const PRESETS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 3 Months', days: 90 },
  { label: 'This Month', days: 0, preset: 'thisMonth' },
  { label: 'Last Month', days: 0, preset: 'lastMonth' },
]

const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

function applyPreset(preset: typeof PRESETS[0], maxDate: Date) {
  if (preset.preset === 'thisMonth') {
    const start = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
    start.setHours(0, 0, 0, 0)
    return { start, end: new Date(maxDate) }
  }
  if (preset.preset === 'lastMonth') {
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 0)
    end.setHours(23, 59, 59, 999)
    const start = new Date(end.getFullYear(), end.getMonth(), 1)
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }
  const end = new Date(maxDate)
  const start = new Date(maxDate)
  start.setDate(start.getDate() - preset.days + 1)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

function toInput(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function matchesPreset(preset: typeof PRESETS[0], start: Date, end: Date | null, maxDate: Date) {
  if (!end) return false
  const { start: presetStart, end: presetEnd } = applyPreset(preset, maxDate)
  return start.getTime() === presetStart.getTime() && end.getTime() === presetEnd.getTime()
}

export function RangeCalendarPicker({ startDate, endDate, onRangeChange, minDate, maxDate }: RangeCalendarPickerProps) {
  const [displayMonth, setDisplayMonth] = useState(new Date(endDate.getFullYear(), endDate.getMonth(), 1))
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState<Date | null>(endDate)
  const [selectingEnd, setSelectingEnd] = useState(false)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const [startInput, setStartInput] = useState(toInput(startDate))
  const [endInput, setEndInput] = useState(toInput(endDate))

  const daysInMonth = getDaysInMonth(displayMonth)
  const firstDay = getFirstDayOfMonth(displayMonth)
  const days: (number | null)[] = Array(firstDay).fill(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const isInRange = (day: number) => {
    if (!tempEnd && !selectingEnd) return false
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
    const end = hoverDate || tempEnd
    if (!end) return false
    return date >= tempStart && date <= end
  }

  const isRangeStart = (day: number) => {
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
    return date.toDateString() === tempStart.toDateString()
  }

  const isRangeEnd = (day: number) => {
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
    const end = hoverDate || tempEnd
    if (!end) return false
    return date.toDateString() === end.toDateString()
  }

  const isDisabled = (day: number) => {
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  const handleDayClick = (day: number) => {
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day, 0, 0, 0, 0)
    if (!selectingEnd) {
      setTempStart(date)
      setTempEnd(null)
      setStartInput(toInput(date))
      setEndInput('')
      setSelectingEnd(true)
      setHoverDate(null)
    } else {
      if (date < tempStart) {
        setTempStart(date)
        setTempEnd(tempStart)
        setStartInput(toInput(date))
        setEndInput(toInput(tempStart))
      } else {
        setTempEnd(date)
        setEndInput(toInput(date))
      }
      setSelectingEnd(false)
      setHoverDate(null)
    }
  }

  const handleApply = () => {
    if (tempEnd) {
      onRangeChange(tempStart, tempEnd)
    }
  }

  const handleStartInputChange = (value: string) => {
    setStartInput(value)
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      setTempStart(date)
    }
  }

  const handleEndInputChange = (value: string) => {
    setEndInput(value)
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      setTempEnd(date)
    }
  }

  const maxSelectableDate = maxDate || new Date()

  return (
    <div className="flex gap-6">
      {/* Left panel: Presets */}
      <div className="flex flex-col gap-2">
        {PRESETS.map(preset => {
          const isSelected = matchesPreset(preset, tempStart, tempEnd, maxSelectableDate)
          return (
            <button
              key={preset.label}
              onClick={() => {
                const { start, end } = applyPreset(preset, maxSelectableDate)
                setTempStart(start)
                setTempEnd(end)
                setStartInput(toInput(start))
                setEndInput(toInput(end))
                setSelectingEnd(false)
                setDisplayMonth(new Date(end.getFullYear(), end.getMonth(), 1))
              }}
              className={`px-3 py-2 text-xs font-medium text-left rounded transition whitespace-nowrap ${
                isSelected
                  ? 'bg-neutral-950 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {/* Right panel: Calendar and inputs */}
      <div className="flex-1 space-y-3">
        {/* Manual date inputs */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-neutral-600 block mb-0.5">Start</label>
            <input
              type="date"
              value={startInput}
              onChange={e => handleStartInputChange(e.target.value)}
              className={`w-full px-2 py-1 border rounded text-xs transition ${
                !tempEnd
                  ? 'border-neutral-950 bg-neutral-50'
                  : 'border-neutral-200'
              }`}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-neutral-600 block mb-0.5">End</label>
            <input
              type="date"
              value={endInput}
              onChange={e => handleEndInputChange(e.target.value)}
              className={`w-full px-2 py-1 border rounded text-xs transition ${
                tempEnd ? 'border-neutral-200' : selectingEnd ? 'border-neutral-950 bg-neutral-50' : 'border-neutral-200'
              }`}
            />
          </div>
        </div>

        {/* Calendar */}
        <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
            className="p-1 hover:bg-neutral-100 rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="font-medium text-neutral-950">
            {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
            className="p-1 hover:bg-neutral-100 rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-xs font-medium text-neutral-600 text-center py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} />
            }

            const disabled = isDisabled(day)
            const inRange = isInRange(day)
            const isStart = isRangeStart(day)
            const isEnd = isRangeEnd(day)

            return (
              <button
                key={day}
                onClick={() => !disabled && handleDayClick(day)}
                disabled={disabled}
                onMouseEnter={() => !disabled && selectingEnd && setHoverDate(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day))}
                onMouseLeave={() => setHoverDate(null)}
                className={`py-1.5 text-sm rounded transition ${
                  disabled
                    ? 'text-neutral-300 cursor-not-allowed'
                    : isStart || isEnd
                    ? 'bg-neutral-950 text-white font-medium'
                    : inRange
                    ? 'bg-neutral-200 text-neutral-950'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-end border-t border-neutral-200 pt-4">
        <button className="px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 rounded transition">
          Cancel
        </button>
        <button
          onClick={handleApply}
          className="px-3 py-1.5 text-sm bg-neutral-950 text-white rounded font-medium hover:bg-neutral-800 transition"
        >
          Apply
        </button>
      </div>

      </div>
    </div>
  )
}
