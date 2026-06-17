import { createHmac, timingSafeEqual } from 'crypto'

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

export function generateAdminToken(secret: string): string {
  const expiresAt = String(Date.now() + TOKEN_TTL_MS)
  const sig = createHmac('sha256', secret).update(expiresAt).digest('hex')
  return `${expiresAt}.${sig}`
}

// Returns true when the token has a valid signature and has not yet expired.
export function verifyAdminToken(token: string | undefined, secret: string): boolean {
  if (!token) return false
  const [expiresAtRaw, sig] = token.split('.')
  if (!expiresAtRaw || !sig) return false

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

  const expected = createHmac('sha256', secret).update(expiresAtRaw).digest('hex')

  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
