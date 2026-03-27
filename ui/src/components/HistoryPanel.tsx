import { useState } from 'react'
import type { HistoryItem } from '../types'

interface HistoryPanelProps {
  items: HistoryItem[]
}

const ITEMS_PER_PAGE = 2

export function HistoryPanel({ items }: HistoryPanelProps) {
  const [page, setPage] = useState(0)
  const [isExpanded, setIsExpanded] = useState(typeof window !== 'undefined' && window.innerWidth >= 768)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  function toggleCaption(id: string) {
    setExpandedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (items.length === 0) return null

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE)
  const startIdx = page * ITEMS_PER_PAGE
  const endIdx = startIdx + ITEMS_PER_PAGE
  const paginatedItems = items.slice(startIdx, endIdx)

  async function downloadItem(item: HistoryItem) {
    try {
      const res = await fetch(item.imageUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${item.brand}_${item.id}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(item.imageUrl, '_blank')
    }
  }

  async function copyCaption(caption: string) {
    await navigator.clipboard.writeText(caption)
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-3 hover:text-gray-700 transition"
      >
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Session history ({items.length})
        </h3>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {isExpanded && (
        <>
          <div className="space-y-3">
            {paginatedItems.map(item => (
              <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-200"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400 mb-1">
                    {item.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })} at {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className={`text-sm text-gray-700 leading-relaxed ${expandedItems.has(item.id) ? '' : 'line-clamp-2'}`}>
                    {item.caption}
                  </div>
                  <button
                    onClick={() => toggleCaption(item.id)}
                    className="text-xs text-neutral-400 hover:text-neutral-600 mt-1.5 font-medium transition"
                  >
                    {expandedItems.has(item.id) ? 'Show less' : 'Show more'}
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => downloadItem(item)}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 font-medium transition"
                  >
                    Download Image
                  </button>
                  <button
                    onClick={() => copyCaption(item.caption)}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 font-medium transition"
                  >
                    Copy Caption
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            Next
          </button>
        </div>
          )}
        </>
      )}
    </div>
  )
}
