import { createHmac, timingSafeEqual } from 'crypto'

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

export interface SessionClaims { sub: string }

export async function signSession(claims: { sub: string }): Promise<string> {
  const secret = getSecret()
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const p = b64url(JSON.stringify({ sub: claims.sub, iat: now, exp: now + SESSION_TTL_SECONDS }))
  const sig = b64url(createHmac('sha256', secret).update(`${h}.${p}`).digest())
  return `${h}.${p}.${sig}`
}

export async function verifySession(token: string): Promise<SessionClaims> {
  const secret = getSecret()
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  const [h, p, sig] = parts
  const expected = b64url(createHmac('sha256', secret).update(`${h}.${p}`).digest())
  const a = Buffer.from(sig, 'base64url')
  const b = Buffer.from(expected, 'base64url')
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid signature')
  const data = JSON.parse(Buffer.from(p, 'base64url').toString()) as { sub: string; exp: number }
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired')
  return { sub: data.sub }
}

export function sessionCookieHeader(jwt: string): string {
  return [
    `${COOKIE_NAME}=${jwt}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ')
}

export function extractSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}
