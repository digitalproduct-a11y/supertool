import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac } from 'crypto'
import { signSession } from '../lib/jwtSession'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hmac = createHmac('sha256', 'test').update('test').digest('hex')
  let libImportOk = false
  let detail = ''
  try {
    // signSession will throw 'SESSION_JWT_SECRET not configured' if env missing,
    // but if it throws THAT error the import itself worked
    await signSession({ sub: 'probe@test.com' })
    libImportOk = true
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err)
    libImportOk = detail === 'SESSION_JWT_SECRET not configured'
  }
  return res.status(200).json({ ok: true, hmac, libImportOk, detail })
}
