import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'crypto'
import { kv } from '@vercel/kv'
import LZString from 'lz-string'

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
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000

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

// silence unused-var warning — TOKEN_TTL_MS used only in admin-auth.ts (peer file)
void TOKEN_TTL_MS

// --- KV snapshot reads ---
type SnapshotType = 'meta' | 'youtube'

function snapshotKey(type: SnapshotType): string {
  return `dashboard:${type}:current`
}

interface SnapshotStatus {
  last_run_at: string
  last_meta_rows: number
  last_youtube_rows: number
  last_status: 'ok' | 'failed'
  last_error?: string
}

async function readSnapshot<T>(type: SnapshotType): Promise<T | null> {
  const compressed = await kv.get<string>(snapshotKey(type))
  if (!compressed) return null
  const json = LZString.decompressFromUTF16(compressed)
  if (!json) return null
  try { return JSON.parse(json) as T } catch { return null }
}

async function readSnapshotStatus(): Promise<SnapshotStatus | null> {
  return (await kv.get<SnapshotStatus>('dashboard:status')) ?? null
}

// --- Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cookie = extractSessionCookie(req.headers.cookie)
  if (!cookie) return res.status(401).json({ error: 'session_invalid' })
  try {
    await verifySession(cookie)
  } catch {
    return res.status(401).json({ error: 'session_invalid' })
  }

  const type = String(req.query.type ?? '')

  if (type === 'meta' || type === 'youtube') {
    const payload = await readSnapshot(type as SnapshotType)
    if (!payload) return res.status(404).json({ error: 'snapshot_not_ready', type })
    res.setHeader('Cache-Control', 'private, max-age=300')
    return res.status(200).json(payload)
  }

  if (type === 'status') {
    const adminSecret = process.env.ADMIN_PASSCODE
    if (!adminSecret) return res.status(500).json({ error: 'Server misconfigured' })
    const adminToken = req.headers['x-admin-token']
    if (typeof adminToken !== 'string' || !verifyAdminToken(adminToken, adminSecret)) {
      return res.status(403).json({ error: 'admin_required' })
    }
    const status = await readSnapshotStatus()
    if (!status) return res.status(404).json({ error: 'snapshot_not_ready', type })
    return res.status(200).json(status)
  }

  return res.status(400).json({ error: 'invalid_type' })
}
