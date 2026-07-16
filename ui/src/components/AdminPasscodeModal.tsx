import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { saveAdminToken } from '../utils/adminAuth'
import { TurnstileWidget } from './TurnstileWidget'
import { turnstileEnabled } from '../utils/turnstile'

const CAPTCHA_AFTER = 3 // show CAPTCHA once failed attempts reach this

interface AdminPasscodeModalProps {
  onSuccess: () => void
  onClose: () => void
}

export function AdminPasscodeModal({ onSuccess, onClose }: AdminPasscodeModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0) // seconds remaining after a 429
  const [attempts, setAttempts] = useState(0)
  const [captchaRequired, setCaptchaRequired] = useState(false) // server demanded a CAPTCHA
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaNonce, setCaptchaNonce] = useState(0) // remount widget for a fresh token
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Tick down the lockout timer once per second.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const locked = cooldown > 0
  const showCaptcha = turnstileEnabled && (attempts >= CAPTCHA_AFTER || captchaRequired)
  const captchaBlocking = showCaptcha && !captchaToken

  const handleSubmit = async () => {
    if (!input || loading || locked || captchaBlocking) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: input, turnstileToken: captchaToken }),
      })
      if (res.ok) {
        const { token } = await res.json() as { token: string }
        saveAdminToken(token)
        onSuccess()
      } else if (res.status === 429) {
        const data = await res.json().catch(() => ({})) as { retryAfter?: number }
        const retryAfter = data.retryAfter && data.retryAfter > 0
          ? data.retryAfter
          : Number(res.headers.get('retry-after')) || 60
        setCooldown(retryAfter)
        setError(null)
        setInput('')
      } else {
        const data = await res.json().catch(() => ({})) as { captchaRequired?: boolean }
        if (data.captchaRequired) setCaptchaRequired(true)
        setError(data.captchaRequired ? 'Please complete the verification below.' : 'Incorrect passcode. Try again.')
        setAttempts(a => a + 1)
        setInput('')
        // Turnstile tokens are single-use — remount for a fresh one.
        setCaptchaToken('')
        setCaptchaNonce(n => n + 1)
        inputRef.current?.focus()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
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
            disabled={loading || locked}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950/20 focus:border-neutral-400 transition disabled:opacity-50"
          />

          {locked ? (
            <p className="text-xs text-red-600">
              Too many attempts. Try again in {cooldown}s.
            </p>
          ) : error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : null}

          {showCaptcha && !locked && (
            <TurnstileWidget key={captchaNonce} onToken={setCaptchaToken} />
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input || loading || locked || captchaBlocking}
            className="w-full px-4 py-2 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            {locked ? `Locked (${cooldown}s)` : loading ? 'Checking…' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
