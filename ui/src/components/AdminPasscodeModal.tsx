import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface AdminPasscodeModalProps {
  onSuccess: () => void
  onClose: () => void
}

export function AdminPasscodeModal({ onSuccess, onClose }: AdminPasscodeModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!input) return
    const correctPasscode = import.meta.env.VITE_ADMIN_PASSCODE as string | undefined
    if (correctPasscode && input === correctPasscode) {
      sessionStorage.setItem('kult_admin_auth', '1')
      onSuccess()
    } else {
      setError('Incorrect passcode. Try again.')
      setInput('')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-slide-up"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="admin-modal-title"
        aria-modal="true"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="admin-modal-title" className="text-base font-semibold text-neutral-950">
              Admin Access
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">Enter passcode to continue</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none ml-4 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={input}
            onChange={e => {
              setInput(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Passcode"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950/20 focus:border-neutral-400 transition"
          />

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input}
            className="w-full px-4 py-2 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
