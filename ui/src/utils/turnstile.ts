// Cloudflare Turnstile config. Kept separate from the widget component so
// non-component exports don't trip the react-refresh lint rule.

export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim()

/** Whether CAPTCHA is configured for this build. */
export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY)
