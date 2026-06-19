import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyMsalIdToken } from '../../lib/verifyMsalIdToken'
import { signSession, sessionCookieHeader } from '../../lib/jwtSession'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
