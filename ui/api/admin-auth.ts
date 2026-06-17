import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'crypto'
import { generateAdminToken } from './_lib/verifyAdminToken'

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

  return res.status(200).json({ token: generateAdminToken(secret) })
}
