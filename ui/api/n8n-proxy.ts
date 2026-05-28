import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const TENANT_ID = process.env.AZURE_TENANT_ID!
const CLIENT_ID = process.env.AZURE_CLIENT_ID!
const ALLOWED_DOMAIN = process.env.AZURE_ALLOWED_DOMAIN ?? 'astro.com.my'
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

// Lazily initialised so the module loads even if env vars are set after cold start
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)
    )
  }
  return jwks
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Token validation ---
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
      audience: CLIENT_ID,
    })
    const email = (payload.preferred_username as string) ?? ''
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.status(403).json({ error: 'Forbidden: not an authorised domain' })
    }
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
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
