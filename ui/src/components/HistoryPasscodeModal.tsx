import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TurnstileWidget } from './TurnstileWidget'
import { turnstileEnabled } from '../utils/turnstile'

const CAPTCHA_AFTER = 3

interface HistoryPasscodeModalProps {
  onSubmit: (passcode: string, captchaToken?: string) => Promise<{ ok: boolean; message?: string; captchaRequired?: boolean }>
  onClose: () => void
}

export function HistoryPasscodeModal({ onSubmit, onClose }: HistoryPasscodeModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaNonce, setCaptchaNonce] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const showCaptcha = turnstileEnabled && (attempts >= CAPTCHA_AFTER || captchaRequired)
  const captchaBlocking = showCaptcha && !captchaToken

  const handleSubmit = async () => {
    if (!input || loading || captchaBlocking) return
    setLoading(true)
    setError(null)
    const res = await onSubmit(input, captchaToken)
    setLoading(false)
    if (!res.ok) {
      if (res.captchaRequired) setCaptchaRequired(true)
      setError(res.captchaRequired ? 'Please complete the verification below.' : (res.message ?? 'Incorrect passcode. Try again.'))
      setAttempts(a => a + 1)
      setCaptchaToken('')
      setCaptchaNonce(n => n + 1)
      setInput('')
      inputRef.current?.focus()
    }
    // on success the parent closes the modal
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-slide-up"
        onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="history-modal-title" aria-modal="true">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="history-modal-title" className="text-base font-semibold text-neutral-950">History Log</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Enter the passcode to view this brand's history</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal"
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none ml-4 transition-colors">×</button>
        </div>
        <div className="space-y-3">
          <input ref={inputRef} type="password" value={input}
            onChange={e => { setInput(e.target.value); if (error) setError(null) }}
            onKeyDown={handleKeyDown} placeholder="Passcode"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950/20 focus:border-neutral-400 transition" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          {showCaptcha && <TurnstileWidget resetSignal={captchaNonce} onToken={setCaptchaToken} />}
          <button type="button" onClick={handleSubmit} disabled={!input || loading || captchaBlocking}
            className="w-full px-4 py-2 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium">
            {loading ? 'Checking…' : 'Unlock →'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
