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

export interface VerifiedMsalClaims {
  email: string
  payload: Record<string, unknown>
}

export async function verifyMsalIdToken(authHeader: string | undefined): Promise<VerifiedMsalClaims> {
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

  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`)
  const signature = Buffer.from(parts[2], 'base64url')
  const valid = await globalThis.crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signingInput)
  if (!valid) throw new Error('UNAUTHORIZED')

  const email = (payload.preferred_username as string) ?? ''
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) throw new Error('FORBIDDEN_DOMAIN')

  return { email, payload }
}
