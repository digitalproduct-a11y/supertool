import { useState } from 'react'
import { Modal } from './ds/Modal'
import type { FBCredentials } from '../utils/fbCredentials'

interface FBCredentialsModalProps {
  brand: string
  onSave: (creds: FBCredentials) => void
  onClose: () => void
}

export function FBCredentialsModal({ brand, onSave, onClose }: FBCredentialsModalProps) {
  const [passcode, setPasscode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passcode.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      onSave({ passcode: passcode.trim() })
    } catch {
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <Modal open title={`Passcode for ${brand}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-neutral-500">
          Enter the passcode for <span className="font-medium text-neutral-800">{brand}</span> to schedule posts on Facebook.
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Brand Passcode</label>
          <input
            type="password"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            placeholder={`Passcode for ${brand}`}
            required
            autoFocus
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          />
        </div>

        <p className="text-xs text-neutral-400">
          Your passcode is saved in this browser — you won't need to enter it again.
        </p>

        <button
          type="submit"
          disabled={isLoading || !passcode.trim()}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLoading ? 'Saving…' : 'Save & Continue'}
        </button>
      </form>
    </Modal>
  )
}
