import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getBrandLogoUrl, getBrandHex, needsDarkBg } from '../constants/brands'
import type { BrandName } from '../constants/brands'
import { brandToSlug } from '../utils/brandSlug'
import { setBrandUnlocked } from '../utils/brandAuth'

interface BrandPasscodeModalProps {
  brand: BrandName
  onSuccess: () => void
  onClose: () => void
}

export function BrandPasscodeModal({ brand, onSuccess, onClose }: BrandPasscodeModalProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const webhookUrl = (import.meta.env.VITE_BRAND_PASSCODE_WEBHOOK_URL as string | undefined)?.trim()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(webhookUrl ?? '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, passcode: input.trim() }),
      })
      const data = await res.json() as { success?: boolean; message?: string }
      if (data.success) {
        setBrandUnlocked(brandToSlug(brand))
        onSuccess()
      } else {
        setError(data.message ?? 'Incorrect passcode.')
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
            disabled={loading}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950/20 focus:border-neutral-400 transition disabled:opacity-50"
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!input || loading}
            className="w-full px-4 py-2 text-sm bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
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
