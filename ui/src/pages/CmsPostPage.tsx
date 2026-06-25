// CMS post-generation redirect target (standalone, not in sidebar).
//
// Drupal redirects editors here after they publish an article and pick post
// type(s) + a photo template. Reads everything from the URL query string, fetches
// the article from the data feed, generates the selected posts via the CMS webhook,
// and renders the SAME editable post cards as Article-to-Social.
//
// Example: /cms/post?site=awani&id=243169&types=photo,quickfact,quote&template=awani_v1

import { useEffect, useRef, useState } from 'react'
import { logHistoryEvent } from '../services/historyLog'
import { useSearchParams } from 'react-router-dom'
import { brandFromSite } from '../constants/brands'
import {
  fetchArticle,
  buildArticleUrl,
  cleanBody,
  type CmsArticle,
} from '../services/articleFeed'
import {
  generatePhotoFromCms,
  generateQuickFactFromCms,
  generateQuoteFromCms,
  type CmsGenInput,
  type CmsPostType,
} from '../services/postGeneration'
import {
  PhotoSingleView,
  QuickFactSingleView,
  QuoteSingleView,
  BulkResultCard,
  Spin,
  POST_TYPE_LABELS,
  type PostType,
  type ResultCard,
} from './ArticleToSocialPage'

const CMS_TYPES: CmsPostType[] = ['photo', 'quickfact', 'quote']

function parseTypes(raw: string | null): CmsPostType[] {
  if (!raw) return ['photo']
  const wanted = raw.split(',').map(s => s.trim().toLowerCase())
  const valid = CMS_TYPES.filter(t => wanted.includes(t))
  return valid.length ? valid : ['photo']
}

function getScheduledSlots(count: number): string[] {
  const base = new Date(Date.now() + 30 * 60 * 1000)
  base.setSeconds(0, 0)
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(base.getTime() + i * 30 * 60 * 1000)
    return t.toISOString().slice(0, 16)
  })
}

export function CmsPostPage() {
  const [params] = useSearchParams()
  const site = (params.get('site') ?? 'awani').toLowerCase()
  const id = params.get('id') ?? ''
  const template = params.get('template') ?? 'awani_v1'
  const types = parseTypes(params.get('types'))

  const brand = brandFromSite(site)

  const [article, setArticle] = useState<CmsArticle | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [results, setResults] = useState<ResultCard[]>([])
  const startedRef = useRef(false)

  const articleUrl = article ? buildArticleUrl(site, article.urlSlug) : ''
  const isBulk = types.length > 1

  function updateCard(type: PostType, patch: Partial<ResultCard>) {
    setResults(prev => prev.map(r => r.type === type ? { ...r, ...patch } : r))
  }

  function runGenerator(type: CmsPostType, input: CmsGenInput) {
    switch (type) {
      case 'photo':
        return generatePhotoFromCms(input).then(v => {
          updateCard('photo', { status: 'done', imageUrl: v.imageUrl, caption: v.caption, photoTitle: v.photoTitle, cloudinaryUrl: v.cloudinaryUrl })
          logHistoryEvent({ eventType: 'generated', brand: input.brand, toolPostType: 'photo', sourcePage: 'cms', articleUrl: input.url, title: v.photoTitle, caption: v.caption, imageUrl: v.imageUrl, status: 'success' })
        })
      case 'quickfact':
        return generateQuickFactFromCms(input).then(v => {
          updateCard('quickfact', { status: 'done', imageUrl: v.imageUrl, caption: v.caption, quickFactTitle: v.quickFactTitle, quickFactFacts: v.quickFactFacts, quickFactKeyPhrase: v.quickFactKeyPhrase, cloudinaryUrl: v.cloudinaryUrl })
          logHistoryEvent({ eventType: 'generated', brand: input.brand, toolPostType: 'quickfact', sourcePage: 'cms', articleUrl: input.url, title: v.quickFactTitle, caption: v.caption, imageUrl: v.imageUrl, status: 'success' })
        })
      case 'quote':
        return generateQuoteFromCms(input).then(v => {
          updateCard('quote', { status: 'done', imageUrl: v.imageUrl, caption: v.caption, quoteData: v.quoteData, quotePexelsUrls: v.quotePexelsUrls, quoteFontUse: v.quoteFontUse })
          logHistoryEvent({ eventType: 'generated', brand: input.brand, toolPostType: 'quote', sourcePage: 'cms', articleUrl: input.url, title: v.quoteData?.quote_author ?? '', caption: v.caption, imageUrl: v.imageUrl, status: 'success' })
        })
    }
  }

  function buildInput(art: CmsArticle): CmsGenInput {
    return {
      url: buildArticleUrl(site, art.urlSlug),
      brand: brand ?? '',
      title: art.title,
      body: cleanBody(art.body),
      imageUrl: art.imageUrl,
      summary: art.summary,
      category: art.category?.[0]?.name,
      template,
      // Feed language codes: en = english, ms = malay. Trust the article's own value.
      language: art.language === 'en' ? 'english' : 'malay',
    }
  }

  // Fetch the article + kick off generation once.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    if (!id) { setLoadError('Missing article id.'); return }
    if (!brand) { setLoadError(`Unsupported site "${site}".`); return }

    const slots = getScheduledSlots(types.length)
    setResults(types.map((type, i) => ({
      type, status: 'generating', imageUrl: '', carouselImages: [], caption: '', scheduledFor: slots[i],
    })))

    ;(async () => {
      let art: CmsArticle
      try {
        art = await fetchArticle(id, site)
        setArticle(art)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load article'
        setLoadError(msg)
        setResults(prev => prev.map(r => ({ ...r, status: 'error', errorMessage: msg })))
        return
      }

      const input = buildInput(art)
      const settled = await Promise.allSettled(types.map(t => runGenerator(t, input)))
      settled.forEach((res, i) => {
        if (res.status === 'rejected') {
          const msg = res.reason instanceof Error ? res.reason.message : 'Generation failed'
          updateCard(types[i], { status: 'error', errorMessage: msg })
          logHistoryEvent({ eventType: 'error', brand: input.brand, toolPostType: types[i], sourcePage: 'cms', articleUrl: input.url, status: 'error', errorMessage: msg })
        }
      })
    })()
  }, [id, site, brand, template, types, runGenerator])

  async function handleRetry(type: PostType) {
    if (!article || !brand) return
    updateCard(type, { status: 'generating', errorMessage: undefined })
    try {
      await runGenerator(type as CmsPostType, buildInput(article))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      updateCard(type, { status: 'error', errorMessage: msg })
      logHistoryEvent({ eventType: 'error', brand: brand ?? '', toolPostType: type, sourcePage: 'cms', articleUrl, status: 'error', errorMessage: msg })
    }
  }

  return (
    <main className="pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
            {article?.title ?? 'Generating posts…'}
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            {brand ?? site} · {types.map(t => POST_TYPE_LABELS[t]).join(', ')}
          </p>
          <div className="mt-6 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {loadError && !results.length && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl max-w-lg">{loadError}</p>
        )}

        {isBulk ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(card => (
              <BulkResultCard
                key={card.type}
                card={card}
                brand={brand ?? ''}
                articleUrl={articleUrl}
                onCaptionChange={v => updateCard(card.type, { caption: v })}
                onRetry={() => handleRetry(card.type)}
              />
            ))}
          </div>
        ) : results[0] && (
          <>
            {results[0].status === 'generating' && (
              <div className="flex items-center gap-2 text-sm text-neutral-400 py-12 justify-center">
                <Spin /> Generating {POST_TYPE_LABELS[results[0].type]}…
              </div>
            )}
            {results[0].status === 'error' && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl max-w-lg">{results[0].errorMessage}</p>
            )}
            {results[0].status === 'done' && (
              <>
                {results[0].type === 'photo' && (
                  <PhotoSingleView card={results[0]} brand={brand ?? ''} articleUrl={articleUrl}
                    onCaptionChange={v => updateCard('photo', { caption: v })} />
                )}
                {results[0].type === 'quickfact' && (
                  <QuickFactSingleView card={results[0]} brand={brand ?? ''} articleUrl={articleUrl}
                    onCaptionChange={v => updateCard('quickfact', { caption: v })} />
                )}
                {results[0].type === 'quote' && (
                  <QuoteSingleView card={results[0]} brand={brand ?? ''} articleUrl={articleUrl}
                    onCaptionChange={v => updateCard('quote', { caption: v })} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
