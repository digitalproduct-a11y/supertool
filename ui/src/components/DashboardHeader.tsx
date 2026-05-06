import { useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'

interface DashboardHeaderProps {
  brand: string
  businessUnit: string
  startDate: Date
  endDate: Date
  onDateRangeChange: (start: Date, end: Date) => void
  viewMode: 'daily' | 'weekly'
  onViewModeChange: (mode: 'daily' | 'weekly') => void
  onRefresh: () => void
  isLoading: boolean
}

export function DashboardHeader({
  brand,
  businessUnit,
  startDate,
  endDate,
  onDateRangeChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  isLoading,
}: DashboardHeaderProps) {
  const [startInput, setStartInput] = useState(startDate.toISOString().split('T')[0])
  const [endInput, setEndInput] = useState(endDate.toISOString().split('T')[0])

  const handleApplyDates = () => {
    const start = new Date(startInput)
    const end = new Date(endInput)
    if (start < end) {
      onDateRangeChange(start, end)
    }
  }

  return (
    <div className="bg-white sticky top-0 z-40 border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">{brand}</h1>
            <p className="text-sm text-neutral-600 mt-1">{businessUnit}</p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 hover:bg-neutral-100 rounded-lg transition disabled:opacity-50"
            title="Refresh data"
          >
            <IconRefresh className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium text-neutral-700">Date:</label>
            <input
              type="date"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="px-2 py-1 border border-neutral-200 rounded text-sm"
            />
            <span className="text-neutral-500">to</span>
            <input
              type="date"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="px-2 py-1 border border-neutral-200 rounded text-sm"
            />
            <button
              onClick={handleApplyDates}
              className="px-3 py-1 bg-neutral-950 text-white rounded text-sm font-medium hover:bg-neutral-800 transition"
            >
              Apply
            </button>
          </div>

          <div className="flex gap-2 border border-neutral-200 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('daily')}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                viewMode === 'daily'
                  ? 'bg-neutral-950 text-white'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => onViewModeChange('weekly')}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                viewMode === 'weekly'
                  ? 'bg-neutral-950 text-white'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              Weekly
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
