/**
 * Shared RSS feed store with promise deduplication.
 *
 * Problem: HomePage and LatestNewsTab both fire the same webhooks. If the user
 * navigates before the first response arrives, LatestNewsTab starts a second
 * identical request. This module ensures only one in-flight request per feed
 * exists at a time. Any component that asks while a fetch is running gets the
 * same promise — no duplicate webhook calls.
 *
 * Cache hierarchy (fastest → slowest):
 *   1. In-flight promise  – reuse if a fetch is already running
 *   2. sessionStorage     – reuse if the tab already fetched this session
 *   3. Webhook call       – last resort; result is stored in both layers above
 */

export interface RssArticle {
  title: string
  url: string
  publishedAt: string
  description: string
  imageUrl?: string
}

export interface BrandFeedData {
  brand: string
  articles: RssArticle[]
  feedErrors: unknown[]
}

const INHOUSE_CACHE_KEY = 'rss_latest_all'
const COMPETITOR_CACHE_KEY = 'rss_competitor_all'

// ── sessionStorage helpers ────────────────────────────────────────────────────

function readSession(key: string): BrandFeedData[] | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as BrandFeedData[]) : null
  } catch {
    return null
  }
}

function writeSession(key: string, data: BrandFeedData[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(data))
  } catch { /* storage quota — skip */ }
}

function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch { /* ignore */ }
}

// ── HTML entity decoding ─────────────────────────────────────────────────────

let _decoderEl: HTMLTextAreaElement | null = null
function decodeHtmlEntities(text: string): string {
  if (!text || (!text.includes('&') && !text.includes('&#'))) return text
  if (!_decoderEl) _decoderEl = document.createElement('textarea')
  _decoderEl.innerHTML = text
  return _decoderEl.value
}

function decodeArticles(data: BrandFeedData[]): BrandFeedData[] {
  for (const brand of data) {
    for (const a of brand.articles) {
      a.title = decodeHtmlEntities(a.title)
      a.description = decodeHtmlEntities(a.description)
    }
  }
  return data
}

// ── In-flight promise registry ────────────────────────────────────────────────

let _inHousePromise: Promise<BrandFeedData[]> | null = null
let _competitorPromise: Promise<BrandFeedData[]> | null = null

// ── Public API ────────────────────────────────────────────────────────────────

export function fetchInHouseFeeds(webhookUrl: string): Promise<BrandFeedData[]> {
  // Return the cached promise if one exists (covers both in-flight AND already-resolved).
  // Never reset to null on success — callers always reuse the same promise.
  if (_inHousePromise) return _inHousePromise

  // Module was re-evaluated (HMR) but sessionStorage still has data — wrap it.
  const cached = readSession(INHOUSE_CACHE_KEY)
  if (cached) {
    _inHousePromise = Promise.resolve(cached)
    return _inHousePromise
  }

  // Fresh network request — only null on error so callers can retry.
  _inHousePromise = fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<BrandFeedData[]>
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error('Unexpected response format')
      decodeArticles(data)
      writeSession(INHOUSE_CACHE_KEY, data)
      return data
    })
    .catch(e => {
      _inHousePromise = null // allow retry after failure
      throw e
    })

  return _inHousePromise
}

export function fetchCompetitorFeeds(webhookUrl: string): Promise<BrandFeedData[]> {
  if (_competitorPromise) return _competitorPromise

  const cached = readSession(COMPETITOR_CACHE_KEY)
  if (cached) {
    _competitorPromise = Promise.resolve(cached)
    return _competitorPromise
  }

  _competitorPromise = fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<BrandFeedData[]>
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error('Unexpected response format')
      decodeArticles(data)
      writeSession(COMPETITOR_CACHE_KEY, data)
      return data
    })
    .catch(e => {
      _competitorPromise = null
      throw e
    })

  return _competitorPromise
}

/** Force a fresh fetch on next call (used by refresh buttons). */
export function clearInHouseCache(): void {
  _inHousePromise = null
  removeSession(INHOUSE_CACHE_KEY)
}

export function clearCompetitorCache(): void {
  _competitorPromise = null
  removeSession(COMPETITOR_CACHE_KEY)
}

export function readInHouseCache(): BrandFeedData[] | null {
  return readSession(INHOUSE_CACHE_KEY)
}

export function readCompetitorCache(): BrandFeedData[] | null {
  return readSession(COMPETITOR_CACHE_KEY)
}
