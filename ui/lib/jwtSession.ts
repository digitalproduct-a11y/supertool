import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const COOKIE_NAME = 'astro_session'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_JWT_SECRET
  if (!raw) throw new Error('SESSION_JWT_SECRET not configured')
  return new TextEncoder().encode(raw)
}

export interface SessionClaims extends JWTPayload {
  sub: string  // user email
}

export async function signSession(claims: { sub: string }): Promise<string> {
  return await new SignJWT({ sub: claims.sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
  return payload as SessionClaims
}

export function sessionCookieHeader(jwt: string): string {
  return [
    `${COOKIE_NAME}=${jwt}`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Path=/`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ')
}

export function extractSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}
