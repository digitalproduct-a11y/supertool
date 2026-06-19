import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyMsalIdToken } from '../lib/verifyMsalIdToken'

const N8N_HOST = 'astroproduct.app.n8n.cloud'

// Per-webhook tokens + forwarding method. Keyed by path prefix on the n8n host.
// The n8n Webhook node must be configured with Header Auth using the same value.
type WebhookRule = {
  match: (path: string) => boolean
  token: string | undefined
  header: string
  method: 'GET' | 'POST'
}
const WEBHOOK_TOKENS: WebhookRule[] = [
  {
    match: (path) => path.startsWith('/webhook/dashboard') || path.startsWith('/webhook-test/dashboard'),
    token: process.env.DASHBOARD_WEBHOOK_TOKEN,
    header: 'dashboard-webhook-token',
    method: 'GET',
  },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await verifyMsalIdToken(req.headers.authorization)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AUTH_ERROR'
    if (msg === 'FORBIDDEN_DOMAIN') return res.status(403).json({ error: 'Forbidden: not an authorised domain' })
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // --- Forward to n8n ---
  const body = req.body as { n8nUrl?: string; [key: string]: unknown }
  const { n8nUrl, ...workflowPayload } = body

  // Validate target is our n8n instance (prevents SSRF)
  if (!n8nUrl) {
    return res.status(400).json({ error: 'n8nUrl is required' })
  }
  let targetUrl: URL
  try {
    targetUrl = new URL(n8nUrl)
  } catch {
    return res.status(400).json({ error: 'Invalid n8nUrl' })
  }
  if (targetUrl.hostname !== N8N_HOST) {
    return res.status(400).json({ error: 'Target host not allowed' })
  }

  const forwardHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  const tokenRule = WEBHOOK_TOKENS.find((rule) => rule.match(targetUrl.pathname))
  if (tokenRule?.token) {
    forwardHeaders[tokenRule.header] = tokenRule.token
  }
  const forwardMethod: 'GET' | 'POST' = tokenRule?.method ?? 'POST'

  try {
    const n8nRes = await fetch(targetUrl.toString(), {
      method: forwardMethod,
      headers: forwardHeaders,
      body: forwardMethod === 'POST' ? JSON.stringify(workflowPayload) : undefined,
      signal: AbortSignal.timeout(120_000),
    })
    const data = await n8nRes.json()
    return res.status(n8nRes.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Failed to reach n8n workflow' })
  }
}
