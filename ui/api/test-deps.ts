import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac } from 'crypto'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hmac = createHmac('sha256', 'test').update('test').digest('hex')
  return res.status(200).json({ ok: true, hmac })
}
