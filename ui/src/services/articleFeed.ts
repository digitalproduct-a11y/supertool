// Astro data-feed API client (staging).
// Used by the CMS post-generation simulation + redirect target pages.
// CORS is open on these endpoints, so the browser calls them directly.

const FEED_BASE = 'https://de-data-feed-stg.eco.astro.com.my/v1'

// Maps a feed `site` to the public domain used to build an article's canonical URL.
// Extend alongside SITE_TO_BRAND in constants/brands.ts when more sites are supported.
const SITE_TO_DOMAIN: Record<string, string> = {
  awani: 'https://www.astroawani.com',
}

export interface FeedItem {
  site: string
  id: number
  title: string
  imageUrl: string
  description: string
  type: string
  category: { id: number; name: string }[]
  publishDate: string
  language: string
  urlSlug: string
  authors: { id: number; fullName: string; imgAuthor?: string }[]
}

export interface CmsArticle {
  id: number
  title: string
  summary: string
  body: string
  bodyParagraph: { type: string; text: string }[]
  imageUrl: string
  imageCaption: string | null
  urlSlug: string
  language: string
  category: { id: number; name: string }[]
  authors: { id: number; fullName: string }[]
}

interface FeedEnvelope<T> {
  responseCode: number
  responseMessage: string
  response: T
}

/** Strip inline HTML tags and non-breaking spaces from feed body text. */
export function cleanBody(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Build the public article URL from a feed `site` + `urlSlug`. */
export function buildArticleUrl(site: string, urlSlug: string): string {
  const domain = SITE_TO_DOMAIN[site] ?? SITE_TO_DOMAIN.awani
  return `${domain}${urlSlug}`
}

export async function fetchArticleFeed(
  site = 'awani',
  language = 'ms',
  pageNumber = 1,
  pageSize = 10,
): Promise<FeedItem[]> {
  const params = new URLSearchParams({
    site,
    language,
    platform: 'dm',
    type: 'article',
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  })
  const res = await fetch(`${FEED_BASE}/feed?${params.toString()}`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Feed request failed: HTTP ${res.status}`)
  const json = (await res.json()) as FeedEnvelope<FeedItem[]>
  return json.response ?? []
}

export async function fetchArticle(id: number | string, site = 'awani'): Promise<CmsArticle> {
  const params = new URLSearchParams({ site, field: 'body, platform' })
  const res = await fetch(`${FEED_BASE}/article/${id}?${params.toString()}`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Article request failed: HTTP ${res.status}`)
  const json = (await res.json()) as FeedEnvelope<CmsArticle>
  if (!json.response) throw new Error('Article not found')
  return json.response
}
