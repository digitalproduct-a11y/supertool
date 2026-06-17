import type { VercelRequest, VercelResponse } from '@vercel/node'
import { extractSessionCookie, verifySession } from '../_lib/jwtSession'
import { verifyAdminToken } from '../_lib/verifyAdminToken'
import { readSnapshot, readSnapshotStatus, type SnapshotType } from '../_lib/kv'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 1. Verify session cookie
  const cookie = extractSessionCookie(req.headers.cookie)
  if (!cookie) return res.status(401).json({ error: 'session_invalid' })
  try {
    await verifySession(cookie)
  } catch {
    return res.status(401).json({ error: 'session_invalid' })
  }

  // 2. Resolve query
  const type = String(req.query.type ?? '')
  if (type === 'meta' || type === 'youtube') {
    const payload = await readSnapshot(type as SnapshotType)
    if (!payload) return res.status(404).json({ error: 'snapshot_not_ready', type })
    res.setHeader('Cache-Control', 'private, max-age=300')
    return res.status(200).json(payload)
  }

  if (type === 'status') {
    // Admin-only — verify the admin HMAC token in X-Admin-Token
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
