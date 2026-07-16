import { useEffect, useRef } from 'react'
import { TURNSTILE_SITE_KEY as SITE_KEY } from '../utils/turnstile'

// Cloudflare Turnstile widget (explicit render). Loads the script once, renders
// into a div, and reports the token back via onToken. Shown only after repeated
// failed attempts, as an anti-automation layer on the passcode gates.

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileAPI {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileAPI
    __turnstileLoading?: Promise<void>
  }
}

/** Load the Turnstile script exactly once across the app. */
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (window.__turnstileLoading) return window.__turnstileLoading
  window.__turnstileLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(s)
  })
  return window.__turnstileLoading
}

interface TurnstileWidgetProps {
  /** Called with the token on success, or '' when it expires/errors. */
  onToken: (token: string) => void
}

/** Returns null (renders nothing) when no site key is configured. */
export function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => { /* script blocked — leave gate on rate-limit only */ })
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* ignore */ }
      }
    }
    // onToken is stable enough for this one-shot render; deliberately run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!SITE_KEY) return null
  return <div ref={ref} className="flex justify-center" />
}
