import type { VercelRequest, VercelResponse } from '@vercel/node'

// --- MSAL id_token verification (RS256, crypto.subtle) ---
const TENANT_ID = (process.env.AZURE_TENANT_ID ?? process.env.VITE_AZURE_TENANT_ID)!
const CLIENT_ID = (process.env.AZURE_CLIENT_ID ?? process.env.VITE_AZURE_CLIENT_ID)!
const ALLOWED_DOMAIN = process.env.AZURE_ALLOWED_DOMAIN ?? 'astro.com.my'

interface Jwk { kty: string; kid?: string; n?: string; e?: string }
let cachedJwks: Jwk[] | null = null
let cacheTime = 0

async function fetchJwks(): Promise<Jwk[]> {
  if (cachedJwks && Date.now() - cacheTime < 3_600_000) return cachedJwks
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)
  if (!r.ok) throw new Error('JWKS_FETCH_FAILED')
  const { keys } = await r.json() as { keys: Jwk[] }
  cachedJwks = keys
  cacheTime = Date.now()
  return keys
}

async function verifyMsalIdToken(authHeader: string | undefined): Promise<void> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) throw new Error('UNAUTHORIZED')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('UNAUTHORIZED')
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { alg: string; kid?: string }
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<string, unknown>
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && payload.exp < now) throw new Error('TOKEN_EXPIRED')
  if (payload.aud !== CLIENT_ID) throw new Error('UNAUTHORIZED')
  if (payload.iss !== `https://login.microsoftonline.com/${TENANT_ID}/v2.0`) throw new Error('UNAUTHORIZED')
  const jwks = await fetchJwks()
  const jwk = jwks.find(k => k.kid === header.kid)
  if (!jwk?.n || !jwk?.e) throw new Error('UNAUTHORIZED')
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true } as JsonWebKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const valid = await globalThis.crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    Buffer.from(parts[2], 'base64url'),
    Buffer.from(`${parts[0]}.${parts[1]}`),
  )
  if (!valid) throw new Error('UNAUTHORIZED')
  const email = (payload.preferred_username as string) ?? ''
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) throw new Error('FORBIDDEN_DOMAIN')
}

// --- Per-webhook token rules ---
const N8N_HOST = 'astroproduct.app.n8n.cloud'

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
  {
    // ImageKit signed-upload auth. The injected header lets the n8n workflow confirm the
    // call arrived through this MSAL-verified proxy and reject direct-to-n8n requests.
    match: (path) => path.startsWith('/webhook/imagekit-sign') || path.startsWith('/webhook-test/imagekit-sign'),
    token: process.env.IMAGEKIT_SIGN_WEBHOOK_TOKEN,
    header: 'imagekit-sign-token',
    method: 'POST',
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

  const body = req.body as { n8nUrl?: string; [key: string]: unknown }
  const { n8nUrl, ...workflowPayload } = body

  if (!n8nUrl) return res.status(400).json({ error: 'n8nUrl is required' })
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
  if (tokenRule?.token) forwardHeaders[tokenRule.header] = tokenRule.token
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
