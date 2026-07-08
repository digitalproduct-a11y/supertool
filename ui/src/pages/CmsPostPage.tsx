// CMS post-generation redirect target (standalone, not in sidebar).
//
// Drupal redirects editors here after they publish an article, passing only the
// site + article id. The editor then picks the post type(s) + a photo template on
// this page and clicks Generate. We fetch the article from the data feed, generate
// the selected posts via the CMS webhook, and render the SAME editable post cards
// as Article-to-Social.
//
// Example: /cms/post?site=awani&id=243169

import { useEffect, useRef, useState } from 'react'
import { logHistoryEvent } from '../services/historyLog'
import { useSearchParams } from 'react-router-dom'
import { brandFromSite } from '../constants/brands'
import { brandToSlug } from '../utils/brandSlug'
import { isBrandUnlocked, setBrandUnlocked } from '../utils/brandAuth'
import { BrandPasscodeModal } from '../components/BrandPasscodeModal'
import { getPhotoTemplatesForBrand, getDefaultTemplateForBrand } from '../config/photoTemplates'
import {
  fetchArticle,
  buildArticleUrl,
  cleanBody,
  firstParagraph,
  type CmsArticle,
} from '../services/articleFeed'
import {
  generatePhotoFromCms,
  generateQuickFactFromCms,
  generateQuickFactSingleFromCms,
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

// Awani convention: these post types use the article's first paragraph as the
// caption instead of the n8n-generated one.
const FIRST_PARA_CAPTION_TYPES: CmsPostType[] = ['photo', 'quote']

// Everything from the "read more" marker onward (link + hashtags), exactly as
// n8n produced it. Falls back to just the trailing hashtags if the marker is
// missing, or '' if neither is present.
function n8nCaptionTail(webhookCaption: string): string {
  const idx = webhookCaption.search(/baca maklumat lanjut/i)
  if (idx >= 0) return webhookCaption.slice(idx).trim()
  const tags = webhookCaption.match(/#[^\s#]+/g)
  return tags ? tags.join(' ') : ''
}

// The Awani brand hashtag must appear in every post. If it's already present
// (any case) leave it; otherwise lead the existing hashtag block with it, or
// append it on its own line when there are no hashtags yet.
const BRAND_HASHTAG = '#AWANInews'
function ensureBrandHashtag(caption: string): string {
  if (/#AWANInews\b/i.test(caption)) return caption
  const matchStart = caption.search(/(^|\s)#[^\s#]/)
  if (matchStart >= 0) {
    const at = caption.indexOf('#', matchStart)
    return `${caption.slice(0, at)}${BRAND_HASHTAG} ${caption.slice(at)}`
  }
  return `${caption.trimEnd()}\n\n${BRAND_HASHTAG}`
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

  const brand = brandFromSite(site)
  const templates = brand ? getPhotoTemplatesForBrand(brand) : []

  const passcodeWebhookUrl = (import.meta.env.VITE_BRAND_PASSCODE_WEBHOOK_URL as string | undefined)?.trim()

  // Brand passcode gate — mirrors the normal flow (BrandSelectionPage). The CMS route
  // isn't wrapped in BrandLayout, so we enforce the same per-brand passcode here via the
  // shared brandAuth helper (localStorage, 24h) so unlocking in either flow carries over.
  const [unlocked, setUnlocked] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [showPasscode, setShowPasscode] = useState(false)

  const [article, setArticle] = useState<CmsArticle | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [results, setResults] = useState<ResultCard[]>([])

  // Selection state — nothing pre-selected; Generate stays disabled until the
  // editor picks at least one type (and a template when Photo is selected).
  const [selectedTypes, setSelectedTypes] = useState<Set<CmsPostType>>(new Set())
  const [template, setTemplate] = useState('')
  // Quick Fact only: 'carousel' (new multi-slide) is the default; 'single' is the
  // legacy single composite image.
  const [quickFactTemplate, setQuickFactTemplate] = useState<'carousel' | 'single'>('carousel')
  const [started, setStarted] = useState(false)
  const [generatedTypes, setGeneratedTypes] = useState<CmsPostType[]>([])
  const fetchedRef = useRef(false)

  const articleUrl = article ? buildArticleUrl(site, article.urlSlug) : ''
  const isBulk = generatedTypes.length > 1
  const photoSelected = selectedTypes.has('photo')
  const quickFactSelected = selectedTypes.has('quickfact')
  // Photo needs a template pick only when the brand actually offers templates.
  // Template-less brands (e.g. Gempak) generate with getDefaultTemplateForBrand → "default".
  const canGenerate = !!article && selectedTypes.size > 0 && (!photoSelected || templates.length === 0 || template !== '')

  function updateCard(type: PostType, patch: Partial<ResultCard>) {
    setResults(prev => prev.map(r => r.type === type ? { ...r, ...patch } : r))
  }

  function toggleType(t: CmsPostType) {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }

  // Awani Photo/Quote captions use the article's first paragraph; everything
  // else (and other sites) keeps the n8n-generated caption.
  function captionFor(type: CmsPostType, webhookCaption: string): string {
    let caption = webhookCaption
    if (site === 'awani' && article && FIRST_PARA_CAPTION_TYPES.includes(type)) {
      const p = firstParagraph(article)
      if (p) {
        const tail = n8nCaptionTail(webhookCaption)
        caption = tail ? `${p}\n\n${tail}` : p
      }
    }
    // Awani posts must always carry the brand hashtag.
    if (site === 'awani') caption = ensureBrandHashtag(caption)
    return caption
  }

  function runGenerator(type: CmsPostType, input: CmsGenInput) {
    switch (type) {
      case 'photo':
        return generatePhotoFromCms(input).then(v => {
          const caption = captionFor('photo', v.caption)
          updateCard('photo', { status: 'done', imageUrl: v.imageUrl, caption, photoTitle: v.photoTitle, cloudinaryUrl: v.cloudinaryUrl })
          logHistoryEvent({ eventType: 'generated', brand: input.brand, toolPostType: 'photo', sourcePage: 'cms', articleUrl: input.url, title: v.photoTitle, caption, imageUrl: v.imageUrl, status: 'success' })
        })
      case 'quickfact':
        if (input.quickFactTemplate === 'single') {
          return generateQuickFactSingleFromCms(input).then(v => {
            const caption = captionFor('quickfact', v.caption)
            updateCard('quickfact', { status: 'done', caption, imageUrl: v.imageUrl, quickFactTitle: v.title, quickFactFacts: v.facts, quickFactKeyPhrase: v.keyPhrase, cloudinaryUrl: v.cloudinaryUrl })
            logHistoryEvent({ eventType: 'generated', brand: input.brand, toolPostType: 'quickfact', sourcePage: 'cms', articleUrl: input.url, title: v.title, caption, imageUrl: v.imageUrl, status: 'success' })
          })
        }
        return generateQuickFactFromCms(input).then(v => {
          const caption = captionFor('quickfact', v.caption)
          updateCard('quickfact', { status: 'done', caption, quickFactData: v })
          logHistoryEvent({ eventType: 'generated', brand: input.brand, toolPostType: 'quickfact', sourcePage: 'cms', articleUrl: input.url, title: v.title, caption, imageUrl: v.heroUrl, status: 'success' })
        })
      case 'quote':
        return generateQuoteFromCms(input).then(v => {
          const caption = captionFor('quote', v.caption)
          updateCard('quote', { status: 'done', imageUrl: v.imageUrl, caption, quoteData: v.quoteData, quotePexelsUrls: v.quotePexelsUrls, quoteFontUse: v.quoteFontUse })
          logHistoryEvent({ eventType: 'generated', brand: input.brand, toolPostType: 'quote', sourcePage: 'cms', articleUrl: input.url, title: v.quoteData?.quote_author ?? '', caption, imageUrl: v.imageUrl, status: 'success' })
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
      template: template || getDefaultTemplateForBrand(brand ?? ''),
      quickFactTemplate,
      // Feed language codes: en = english, zh-hans = chinese, ms = malay. Trust the article's value.
      language: art.language === 'en' ? 'english' : art.language?.startsWith('zh') ? 'chinese' : 'malay',
    }
  }

  // Brand passcode gate. Skip the probe if already unlocked this session; otherwise
  // probe the webhook with an empty passcode — brands that don't require one unlock
  // silently, the rest surface the modal.
  useEffect(() => {
    if (!brand) { setCheckingAuth(false); return }
    const slug = brandToSlug(brand)
    if (isBrandUnlocked(slug)) {
      setUnlocked(true); setCheckingAuth(false); return
    }
    ;(async () => {
      if (!passcodeWebhookUrl) { setShowPasscode(true); setCheckingAuth(false); return }
      try {
        const res = await fetch(passcodeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand, passcode: '' }),
        })
        const data = await res.json() as { success?: boolean; requires_passcode?: boolean }
        if (data.success && !data.requires_passcode) {
          setBrandUnlocked(slug)
          setUnlocked(true)
        } else {
          setShowPasscode(true)
        }
      } catch {
        setShowPasscode(true)
      } finally {
        setCheckingAuth(false)
      }
    })()
  }, [brand, passcodeWebhookUrl])

  // Fetch the article once for context + validation. Generation runs on click.
  // Gated on `unlocked` so no article is fetched before the passcode is cleared.
  useEffect(() => {
    if (!unlocked) return
    if (fetchedRef.current) return
    fetchedRef.current = true

    if (!id) { setLoadError('Missing article id.'); return }
    if (!brand) { setLoadError(`Unsupported site "${site}".`); return }

    ;(async () => {
      try {
        setArticle(await fetchArticle(id, site))
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load article')
      }
    })()
  }, [id, site, brand, unlocked])

  async function handleGenerate() {
    if (!article || !brand) return
    const types = CMS_TYPES.filter(t => selectedTypes.has(t))
    if (!types.length) return

    setGeneratedTypes(types)
    setStarted(true)

    const slots = getScheduledSlots(types.length)
    setResults(types.map((type, i) => ({
      type, status: 'generating', imageUrl: '', carouselImages: [], caption: '', scheduledFor: slots[i],
    })))

    const input = buildInput(article)
    const settled = await Promise.allSettled(types.map(t => runGenerator(t, input)))
    settled.forEach((res, i) => {
      if (res.status === 'rejected') {
        const msg = res.reason instanceof Error ? res.reason.message : 'Generation failed'
        updateCard(types[i], { status: 'error', errorMessage: msg })
        logHistoryEvent({ eventType: 'error', brand: input.brand, toolPostType: types[i], sourcePage: 'cms', articleUrl: input.url, status: 'error', errorMessage: msg })
      }
    })
  }

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
            {article?.title ?? (loadError ? 'Article unavailable' : 'Loading article…')}
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            {brand ?? site}{started && generatedTypes.length ? ' · ' + generatedTypes.map(t => POST_TYPE_LABELS[t]).join(', ') : ''}
          </p>
          <div className="mt-6 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* Unsupported site — brand couldn't be resolved from the `site` param. */}
        {!brand && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl max-w-lg">Unsupported site "{site}".</p>
        )}

        {/* Passcode gate — block the tool until the brand passcode is cleared. */}
        {brand && checkingAuth && (
          <div className="flex items-center gap-2 text-sm text-neutral-400 py-12 justify-center">
            <Spin /> Checking access…
          </div>
        )}
        {brand && !checkingAuth && !unlocked && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 max-w-lg">
            <h2 className="text-base font-semibold text-neutral-950">Passcode required</h2>
            <p className="text-sm text-neutral-500 mt-1">Enter the {brand} passcode to generate posts.</p>
            <button type="button" onClick={() => setShowPasscode(true)}
              className="mt-4 px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition active:scale-[0.98]">
              Enter passcode
            </button>
          </div>
        )}

        {brand && showPasscode && (
          <BrandPasscodeModal
            brand={brand}
            onSuccess={() => { setUnlocked(true); setShowPasscode(false) }}
            onClose={() => setShowPasscode(false)}
          />
        )}

        {unlocked && loadError && !results.length && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl max-w-lg">{loadError}</p>
        )}

        {/* Selection — pick post type(s) + a photo template, then generate. */}
        {unlocked && !started && !loadError && article && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5 mb-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Post Types</label>
              <div className="flex flex-wrap gap-2">
                {CMS_TYPES.map(t => {
                  const checked = selectedTypes.has(t)
                  return (
                    <button key={t} type="button" onClick={() => toggleType(t)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        checked ? 'bg-neutral-950 text-white border-neutral-950' : 'bg-white text-neutral-700 border-gray-200 hover:border-neutral-400'
                      }`}>
                      {POST_TYPE_LABELS[t]}
                    </button>
                  )
                })}
              </div>
            </div>
            {photoSelected && templates.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Photo Template</label>
                <div className="flex flex-wrap gap-2">
                  {templates.map(t => {
                    const checked = template === t.id
                    return (
                      <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          checked ? 'bg-neutral-950 text-white border-neutral-950' : 'bg-white text-neutral-700 border-gray-200 hover:border-neutral-400'
                        }`}>
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {quickFactSelected && (
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Quick Fact Template</label>
                <div className="flex flex-wrap gap-2">
                  {([['carousel', 'Carousel'], ['single', 'Single Image']] as const).map(([value, label]) => {
                    const checked = quickFactTemplate === value
                    return (
                      <button key={value} type="button" onClick={() => setQuickFactTemplate(value)}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          checked ? 'bg-neutral-950 text-white border-neutral-950' : 'bg-white text-neutral-700 border-gray-200 hover:border-neutral-400'
                        }`}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <button type="button" onClick={handleGenerate} disabled={!canGenerate}
              className="px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-950">
              Generate post
            </button>
          </div>
        )}

        {started && (isBulk ? (
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
        ))}
      </div>
    </main>
  )
}
