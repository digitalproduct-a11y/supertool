// CMS post-generation: content-based variants of the Article-to-Social generators.
// Instead of scraping a live URL, these send the article body/title/image already
// fetched from the data feed to a single n8n workflow that switches on `postType`.
// Response shapes are identical to the existing per-type generators in
// ArticleToSocialPage so the same ResultCard rendering works unchanged.

import type { QuickFactItem, QuickFactData } from '../types'
import type { QuoteData } from '../features/quote/QuoteCanvas'

export type CmsPostType = 'photo' | 'quickfact' | 'quote'

export interface CmsGenInput {
  url: string
  brand: string
  title: string
  body: string
  imageUrl: string
  summary?: string
  category?: string
  template: string
  // Quick Fact only: 'carousel' = new multi-slide Fabric carousel (default),
  // 'single' = legacy single composite image. Ignored by photo/quote.
  quickFactTemplate?: 'carousel' | 'single'
  language: string
}

const CMS_TIMEOUT_MS = 180_000

// Each post type now calls its dedicated engine webhook directly (the old unified
// `cms-article-to-post` router is retired). The engines are dual-mode: `articleAPI: true`
// tells them to use the pre-fetched article we send instead of scraping the URL.
const WEBHOOK_BY_TYPE: Record<CmsPostType, { url: string | undefined; envVar: string }> = {
  photo: { url: import.meta.env.VITE_GENERATE_WEBHOOK_URL as string | undefined, envVar: 'VITE_GENERATE_WEBHOOK_URL' },
  quickfact: { url: import.meta.env.VITE_QUICK_FACT_WEBHOOK_URL as string | undefined, envVar: 'VITE_QUICK_FACT_WEBHOOK_URL' },
  quote: { url: import.meta.env.VITE_QUOTE_WEBHOOK_URL as string | undefined, envVar: 'VITE_QUOTE_WEBHOOK_URL' },
}

async function callCmsWebhook(
  input: CmsGenInput,
  postType: CmsPostType,
): Promise<Record<string, unknown>> {
  const { url, envVar } = WEBHOOK_BY_TYPE[postType]
  const webhookUrl = url?.trim()
  if (!webhookUrl) throw new Error(`${postType} webhook not configured (${envVar})`)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CMS_TIMEOUT_MS)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `articleAPI: true` → engines skip scraping and use the fields below.
      // `caption_title_mode: 'ai'` preserves the old router's behaviour.
      body: JSON.stringify({ ...input, articleAPI: true, caption_title_mode: 'ai', postType }),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const errData = JSON.parse(text) as Record<string, unknown>
        if (errData?.error === 'no_quote_found') message = 'No quote found for this article'
        else if (typeof errData?.message === 'string') message = errData.message as string
      } catch { /* non-JSON body — keep HTTP status */ }
      throw new Error(message)
    }
    if (!text.trim()) throw new Error('Empty response from server — the CMS workflow may have errored. Check n8n executions.')
    const data = JSON.parse(text) as Record<string, unknown>
    if (data.success === false) throw new Error((data.message as string) ?? 'Generation failed')
    if (data.error === 'no_quote_found') throw new Error('No quote found for this article')
    return data
  } finally {
    clearTimeout(timeout)
  }
}

export async function generatePhotoFromCms(
  input: CmsGenInput,
): Promise<{ imageUrl: string; caption: string; photoTitle: string; cloudinaryUrl?: string }> {
  const data = await callCmsWebhook(input, 'photo')
  return {
    imageUrl: (data.imageUrl as string) ?? '',
    caption: (data.caption as string) ?? '',
    photoTitle: (data.title as string) ?? '',
    cloudinaryUrl: (data.cloudinary_url as string | undefined),
  }
}

// Quick Fact is now a client-rendered Fabric carousel: n8n returns DATA only
// (facts + brand passthrough + a CORS-safe hero), and the browser composes the
// cover + per-fact slides. Returns the structured QuickFactData (see types.ts).
export async function generateQuickFactFromCms(
  input: CmsGenInput,
): Promise<QuickFactData> {
  const data = await callCmsWebhook(input, 'quickfact')
  return {
    // Title follows the brand rule applied server-side (Astro Awani → article title,
    // all other brands → AI-generated), returned as data.title.
    title: (data.title as string) || input.title || '',
    sectionLabel: (data.sectionLabel as string) ?? '',
    keyPhrase: (data.keyPhrase as string) ?? '',
    caption: (data.caption as string) ?? '',
    summary: (data.summary as string) ?? input.summary ?? '',
    facts: (data.facts as QuickFactItem[]) ?? [],
    heroPublicId: (data.heroPublicId as string) ?? '',
    heroUrl: (data.heroUrl as string) ?? '',
    brand: (data.brand as string) ?? input.brand,
    brandHex: (data.brandHex as string) ?? '',
    logoPublicId: (data.logoPublicId as string) ?? '',
    fontUse: (data.fontUse as string) ?? '',
    category: (data.category as string) ?? '',
    language: (data.language as string) ?? input.language,
  }
}

// Legacy single-image Quick Fact, generated through the CMS webhook (body-based)
// when the editor picks the "Single Image" template. The CMS workflow branches on
// `quickFactTemplate: 'single'` and returns the same composite-image shape as the
// standalone /quick-fact tool, so QuickFactSingleViewLegacy renders it unchanged.
export interface CmsQuickFactSingle {
  imageUrl: string
  caption: string
  title: string
  facts: QuickFactItem[]
  keyPhrase: string
  cloudinaryUrl?: string
}

export async function generateQuickFactSingleFromCms(
  input: CmsGenInput,
): Promise<CmsQuickFactSingle> {
  const data = await callCmsWebhook(input, 'quickfact')
  return {
    imageUrl: (data.imageUrl as string) ?? '',
    caption: (data.caption as string) ?? '',
    title: (data.title as string) ?? '',
    facts: (data.facts as QuickFactItem[]) ?? [],
    keyPhrase: (data.keyPhrase as string) ?? '',
    cloudinaryUrl: (data.cloudinary_url as string | undefined),
  }
}

export async function generateQuoteFromCms(
  input: CmsGenInput,
): Promise<{ imageUrl: string; caption: string; quoteData: QuoteData; quotePexelsUrls: string[]; quoteFontUse?: string }> {
  const data = await callCmsWebhook(input, 'quote')
  const pexelsUrls = (data.pexels_image_urls as string[] | undefined) ??
    [data.pexels_image_left_url, data.pexels_image_right_url].filter(Boolean) as string[]
  return {
    imageUrl: (data.image_url as string) || pexelsUrls[0] || '',
    caption: (data.fb_caption as string) ?? '',
    quoteData: {
      quote_text: (data.quote_text as string) ?? '',
      quote_punch: (data.quote_punch as string) ?? '',
      quote_author: (data.quote_author as string) ?? '',
      quote_author_title: (data.quote_author_title as string | undefined),
    },
    quotePexelsUrls: pexelsUrls,
    quoteFontUse: (data.font_use as string | undefined),
  }
}
