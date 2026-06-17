import type { VercelRequest, VercelResponse } from '@vercel/node'
import { extractSessionCookie, verifySession } from '../_lib/jwtSession'
import { verifyAdminToken } from '../_lib/verifyAdminToken'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
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

  // 2. Verify admin token
  const adminSecret = process.env.ADMIN_PASSCODE
  if (!adminSecret) return res.status(500).json({ error: 'Server misconfigured' })
  const adminToken = req.headers['x-admin-token']
  if (typeof adminToken !== 'string' || !verifyAdminToken(adminToken, adminSecret)) {
    return res.status(403).json({ error: 'admin_required' })
  }

  // 3. Trigger n8n producer via its on-demand webhook
  const webhookUrl = process.env.N8N_REFRESH_WEBHOOK_URL
  const webhookToken = process.env.N8N_REFRESH_WEBHOOK_TOKEN
  if (!webhookUrl || !webhookToken) {
    return res.status(500).json({ error: 'Producer webhook not configured' })
  }

  try {
    // Fire-and-forget — n8n workflow takes ~10s; we return 202 immediately.
    void fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'dashboard-refresh-token': webhookToken },
      body: JSON.stringify({ triggered_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => { /* swallow — caller polls status to detect completion */ })

    return res.status(202).json({ ok: true, triggered_at: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'TRIGGER_ERROR'
    return res.status(502).json({ error: 'Failed to trigger producer', detail: msg })
  }
}
