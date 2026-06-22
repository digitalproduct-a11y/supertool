import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put } from '@vercel/blob'
import { verifyMsalIdToken } from '../lib/verifyMsalIdToken'

// Uploads a base64 data URL (a rendered Fabric canvas PNG) to Vercel Blob and
// returns a public URL, used by the Election Results tool as the image source
// for Facebook posting. Replaces the Cloudinary upload step used elsewhere.
//
// Auth: same MSAL id_token gate as /api/n8n-proxy — only authenticated Astro
// users can write to the blob store.
//
// Note: the data URL travels in the request body, so it is bound by Vercel's
// ~4.5MB function body limit. 1080×1350 flat-design PNGs compress well below
// this; if larger assets are ever needed, switch to @vercel/blob client uploads.

interface UploadBody {
  dataUrl?: string
  filename?: string
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) return null
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await verifyMsalIdToken(req.headers.authorization)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AUTH_ERROR'
    if (msg === 'FORBIDDEN_DOMAIN') return res.status(403).json({ error: 'Forbidden: not an authorised domain' })
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob storage not configured' })
  }

  const { dataUrl, filename } = (req.body ?? {}) as UploadBody
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl is required' })

  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !parsed.contentType.startsWith('image/')) {
    return res.status(400).json({ error: 'Invalid image data URL' })
  }

  const ext = parsed.contentType.split('/')[1] || 'png'
  const safeName = (filename || 'election').replace(/[^a-z0-9._-]/gi, '-').slice(0, 80)
  const key = `election/${safeName}-${Date.now()}.${ext}`

  try {
    const blob = await put(key, parsed.buffer, {
      access: 'public',
      contentType: parsed.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return res.status(200).json({ url: blob.url })
  } catch {
    return res.status(502).json({ error: 'Upload failed' })
  }
}
