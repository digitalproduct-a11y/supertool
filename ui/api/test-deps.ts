import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SignJWT } from 'jose'
import { createHmac } from 'crypto'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hmac = createHmac('sha256', 'test').update('test').digest('hex')
  const joseType = typeof SignJWT
  return res.status(200).json({ ok: true, hmac, joseType })
}
