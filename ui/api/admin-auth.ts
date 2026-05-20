import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'crypto'

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

function generateToken(secret: string): string {
  const expiresAt = String(Date.now() + TOKEN_TTL_MS)
  const sig = createHmac('sha256', secret).update(expiresAt).digest('hex')
  return `${expiresAt}.${sig}`
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.ADMIN_PASSCODE
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const passcode = (req.body as { passcode?: string })?.passcode ?? ''
  if (!passcode) {
    return res.status(400).json({ error: 'Passcode required' })
  }

  // Timing-safe comparison prevents brute-force timing attacks
  let match = false
  try {
    const a = Buffer.from(passcode)
    const b = Buffer.from(secret)
    match = a.length === b.length && timingSafeEqual(a, b)
  } catch {
    match = false
  }

  if (!match) {
    return res.status(401).json({ error: 'Incorrect passcode' })
  }

  return res.status(200).json({ token: generateToken(secret) })
}
