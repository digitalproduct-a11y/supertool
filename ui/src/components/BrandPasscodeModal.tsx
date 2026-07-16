import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getBrandLogoUrl, getBrandHex, needsDarkBg } from '../constants/brands'
import type { BrandName } from '../constants/brands'
import { brandToSlug } from '../utils/brandSlug'
import { setBrandUnlocked } from '../utils/brandAuth'
import { TurnstileWidget } from './TurnstileWidget'
import { turnstileEnabled } from '../utils/turnstile'

const CAPTCHA_AFTER = 3

interface BrandPasscodeModalProps {
  brand: BrandName
  onSuccess: () => void
  onClose: () => void
}

export function BrandPasscodeModal({ brand, onSuccess, onClose }: BrandPasscodeModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0) // seconds remaining after a 429
  const [attempts, setAttempts] = useState(0)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaNonce, setCaptchaNonce] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const webhookUrl = (import.meta.env.VITE_BRAND_PASSCODE_WEBHOOK_URL as string | undefined)?.trim()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const locked = cooldown > 0
  const showCaptcha = turnstileEnabled && (attempts >= CAPTCHA_AFTER || captchaRequired)
  const captchaBlocking = showCaptcha && !captchaToken

  const handleSubmit = async () => {
    if (!input.trim() || loading || locked || captchaBlocking) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(webhookUrl ?? '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, passcode: input.trim(), turnstileToken: captchaToken }),
      })
      const data = await res.json().catch(() => ({})) as { success?: boolean; message?: string; retryAfter?: number; captchaRequired?: boolean }
      if (res.status === 429 || data.retryAfter) {
        const retryAfter = data.retryAfter && data.retryAfter > 0
          ? data.retryAfter
          : Number(res.headers.get('retry-after')) || 60
        setCooldown(retryAfter)
        setInput('')
      } else if (data.success) {
        setBrandUnlocked(brandToSlug(brand))
        onSuccess()
      } else {
        if (data.captchaRequired) setCaptchaRequired(true)
        setError(data.captchaRequired ? 'Please complete the verification below.' : (data.message ?? 'Incorrect passcode.'))
        setAttempts(a => a + 1)
        setCaptchaToken('')
        setCaptchaNonce(n => n + 1)
        setInput('')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleSubmit()
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
        aria-labelledby="brand-passcode-title"
        aria-modal="true"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: needsDarkBg(brand) ? getBrandHex(brand) : '#F9FAFB' }}
            >
              <img src={getBrandLogoUrl(brand)} alt={brand} className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h2 id="brand-passcode-title" className="text-base font-semibold text-neutral-950">
                {brand}
              </h2>
              <p className="text-sm text-neutral-500 mt-0.5">Enter passcode to continue</p>
            </div>
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
            <p className="text-xs text-red-600">Too many attempts. Try again in {cooldown}s.</p>
          ) : error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : null}

          {showCaptcha && !locked && (
            <TurnstileWidget resetSignal={captchaNonce} onToken={setCaptchaToken} />
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!input || loading || locked || captchaBlocking}
            className="w-full px-4 py-2 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {locked ? `Locked (${cooldown}s)` : loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                Verifying…
              </>
            ) : 'Continue →'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
