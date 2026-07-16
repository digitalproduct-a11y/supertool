import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'crypto'
import { kv } from '@vercel/kv'

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000

// --- Rate limiting / brute-force lockout (KV-backed, keyed on client IP) ---
// Inlined rather than shared because Vercel builds every api/**/*.ts as its own
// function; a helper module under api/ would fail the build (no default export).
const BUCKET = 'admin-auth'
const RATE_LIMIT = 5 // max requests per IP...
const RATE_WINDOW_SEC = 60 // ...per this window, regardless of correctness
const FAIL_THRESHOLD = 5 // lock after this many wrong passcodes in the window
const CAPTCHA_THRESHOLD = 3 // require Turnstile after this many wrong passcodes
const FAIL_WINDOW_SEC = 15 * 60
const BASE_LOCK_SEC = 60 // first lockout; doubles each subsequent lock (exp. backoff)
const MAX_LOCK_LEVEL = 6 // cap escalation at BASE * 2^6 (~64 min)
const LOCK_LEVEL_TTL_SEC = 24 * 60 * 60

function clientIp(req: VercelRequest): string {
  const cf = req.headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf.trim()) return cf.trim()
  const xff = req.headers['x-forwarded-for']
  const xffStr = Array.isArray(xff) ? xff[0] : xff
  if (typeof xffStr === 'string' && xffStr.trim()) return xffStr.split(',')[0].trim()
  const xr = req.headers['x-real-ip']
  if (typeof xr === 'string' && xr.trim()) return xr.trim()
  return 'unknown'
}

/** Seconds left on an active lockout, or 0 if not locked. */
async function lockRemaining(ip: string): Promise<number> {
  const ttl = await kv.ttl(`lock:${BUCKET}:${ip}`)
  return ttl > 0 ? ttl : 0
}

/** Coarse fixed-window request cap. Returns seconds to wait if exceeded, else 0. */
async function rateExceeded(ip: string): Promise<number> {
  const key = `rl:${BUCKET}:${ip}`
  const count = await kv.incr(key)
  if (count === 1) await kv.expire(key, RATE_WINDOW_SEC)
  if (count > RATE_LIMIT) {
    const ttl = await kv.ttl(key)
    return ttl > 0 ? ttl : RATE_WINDOW_SEC
  }
  return 0
}

/** Record a wrong passcode; escalate to a lockout once the threshold is crossed. */
async function recordFailure(ip: string): Promise<number> {
  const failKey = `fail:${BUCKET}:${ip}`
  const fails = await kv.incr(failKey)
  if (fails === 1) await kv.expire(failKey, FAIL_WINDOW_SEC)
  if (fails < FAIL_THRESHOLD) return 0

  const level = await kv.incr(`locklvl:${BUCKET}:${ip}`)
  await kv.expire(`locklvl:${BUCKET}:${ip}`, LOCK_LEVEL_TTL_SEC)
  const lockSec = BASE_LOCK_SEC * Math.pow(2, Math.min(level - 1, MAX_LOCK_LEVEL))
  await kv.set(`lock:${BUCKET}:${ip}`, 1, { ex: lockSec })
  await kv.del(failKey)
  return lockSec
}

async function clearFailures(ip: string): Promise<void> {
  await kv.del(`fail:${BUCKET}:${ip}`, `lock:${BUCKET}:${ip}`, `locklvl:${BUCKET}:${ip}`)
}

async function currentFails(ip: string): Promise<number> {
  return (await kv.get<number>(`fail:${BUCKET}:${ip}`)) ?? 0
}

/** Verify a Cloudflare Turnstile token. Skips (returns true) if not configured. */
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip && ip !== 'unknown') body.append('remoteip', ip)
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await r.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

function tooMany(res: VercelResponse, retryAfter: number, error: string) {
  res.setHeader('Retry-After', String(retryAfter))
  return res.status(429).json({ error, retryAfter })
}

function generateAdminToken(secret: string): string {
  const expiresAt = String(Date.now() + TOKEN_TTL_MS)
  const sig = createHmac('sha256', secret).update(expiresAt).digest('hex')
  return `${expiresAt}.${sig}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.ADMIN_PASSCODE
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const ip = clientIp(req)

  // Guard rails. If KV is unavailable we fail OPEN (log + continue) so an
  // infra outage can't lock every admin out — Cloudflare rate limiting is the
  // edge backstop for that case.
  try {
    const locked = await lockRemaining(ip)
    if (locked > 0) {
      return tooMany(res, locked, 'Too many failed attempts. Try again later.')
    }
    const wait = await rateExceeded(ip)
    if (wait > 0) {
      return tooMany(res, wait, 'Too many attempts. Please slow down.')
    }
  } catch (err) {
    console.error('[admin-auth] rate limiter unavailable, allowing request:', err)
  }

  const passcode = (req.body as { passcode?: string })?.passcode ?? ''
  if (!passcode) {
    return res.status(400).json({ error: 'Passcode required' })
  }

  // After repeated failures, require a valid CAPTCHA before checking the passcode.
  if (process.env.TURNSTILE_SECRET_KEY) {
    try {
      if ((await currentFails(ip)) >= CAPTCHA_THRESHOLD) {
        const token = (req.body as { turnstileToken?: string })?.turnstileToken ?? ''
        if (!(await verifyTurnstile(token, ip))) {
          return res.status(401).json({ error: 'Please complete the verification.', captchaRequired: true })
        }
      }
    } catch (err) {
      console.error('[admin-auth] captcha check failed:', err)
    }
  }

  let match = false
  try {
    const a = Buffer.from(passcode)
    const b = Buffer.from(secret)
    match = a.length === b.length && timingSafeEqual(a, b)
  } catch {
    match = false
  }

  if (!match) {
    try {
      const lockSec = await recordFailure(ip)
      if (lockSec > 0) {
        return tooMany(res, lockSec, 'Too many failed attempts. Locked temporarily.')
      }
    } catch (err) {
      console.error('[admin-auth] failed to record attempt:', err)
    }
    return res.status(401).json({ error: 'Incorrect passcode' })
  }

  try {
    await clearFailures(ip)
  } catch (err) {
    console.error('[admin-auth] failed to clear attempts:', err)
  }
  return res.status(200).json({ token: generateAdminToken(secret) })
}
