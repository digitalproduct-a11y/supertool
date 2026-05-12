import { useState } from 'react'
import { createPortal } from 'react-dom'

interface PasscodeModalProps {
  onSuccess: () => void
  onClose: () => void
}

export function PasscodeModal({ onSuccess, onClose }: PasscodeModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const correctPasscode = import.meta.env.VITE_UPLOAD_PASSCODE as string | undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correctPasscode) {
      setError('Passcode not configured')
      return
    }
    setLoading(true)
    setError(null)

    // Add 500ms delay to rate-limit brute force attempts
    await new Promise(resolve => setTimeout(resolve, 500))

    if (input === correctPasscode) {
      // Note: sessionStorage auth is client-side only. This MUST be validated
      // server-side in production. Do not rely on sessionStorage alone for security.
      sessionStorage.setItem('uploadAuth', 'true')
      onSuccess()
    } else {
      setError('Incorrect passcode')
      setInput('')
    }
    setLoading(false)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="passcode-title"
      >
        <div className="px-6 pt-5 pb-3 border-b border-neutral-100 flex items-center justify-between">
          <h2 id="passcode-title" className="text-lg font-semibold text-neutral-950">Enter passcode</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close passcode modal"
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Passcode"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
            disabled={loading}
            autoFocus
          />
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-900">
              {error}
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !input}
            className="px-4 py-1.5 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
