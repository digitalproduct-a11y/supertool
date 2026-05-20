import type { VercelRequest, VercelResponse } from '@vercel/node'

const ZERNIO_BASE = 'https://zernio.com/api'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const rawPath = req.query['path']
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '')
  const query = { ...req.query }
  delete query['path']
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : (v ?? '')])
    )
  ).toString()
  const upstream = `${ZERNIO_BASE}/v1/${path}${qs ? `?${qs}` : ''}`

  const headers: HeadersInit = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  const upstream_res = await fetch(upstream, {
    method: req.method ?? 'GET',
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
  })

  const text = await upstream_res.text()
  res.status(upstream_res.status)
  res.setHeader('Content-Type', upstream_res.headers.get('content-type') ?? 'application/json')
  res.send(text)
}
