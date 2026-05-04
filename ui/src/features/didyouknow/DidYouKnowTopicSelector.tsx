import { useState } from 'react'
import type { DidYouKnowIdea } from '../../hooks/useDidYouKnow'

interface DidYouKnowTopicSelectorProps {
  ideas: DidYouKnowIdea[]
  onConfirm: (idea: DidYouKnowIdea) => void
  isLoading?: boolean
}

export function DidYouKnowTopicSelector({ ideas, onConfirm, isLoading = false }: DidYouKnowTopicSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelectIdea = (idea: DidYouKnowIdea) => {
    setSelectedId(selectedId === idea.id ? null : idea.id)
  }

  const handleConfirm = () => {
    const selected = ideas.find((i) => i.id === selectedId)
    if (selected) {
      onConfirm(selected)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
      {/* Ideas List */}
      <div className="border border-neutral-200 rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
        {ideas.map((idea) => {
          const isSelected = selectedId === idea.id
          return (
            <button
              key={idea.id}
              onClick={() => handleSelectIdea(idea)}
              className={`w-full text-left px-4 py-4 border-b border-neutral-100 last:border-b-0 transition ${
                isSelected
                  ? 'bg-neutral-50 border-l-4 border-l-neutral-900'
                  : 'hover:bg-neutral-50 border-l-4 border-l-transparent'
              }`}
            >
              <h3 className="font-semibold text-neutral-950 line-clamp-2">{idea.headline}</h3>
              <p className="text-xs text-neutral-600 mt-2 line-clamp-3">{idea.fact}</p>
            </button>
          )
        })}
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={!selectedId || isLoading}
        className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
      >
        {isLoading ? 'Loading...' : 'Review Selected Idea'}
      </button>
    </div>
  )
}
