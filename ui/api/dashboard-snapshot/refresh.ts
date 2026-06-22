import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'crypto'

// --- JWT session verification (HS256, Node crypto) ---
const COOKIE_NAME = 'astro_session'

function extractSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}

async function verifySession(token: string): Promise<void> {
  const secret = process.env.SESSION_JWT_SECRET
  if (!secret) throw new Error('SESSION_JWT_SECRET not configured')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  const [h, p, sig] = parts
  const expected = Buffer.from(createHmac('sha256', secret).update(`${h}.${p}`).digest()).toString('base64url')
  const a = Buffer.from(sig, 'base64url')
  const b = Buffer.from(expected, 'base64url')
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid signature')
  const data = JSON.parse(Buffer.from(p, 'base64url').toString()) as { exp: number }
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired')
}

// --- Admin token verification (HMAC, Node crypto) ---
function verifyAdminToken(token: string | undefined, secret: string): boolean {
  if (!token) return false
  const [expiresAtRaw, sig] = token.split('.')
  if (!expiresAtRaw || !sig) return false
  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false
  const expected = createHmac('sha256', secret).update(expiresAtRaw).digest('hex')
  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// --- Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cookie = extractSessionCookie(req.headers.cookie)
  if (!cookie) return res.status(401).json({ error: 'session_invalid' })
  try {
    await verifySession(cookie)
  } catch {
    return res.status(401).json({ error: 'session_invalid' })
  }

  const adminSecret = process.env.ADMIN_PASSCODE
  if (!adminSecret) return res.status(500).json({ error: 'Server misconfigured' })
  const adminToken = req.headers['x-admin-token']
  if (typeof adminToken !== 'string' || !verifyAdminToken(adminToken, adminSecret)) {
    return res.status(403).json({ error: 'admin_required' })
  }

  const webhookUrl = process.env.N8N_REFRESH_WEBHOOK_URL
  const webhookToken = process.env.N8N_REFRESH_WEBHOOK_TOKEN
  if (!webhookUrl || !webhookToken) {
    return res.status(500).json({ error: 'Producer webhook not configured' })
  }

  try {
    void fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'dashboard-refresh-token': webhookToken },
      body: JSON.stringify({ triggered_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => { /* swallow — caller polls status */ })

    return res.status(202).json({ ok: true, triggered_at: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'TRIGGER_ERROR'
    return res.status(502).json({ error: 'Failed to trigger producer', detail: msg })
  }
}
