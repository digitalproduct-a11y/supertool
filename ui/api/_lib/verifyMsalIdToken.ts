import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

const TENANT_ID = (process.env.AZURE_TENANT_ID ?? process.env.VITE_AZURE_TENANT_ID)!
const CLIENT_ID = (process.env.AZURE_CLIENT_ID ?? process.env.VITE_AZURE_CLIENT_ID)!
const ALLOWED_DOMAIN = process.env.AZURE_ALLOWED_DOMAIN ?? 'astro.com.my'

// Lazily initialised so the module loads even if env vars are set after cold start.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)
    )
  }
  return jwks
}

export interface VerifiedMsalClaims {
  email: string
  payload: JWTPayload
}

export async function verifyMsalIdToken(authorizationHeader: string | undefined): Promise<VerifiedMsalClaims> {
  const token = authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.slice(7) : ''
  if (!token) throw new Error('UNAUTHORIZED')

  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    audience: CLIENT_ID,
  })

  const email = (payload.preferred_username as string) ?? ''
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    throw new Error('FORBIDDEN_DOMAIN')
  }

  return { email, payload }
}
