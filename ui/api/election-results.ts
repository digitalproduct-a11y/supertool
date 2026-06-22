import type { VercelRequest, VercelResponse } from '@vercel/node'

// Server-side proxy for the live state-assembly results feed.
// The upstream feed (data.pru.astroawani.com) locks CORS to pru.astroawani.com,
// so the browser cannot fetch it directly — this same-origin route fetches it
// server-side and returns the JSON. The upstream host is hardcoded (no
// user-supplied URL) so this cannot be abused as an open proxy.

const FEED_HOST = 'data.pru.astroawani.com'
const DEFAULT_SEASON = '16'

function buildFeedUrl(season: string): string {
  return `https://${FEED_HOST}/data/${season}/result_state_assembly.json`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Only digits — season ids are numeric; reject anything else.
  const rawSeason = Array.isArray(req.query.season) ? req.query.season[0] : req.query.season
  const season = rawSeason && /^\d+$/.test(rawSeason) ? rawSeason : DEFAULT_SEASON

  try {
    const upstream = await fetch(`${buildFeedUrl(season)}?bust=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!upstream.ok) {
      return res.status(502).json({ error: `Feed responded ${upstream.status}` })
    }
    const data = await upstream.json()
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    return res.status(200).json(data)
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'TimeoutError'
    return res.status(aborted ? 504 : 502).json({ error: 'Failed to reach results feed' })
  }
}
