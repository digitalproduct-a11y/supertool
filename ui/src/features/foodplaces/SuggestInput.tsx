import { useState, useRef, useEffect } from 'react'

interface SuggestInputProps {
  value: string
  onChange: (next: string) => void
  options: readonly string[]
  placeholder?: string
  maxResults?: number
}

/**
 * Plain text input with a substring-match dropdown. No external deps.
 * Hides on outside click, blur, escape, or selection.
 */
export function SuggestInput({
  value,
  onChange,
  options,
  placeholder,
  maxResults = 6,
}: SuggestInputProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const q = value.trim().toLowerCase()
  const matches =
    q.length === 0
      ? []
      : options.filter((o) => o.toLowerCase().includes(q)).slice(0, maxResults)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-neutral-200 shadow-lg z-20 max-h-60 overflow-y-auto">
          {matches.map((m) => {
            const idx = m.toLowerCase().indexOf(q)
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onChange(m)
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 text-sm border-b border-neutral-100 last:border-b-0"
              >
                {m.slice(0, idx)}
                <span className="font-semibold text-neutral-900">
                  {m.slice(idx, idx + q.length)}
                </span>
                {m.slice(idx + q.length)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
