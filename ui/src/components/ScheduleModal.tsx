import { useState } from 'react'
import { toast } from '../hooks/useToast'

interface ScheduleModalProps {
  brand: string
  hasCredentials: boolean
  isPosting: boolean
  onConfirm: (scheduledFor: string, passcode?: string) => void
  onClose: () => void
}

export function ScheduleModal({ brand, hasCredentials, isPosting, onConfirm, onClose }: ScheduleModalProps) {
  const [scheduledFor, setScheduledFor] = useState('')
  const [passcode, setPasscode] = useState('')

  const canSubmit = !!scheduledFor && (hasCredentials || !!passcode.trim()) && !isPosting

  function handleConfirm() {
    if (!scheduledFor) {
      toast.error('Please pick a date and time.')
      return
    }
    if (!hasCredentials && !passcode.trim()) {
      toast.error('Please enter the passcode.')
      return
    }
    onConfirm(new Date(scheduledFor).toISOString(), hasCredentials ? undefined : passcode.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-950">Schedule on FB</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-neutral-500">Posting for <span className="font-medium text-neutral-800">{brand}</span></p>

        {/* Passcode field — only when no stored credentials */}
        {!hasCredentials && (
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Brand Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder={`Passcode for ${brand}`}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
          </div>
        )}

        {/* Datetime picker */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">Schedule date & time</label>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={e => setScheduledFor(e.target.value)}
            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
            autoFocus={hasCredentials}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-700"
          />
        </div>

        <button
          onClick={handleConfirm}
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isPosting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Scheduling…
            </span>
          ) : 'Schedule'}
        </button>
      </div>
    </div>
  )
}
