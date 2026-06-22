import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'crypto'

// --- JWT session (HS256, Node crypto) ---
const COOKIE_NAME = 'astro_session'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

function b64url(input: string | Buffer): string {
  return (typeof input === 'string' ? Buffer.from(input) : input).toString('base64url')
}

function getSecret(): string {
  const raw = process.env.SESSION_JWT_SECRET
  if (!raw) throw new Error('SESSION_JWT_SECRET not configured')
  return raw
}

async function signSession(claims: { sub: string }): Promise<string> {
  const secret = getSecret()
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const p = b64url(JSON.stringify({ sub: claims.sub, iat: now, exp: now + SESSION_TTL_SECONDS }))
  const sig = b64url(createHmac('sha256', secret).update(`${h}.${p}`).digest())
  return `${h}.${p}.${sig}`
}

function sessionCookieHeader(jwt: string): string {
  return [
    `${COOKIE_NAME}=${jwt}`,
    'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ')
}

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

async function verifyMsalIdToken(authHeader: string | undefined): Promise<{ email: string }> {
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
  return { email }
}

// --- Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET — check whether the existing session cookie is still valid
  if (req.method === 'GET') {
    const cookie = extractSessionCookie(req.headers.cookie)
    if (!cookie) return res.status(401).json({ error: 'no_session' })
    try {
      await verifySession(cookie)
      return res.status(200).json({ ok: true })
    } catch {
      return res.status(401).json({ error: 'session_invalid' })
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let email: string
  try {
    const verified = await verifyMsalIdToken(req.headers.authorization)
    email = verified.email
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AUTH_ERROR'
    if (msg === 'FORBIDDEN_DOMAIN') return res.status(403).json({ error: 'Forbidden: not an authorised domain' })
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let jwt: string
  try {
    jwt = await signSession({ sub: email })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SIGN_ERROR'
    return res.status(500).json({ error: 'Server misconfigured', detail: msg })
  }

  res.setHeader('Set-Cookie', sessionCookieHeader(jwt))
  return res.status(200).json({ ok: true, email })
}
