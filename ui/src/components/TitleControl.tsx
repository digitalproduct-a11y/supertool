import type { TitleMode } from '../types'

interface TitleControlProps {
  value: TitleMode
  onChange: (mode: TitleMode) => void
  showCustomInput: boolean
  customValue: string
  onCustomChange: (text: string) => void
}

export function TitleControl({
  value,
  onChange,
  showCustomInput,
  customValue,
  onCustomChange,
}: TitleControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Image Title</label>
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['original', 'ai', 'custom'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              value === mode
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {mode === 'original' ? 'Original' : mode === 'ai' ? 'AI' : 'Custom'}
          </button>
        ))}
      </div>

      {showCustomInput && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Enter custom title"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        />
      )}
    </div>
  )
}
