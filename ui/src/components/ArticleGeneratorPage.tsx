import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { IconRotate, IconUserCircle, IconTool, IconCoins, IconGift, IconListCheck, IconFileText, IconHistory } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'

interface ArticleHistoryItem {
  id: string
  timestamp: number
  brand: string
  articleTitle: string
  articleHtml: string
  thumbnailUrl?: string
}

const HISTORY_KEY = 'article-generator-history'
const HISTORY_LIMIT = 10

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}
import { useArticleGenerator } from '../hooks/useArticleGenerator'
import type {
  ArticleGeneratorState,
  ArticleGeneratorStep,
} from '../types'
import { BRANDS } from '../constants/brands'
import { GuideModal } from './ds/GuideModal'

const STEPS: { step: ArticleGeneratorStep; label: string; shortLabel: string }[] = [
  { step: 'input', label: 'Input', shortLabel: 'Input' },
  { step: 'pick-angle', label: 'Pick Angle', shortLabel: 'Angle' },
  { step: 'review-article', label: 'Review Article', shortLabel: 'Article' },
  { step: 'thumbnail', label: 'Thumbnail', shortLabel: 'Thumb' },
  { step: 'done', label: 'Done', shortLabel: 'Done' },
]

const isValidShopeeLink = (url: string): boolean => {
  if (!url.trim()) return false
  try {
    const urlObj = new URL(url.trim())
    return urlObj.hostname === 'shopee.com.my'
  } catch {
    return false
  }
}

const ANGLE_CATEGORIES: Record<number, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  1: { label: 'PERSONAL EXPERIENCE', icon: IconUserCircle, color: '#FF3FBF' },
  2: { label: 'USE-CASE / PROBLEM-SOLVER', icon: IconTool, color: '#F05A35' },
  3: { label: 'BUDGET VS VALUE', icon: IconCoins, color: '#00C9B8' },
  4: { label: 'GIFT GUIDE', icon: IconGift, color: '#0055EE' },
  5: { label: 'THE SHORTLIST', icon: IconListCheck, color: '#FF3FBF' },
}

const LOADING_STEPS = [
  'Fetching product details',
  'Analyzing product features',
  'Generating content angles',
]

const POSITIVE_QUOTES = [
  'We\'re brewing something good...',
  'Having a grate time processing...',
  'Lettuce wait patiently...',
  'This is un-beet-able...',
  'Donut worry, almost there...',
  'Time flies when you\'re having pun...',
  'We\'re on a roll... like bread...',
  'That\'s write, almost done...',
  'We knead more time... just kidding!',
  'This is im-pasta-ble to mess up...',
]

const ARTICLE_LOADING_STEPS = [
  'Setting the scene',
  'Writing the opening hook',
  'Covering each product',
  'Weaving in affiliate links',
  'Polishing the copy',
  'Final read-through',
]

const ARTICLE_QUOTES = [
  'Prose before bros...',
  'Words cannot espresso how hard we\'re working...',
  'We\'re on a writing roll... parchment not included...',
  'Getting write to it...',
  'Para-graphing our way through...',
  'Dot dot dot... just full sentences actually...',
  'Comma comma comma, chameleon...',
  'No pun in ten did...',
  'Authoring our way to greatness...',
  'Write place, write time...',
]

export function ArticleGeneratorPage({ isSidebarCollapsed = false }: { isSidebarCollapsed?: boolean }) {
  const [state, setState] = useState<ArticleGeneratorState>({
    step: 'input',
    brand: '',
    links: [],
    isLoading: false,
  })

  const [productLinks, setProductLinks] = useState<string[]>(['', '', ''])
  const [feedbackText, setFeedbackText] = useState('')
  const [customAngleText, setCustomAngleText] = useState('')
  const [_imagePromptText, setImagePromptText] = useState('')
  const [thumbnailFeedback, setThumbnailFeedback] = useState('')
  const [_thumbnailPhase, setThumbnailPhase] = useState<'prompt' | 'image' | 'done'>('prompt')
  const [showThumbnailRevisionModal, setShowThumbnailRevisionModal] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [showStartAnotherConfirm, setShowStartAnotherConfirm] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)

  const [loadingMessage, setLoadingMessage] = useState('Great things coming together...')
  const [currentStep, setCurrentStep] = useState(0)
  const [articleStep, setArticleStep] = useState(0)
  const [articleLoadingMessage, setArticleLoadingMessage] = useState(ARTICLE_QUOTES[0])
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false)
  const [copiedTitle, setCopiedTitle] = useState(false)
  const [copiedHtml, setCopiedHtml] = useState(false)
  const [expandedArticle, setExpandedArticle] = useState(false)

  const [history, setHistory] = useState<ArticleHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false)
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [copiedHistoryTitle, setCopiedHistoryTitle] = useState<string | null>(null)
  const [copiedHistoryHtml, setCopiedHistoryHtml] = useState<string | null>(null)
  const recordedForSession = useRef(false)

  const { intake, generate, thumbnailPrompt, thumbnailGenerate, isLoading, error } =
    useArticleGenerator()

  useEffect(() => {}, [])

  // Toast errors from the hook
  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  // Warn on browser refresh/close when mid-flow
  useEffect(() => {
    const dangerSteps = ['pick-angle', 'review-article', 'thumbnail']
    if (!dangerSteps.includes(state.step)) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state.step])

  // Block in-app navigation (sidebar clicks) when mid-flow
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      ['pick-angle', 'review-article', 'thumbnail'].includes(state.step) &&
      currentLocation.pathname !== nextLocation.pathname
  )

  // Track page visits for each step

  // Record to history once per session when reaching done
  useEffect(() => {
    if (state.step !== 'done') return
    if (recordedForSession.current) return
    if (!state.articleTitle || !state.articleHtml) return
    recordedForSession.current = true
    const item: ArticleHistoryItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      brand: state.brand,
      articleTitle: state.articleTitle,
      articleHtml: state.articleHtml,
      thumbnailUrl: state.thumbnailUrl && state.thumbnailUrl !== 'skipped' ? state.thumbnailUrl : undefined,
    }
    setHistory((prev) => {
      const updated = [item, ...prev].slice(0, HISTORY_LIMIT)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch {}
      return updated
    })
  }, [state.step])

  useEffect(() => {
    if (state.step !== 'pick-angle' || !isLoading) return

    let quoteIndex = 0
    let elapsedSeconds = 0

    const quoteInterval = setInterval(() => {
      quoteIndex = (quoteIndex + 1) % POSITIVE_QUOTES.length
      setLoadingMessage(POSITIVE_QUOTES[quoteIndex])
    }, 3000)

    const stepInterval = setInterval(() => {
      elapsedSeconds += 1
      const step = Math.min(Math.floor(elapsedSeconds / 10), 2)
      setCurrentStep(step)
    }, 1000)

    return () => {
      clearInterval(quoteInterval)
      clearInterval(stepInterval)
    }
  }, [state.step, isLoading])

  useEffect(() => {
    if (state.step !== 'review-article' || !isLoading) return

    setArticleStep(0)
    setArticleLoadingMessage(ARTICLE_QUOTES[0])

    let quoteIndex = 0
    let elapsedSeconds = 0

    const quoteInterval = setInterval(() => {
      quoteIndex = (quoteIndex + 1) % ARTICLE_QUOTES.length
      setArticleLoadingMessage(ARTICLE_QUOTES[quoteIndex])
    }, 5000)

    const stepInterval = setInterval(() => {
      elapsedSeconds += 1
      const step = Math.min(Math.floor(elapsedSeconds / 20), ARTICLE_LOADING_STEPS.length - 1)
      setArticleStep(step)
    }, 1000)

    return () => {
      clearInterval(quoteInterval)
      clearInterval(stepInterval)
    }
  }, [state.step, isLoading])

  const getCurrentStepIndex = () => STEPS.findIndex((s) => s.step === state.step)

  const filledLinks = productLinks.filter((l) => l.trim())
  const validFilledLinks = filledLinks.filter(isValidShopeeLink)
  const canGenerate = filledLinks.length >= 3 && validFilledLinks.length === filledLinks.length

  const handleRestart = useCallback(() => {
    setState({
      step: 'input',
      brand: '',
      links: [],
      isLoading: false,
    })
    setProductLinks(['', '', ''])
    setFeedbackText('')
    setCustomAngleText('')
    setImagePromptText('')
    setShowRestartConfirm(false)
    setShowStartAnotherConfirm(false)
    setThumbnailLoaded(false)
    recordedForSession.current = false
  }, [])

  const handleThumbnailDownload = useCallback(async () => {
    if (!state.thumbnailUrl) return
    try {
      const res = await fetch(state.thumbnailUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `thumbnail_${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(state.thumbnailUrl, '_blank')
    }
  }, [state.thumbnailUrl])

  const handleAddProduct = useCallback(() => {
    if (productLinks.length < 8) {
      setProductLinks((l) => [...l, ''])
    }
  }, [productLinks.length])

  const handleDeleteProduct = useCallback((index: number) => {
    setProductLinks((l) => l.filter((_, i) => i !== index))
  }, [])

  const handleLinkChange = useCallback((index: number, value: string) => {
    setProductLinks((l) => {
      const newLinks = [...l]
      newLinks[index] = value
      return newLinks
    })
  }, [])

  const handleInputSubmit = useCallback(async () => {
    if (!state.brand || !canGenerate) return

    setState((s) => ({ ...s, step: 'pick-angle', links: filledLinks, isLoading: true }))

    const result = await intake(state.brand, filledLinks)
    if (result) {
      setState((s) => ({
        ...s,
        brandVoice: result.brand_voice,
        products: result.products,
        suggestedAngles: result.suggested_angles,
        overallTheme: result.overall_theme,
        isLoading: false,
      }))
    } else {
      setState((s) => ({
        ...s,
        step: 'input',
        isLoading: false,
        error: 'Failed to process links. Please try again.',
      }))
    }
  }, [state.brand, filledLinks, intake])

  const handleAngleSubmit = useCallback(async () => {
    if (state.selectedAngle === undefined && !customAngleText.trim()) return

    setState((s) => ({ ...s, step: 'review-article', isLoading: true }))

    const body = {
      brand: state.brand,
      brand_voice: state.brandVoice,
      products: state.products,
      suggested_angles: state.suggestedAngles,
      overall_theme: state.overallTheme,
      selectedAngle: state.selectedAngle,
      customAngle: customAngleText.trim() || null,
      previous_article: null,
      feedback: null,
    }

    const result = await generate(body)
    if (result) {
      setState((s) => ({
        ...s,
        step: 'review-article',
        articleHtml: result.article_html,
        articleTitle: result.article_title,
        isLoading: false,
      }))
    } else {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Failed to generate article. Please try again.',
      }))
    }
  }, [state, generate])

  const handleArticleApprove = useCallback(() => {
    setShowApproveModal(true)
  }, [])

  const handleArticleRevise = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }))

    const body = {
      brand: state.brand,
      brand_voice: state.brandVoice,
      products: state.products,
      suggested_angles: state.suggestedAngles,
      overall_theme: state.overallTheme,
      selectedAngle: state.selectedAngle,
      customAngle: state.customAngle,
      previous_article: state.articleHtml,
      feedback: feedbackText.trim(),
    }

    const result = await generate(body)
    if (result) {
      setState((s) => ({
        ...s,
        articleHtml: result.article_html,
        articleTitle: result.article_title,
        isLoading: false,
      }))
      setFeedbackText('')
    } else {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Failed to regenerate article. Please try again.',
      }))
    }
  }, [state, generate])

  const handleThumbnailGenerate = useCallback(async (feedback?: string) => {
    // Phase 1: generate prompt
    setThumbnailPhase('prompt')
    setState((s) => ({ ...s, isLoading: true, imagePrompt: undefined, thumbnailUrl: undefined }))

    const body = {
      brand: state.brand,
      article_title: state.articleTitle,
      clean_product_names: state.products?.map((p) => p.cleanProductName) || [],
      image_urls: state.products?.map((p) => p.imageUrl) || [],
      product_features: state.products?.map((p) => p.productFeatures).join(', ') || '',
      user_feedback: feedback || null,
    }

    const promptResult = await thumbnailPrompt(body)
    if (!promptResult) {
      setState((s) => ({ ...s, isLoading: false, error: 'Failed to generate thumbnail prompt. Please try again.' }))
      return
    }

    const prompt = promptResult.image_prompt
    setImagePromptText(prompt)
    setState((s) => ({ ...s, imagePrompt: prompt }))

    // Phase 2: auto-generate image
    setThumbnailPhase('image')
    const imageResult = await thumbnailGenerate({ prompt })
    if (imageResult) {
      setThumbnailPhase('done')
      setState((s) => ({ ...s, thumbnailUrl: imageResult.thumbnail_url, isLoading: false }))
    } else {
      setState((s) => ({ ...s, isLoading: false, error: 'Failed to generate thumbnail. Please try again.' }))
    }
  }, [state, thumbnailPrompt, thumbnailGenerate])

  const handleThumbnailRegenerate = useCallback(async () => {
    const feedback = thumbnailFeedback.trim()
    setThumbnailFeedback('')
    await handleThumbnailGenerate(feedback || undefined)
  }, [thumbnailFeedback, handleThumbnailGenerate])

  return (
    <>
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                Shopee Article Generator
              </h1>
              <p className="text-neutral-500 mt-1 text-sm">
                Write engaging Shopee product articles from links
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setShowHistoryDrawer(true)
                requestAnimationFrame(() => requestAnimationFrame(() => setHistoryDrawerOpen(true)))
              }}
              className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 shrink-0 bg-neutral-50 hover:bg-neutral-100"
            >
              <IconHistory className="w-4 h-4" />
              History{history.length > 0 ? ` (${history.length})` : ''}
            </button>
            <GuideModal title="How to use Shopee Article Generator">
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden bg-neutral-100 aspect-video">
                  <iframe
                    src="https://drive.google.com/file/d/1N4mclnm0FgkQ4C0_4nC8Zf2IaFsgFQgA/preview"
                    className="w-full h-full"
                    allow="autoplay"
                    title="Shopee Article Generator walkthrough video"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-950 mb-3">Step-by-step guide</h3>
                  <ol className="space-y-3 list-decimal list-inside text-sm text-neutral-700">
                    <li><strong>Step 1 — Input:</strong>
                      <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                        <li>Paste Shopee product links (shopee.com.my URLs).</li>
                        <li>Select a brand for the article.</li>
                        <li>Click <strong>Generate Article Angles</strong> to proceed.</li>
                      </ul>
                    </li>
                    <li><strong>Step 2 — Pick Angle:</strong>
                      <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                        <li>Review AI-suggested editorial angles.</li>
                        <li>Pick one or write your own custom angle.</li>
                        <li>Click <strong>Write Article</strong> to start writing.</li>
                      </ul>
                    </li>
                    <li><strong>Step 3 — Review Article:</strong>
                      <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                        <li>Review the generated article, written in the brand's voice.</li>
                        <li>Affiliate links are already embedded.</li>
                        <li>Click <strong>Request Revision</strong> to refine, or <strong>Approve</strong> to generate the article thumbnail.</li>
                      </ul>
                    </li>
                    <li><strong>Step 4 — Thumbnail:</strong>
                      <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                        <li>Review the AI-generated thumbnail image.</li>
                        <li>Regenerate if needed.</li>
                        <li>Click <strong>Done</strong> to finish.</li>
                      </ul>
                    </li>
                    <li><strong>Done:</strong>
                      <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                        <li>Copy the article content and paste it into your website CMS.</li>
                        <li>Download the thumbnail for your article header.</li>
                        <li>The completed article is saved to <strong>History</strong> — access it anytime from the History button at the top.</li>
                      </ul>
                    </li>
                  </ol>
                </div>
                <div className="p-3 bg-neutral-100 border border-neutral-300 rounded-lg">
                  <p className="text-xs font-semibold text-neutral-800 mb-1">💡 Tip</p>
                  <p className="text-xs text-neutral-700">Use the Restart button to start over with different products or a different brand at any point.</p>
                </div>
              </div>
            </GuideModal>
            {state.step !== 'input' && state.step !== 'done' && (
              <button
                onClick={() => setShowRestartConfirm(true)}
                className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 shrink-0 bg-neutral-50 hover:bg-neutral-100"
              >
                <IconRotate className="w-4 h-4" />
                Restart
              </button>
            )}
            </div>
          </div>
          <div className="mt-3 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex justify-between items-end gap-2 text-xs">
            {STEPS.map((s, idx) => {
              const currentIdx = getCurrentStepIndex()
              const isCompleted = idx < currentIdx
              const isActive = idx === currentIdx
              return (
                <div key={s.step} className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-neutral-950 text-white'
                        : 'bg-neutral-200 text-neutral-500'
                  }`}>
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <p className="mt-1 text-center text-neutral-600 font-medium truncate">
                    <span className="md:hidden">{s.shortLabel}</span>
                    <span className="hidden md:inline">{s.label}</span>
                  </p>
                </div>
              )
            })}
          </div>
          <div className="flex gap-0 mt-3 h-1">
            {STEPS.map((_, idx) => {
              const currentIdx = getCurrentStepIndex()
              const isCompleted = idx < currentIdx
              return (
                <div
                  key={idx}
                  className={`flex-1 ${isCompleted ? 'bg-green-500' : idx === currentIdx ? 'bg-neutral-950' : 'bg-neutral-200'}`}
                />
              )
            })}
          </div>
        </div>

        {/* Step: Input */}
        {state.step === 'input' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">Brand</label>
              <div className="relative">
                <select
                  value={state.brand}
                  onChange={(e) => setState((s) => ({ ...s, brand: e.target.value }))}
                  className="w-full px-4 py-3 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition"
                >
                  <option value="">Select a brand...</option>
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-900">
                Shopee Product Links (Min 3 required)
              </label>
              {productLinks.map((link, idx) => {
                const isValid = link.trim() === '' || isValidShopeeLink(link)
                const isFilled = link.trim() !== ''

                return (
                  <div key={idx} className="flex gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-xs font-medium text-neutral-700">
                          Product {idx + 1}
                        </label>
                        {isFilled && !isValid && (
                          <span className="text-xs text-red-500">Please use a Shopee link (e.g. shopee.com.my/...)</span>
                        )}
                        {isFilled && isValid && <span className="text-xs text-green-500">✓</span>}
                      </div>
                      <input
                        type="text"
                        value={link}
                        onChange={(e) => handleLinkChange(idx, e.target.value)}
                        placeholder="https://shopee.com.my/product/..."
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                          !isValid && isFilled
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-neutral-300 focus:ring-neutral-950'
                        }`}
                      />
                    </div>
                    {idx >= 3 && (
                      <button
                        onClick={() => handleDeleteProduct(idx)}
                        className="mt-6 px-3 py-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete product"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )
              })}

              {productLinks.length < 8 && (
                <button
                  onClick={handleAddProduct}
                  className="mt-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition"
                >
                  + Add product
                </button>
              )}

              {filledLinks.length > 0 && filledLinks.length < 3 && (
                <p className="text-xs text-amber-600 mt-2">
                  {3 - filledLinks.length} more required to generate
                </p>
              )}
              {validFilledLinks.length < filledLinks.length && (
                <p className="text-xs text-red-600 mt-2">
                  {filledLinks.length - validFilledLinks.length} link(s) are invalid - Only shopee.com.my links are accepted
                </p>
              )}
            </div>

            <button
              onClick={handleInputSubmit}
              disabled={!state.brand || !canGenerate || isLoading}
              className="w-full px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Processing...' : 'Generate Article Angles'}
            </button>
          </div>
        )}


        {/* Step: Pick Angle */}
        {state.step === 'pick-angle' && isLoading && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 text-center space-y-6">
            <div className="text-4xl animate-search-bounce inline-block">🔍</div>
            <div className="flex justify-center gap-2">
              {LOADING_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all duration-700 ${idx < currentStep ? 'bg-green-500 w-4' : idx === currentStep ? 'w-4 animate-pulse-strong' : 'bg-neutral-200 w-2'}`}
                  style={idx === currentStep ? { background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' } : undefined}
                />
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{LOADING_STEPS[currentStep]}</p>
              <p className="text-xs text-neutral-400 mt-1">Step {currentStep + 1} of {LOADING_STEPS.length}</p>
            </div>
            <p key={loadingMessage} className="text-sm text-neutral-500 italic animate-fade">{loadingMessage}</p>
            <p className="text-xs text-neutral-400">Taking ~30 seconds to process</p>
          </div>
        )}

        {state.step === 'pick-angle' && !isLoading && (
          <div className="space-y-6">
            {/* Page heading */}
            <div>
              <h2 className="text-2xl font-semibold text-neutral-950 mb-1">Choose your angle</h2>
              <p className="text-sm text-neutral-600">Select how you'd like to approach this article, or create your own</p>
            </div>

            {/* Theme */}
            {state.brand && state.overallTheme && (
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-4">
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">Article Focus</p>
                <p className="text-sm font-medium text-neutral-900">
                  <span className="font-semibold">"{state.overallTheme}"</span> for <span className="font-semibold">{state.brand}</span>
                </p>
              </div>
            )}

            {/* Products — compact chip strip */}
            {state.products && state.products.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">Products ({state.products.length})</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:-mx-0 md:px-0">
                  {state.products.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedProduct(idx)}
                      className="flex-shrink-0 flex items-center gap-2 bg-white rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.08)] px-3 py-2 hover:shadow-[0_2px_16px_rgba(0,0,0,0.12)] transition text-left"
                    >
                      <img
                        src={p.imageUrl}
                        alt={p.cleanProductName}
                        className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-900 truncate max-w-[120px]">{p.cleanProductName}</p>
                        <p className="text-xs text-neutral-500">RM {p.priceMin}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content Angles */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-900">Pick an article angle</h2>
              <div className="space-y-2">
                {state.suggestedAngles?.map((angle) => {
                  const categoryData = ANGLE_CATEGORIES[angle.id]
                  return (
                    <button
                      key={angle.id}
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          selectedAngle: angle.id,
                          customAngle: undefined,
                        }))
                      }
                      className="w-full text-left p-4 rounded-lg border-2 transition"
                      style={{
                        borderColor: state.selectedAngle === angle.id ? (categoryData?.color ?? '#171717') : undefined,
                        backgroundColor: state.selectedAngle === angle.id ? `${categoryData?.color ?? '#171717'}08` : undefined,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Radio indicator */}
                        <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                          style={{
                            borderColor: state.selectedAngle === angle.id ? (categoryData?.color ?? '#171717') : '#d4d4d4',
                          }}
                        >
                          {state.selectedAngle === angle.id && (
                            <div className="w-2 h-2 rounded-full" style={{ background: categoryData?.color ?? '#171717' }} />
                          )}
                        </div>
                        <div className="flex-1">
                          {categoryData && (() => {
                            const Icon = categoryData.icon
                            return (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-2" style={{ background: `${categoryData.color}18`, color: categoryData.color }}>
                                <Icon className="w-3 h-3 flex-shrink-0" />
                                {categoryData.label}
                              </div>
                            )
                          })()}
                          <p className="text-sm font-medium text-neutral-900">{angle.title}</p>
                          <p className="text-xs text-neutral-500 mt-1">{angle.description}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="pt-4 border-t border-neutral-200 space-y-3">
                <label className="block text-xs font-medium text-neutral-700">
                  Or write your own angle
                </label>
                <textarea
                  value={customAngleText}
                  onChange={(e) => setCustomAngleText(e.target.value)}
                  onClick={() => setState((s) => ({ ...s, selectedAngle: undefined }))}
                  placeholder="Describe your content approach..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  rows={2}
                />
              </div>

              <button
                onClick={handleAngleSubmit}
                disabled={state.selectedAngle === undefined && !customAngleText.trim() || isLoading}
                className="w-full px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? 'Writing...' : 'Write Article'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Review Article */}
        {state.step === 'review-article' && isLoading && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 text-center space-y-6">
            <div className="text-4xl animate-write-bounce inline-block">✏️</div>
            <div className="flex justify-center gap-2">
              {ARTICLE_LOADING_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all duration-700 ${idx < articleStep ? 'bg-green-500 w-4' : idx === articleStep ? 'w-4 animate-pulse-strong' : 'bg-neutral-200 w-2'}`}
                  style={idx === articleStep ? { background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' } : undefined}
                />
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{ARTICLE_LOADING_STEPS[articleStep]}</p>
              <p className="text-xs text-neutral-400 mt-1">Step {articleStep + 1} of {ARTICLE_LOADING_STEPS.length}</p>
            </div>
            <p className="text-sm text-neutral-500 italic animate-fade">{articleLoadingMessage}</p>
            <p className="text-xs text-neutral-400">Taking ~2 minutes to write</p>
          </div>
        )}

        {state.step === 'review-article' && !isLoading && (
          <div className="space-y-4">
            {/* Step heading */}
            <div>
              <h2 className="text-2xl font-semibold text-neutral-950 mb-1">Review your article</h2>
              <p className="text-sm text-neutral-600">Read through the draft below. Approve it or request changes.</p>
            </div>

            {/* Title box */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)]">
              <div className="px-7 pt-4 pb-2 border-b border-neutral-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Title</p>
                {state.selectedAngle && ANGLE_CATEGORIES[state.selectedAngle] && (() => {
                  const cat = ANGLE_CATEGORIES[state.selectedAngle!]
                  return (
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-400">Angle:</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${cat.color}18`, color: cat.color }}>
                        {(() => { const Icon = cat.icon; return <Icon className="w-3 h-3 flex-shrink-0" /> })()}
                        {cat.label}
                      </span>
                    </span>
                  )
                })()}
                {!state.selectedAngle && state.customAngle && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400">Angle:</span>
                    <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                      ✏️ CUSTOM ANGLE
                    </span>
                  </span>
                )}
              </div>
              <div className="px-7 py-5">
                <h2 className="text-lg font-semibold text-neutral-950">{state.articleTitle}</h2>
              </div>
            </div>

            {/* Article body box */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)]">
              <div className="px-7 pt-4 pb-2 border-b border-neutral-100 rounded-t-2xl flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Article</p>
                {state.articleHtml && (
                  <p className="text-xs text-neutral-400">
                    {state.articleHtml.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length} words
                  </p>
                )}
              </div>
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#111;padding:0}img{max-width:100%;height:auto;border-radius:8px;display:block}h1,h2,h3{font-weight:700;line-height:1.3}a{color:#0055EE}table{border-collapse:collapse;width:100%}td,th{padding:8px 12px;border:1px solid #e5e5e5}p{margin:0 0 1em}</style></head><body>${state.articleHtml || ''}</body></html>`}
                className="w-full border-0 rounded-b-2xl"
                scrolling="no"
                style={{ display: 'block', minHeight: '200px' }}
                title="Article preview"
                onLoad={(e) => {
                  const iframe = e.currentTarget
                  const resize = () => {
                    try {
                      const body = iframe.contentDocument?.body
                      if (body) iframe.style.height = body.scrollHeight + 48 + 'px'
                    } catch {
                      iframe.style.height = '2000px'
                    }
                  }
                  resize()
                  setTimeout(resize, 300)
                  setTimeout(resize, 1000)
                }}
              />
            </div>

            {/* Spacer so content isn't hidden behind sticky bar */}
            <div className="h-20" />

            {/* Sticky action bar */}
            <div className={`fixed bottom-0 right-0 z-40 bg-white/90 backdrop-blur border-t border-neutral-200 px-4 py-3 transition-[left] duration-300 ${isSidebarCollapsed ? 'left-0' : 'left-0 md:left-60'}`}>
              <div className="max-w-2xl mx-auto flex gap-3">
              <button
                onClick={() => setShowRevisionModal(true)}
                className="flex-1 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-xl font-medium hover:bg-neutral-50 transition text-sm"
              >
                Request Revision
              </button>
              <button
                onClick={handleArticleApprove}
                className="flex-1 px-4 py-3 bg-neutral-950 text-white rounded-xl font-medium hover:bg-neutral-800 transition text-sm"
              >
                Approve
              </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Thumbnail */}
        {state.step === 'thumbnail' && (
          <>
          <div className="space-y-4">
            {/* Step heading */}
            <div>
              <h2 className="text-2xl font-semibold text-neutral-950 mb-1">Generate thumbnail</h2>
              <p className="text-sm text-neutral-600">Review the generated image. Regenerate with feedback or mark as done.</p>
            </div>

            {/* Image card — shimmer while loading, image when done */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
              {/* Placeholder — stays visible until image has actually loaded */}
              {(!state.thumbnailUrl || state.thumbnailUrl === 'skipped' || !thumbnailLoaded) && (
                <div className="w-full aspect-video bg-neutral-100 relative overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-[3px] border-neutral-300 border-t-neutral-700 animate-spin" />
                    <p className="text-xs text-neutral-500 font-medium">Generating image...</p>
                  </div>
                </div>
              )}
              {/* Image — hidden until loaded to prevent height-collapse scroll jump */}
              {state.thumbnailUrl && state.thumbnailUrl !== 'skipped' && (
                <img
                  src={state.thumbnailUrl}
                  alt="Generated thumbnail"
                  className={`w-full ${thumbnailLoaded ? 'animate-fade-slide-up' : 'hidden'}`}
                  onLoad={() => setThumbnailLoaded(true)}
                />
              )}
            </div>

            {/* Spacer so content isn't hidden behind sticky bar */}
            <div className="h-20" />
          </div>

          {/* Sticky action bar */}
          <div className={`fixed bottom-0 right-0 z-40 bg-white/90 backdrop-blur border-t border-neutral-200 px-4 py-3 transition-[left] duration-300 ${isSidebarCollapsed ? 'left-0' : 'left-0 md:left-60'}`}>
            <div className="max-w-2xl mx-auto flex gap-3">
              <button
                onClick={() => setShowThumbnailRevisionModal(true)}
                disabled={!state.thumbnailUrl || state.thumbnailUrl === 'skipped'}
                className="flex-1 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-xl font-medium hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm"
              >
                Regenerate
              </button>
              <button
                onClick={() => setState((s) => ({ ...s, step: 'done' }))}
                disabled={!state.thumbnailUrl || state.thumbnailUrl === 'skipped'}
                className="flex-1 px-4 py-3 bg-neutral-950 text-white rounded-xl font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm"
              >
                Done
              </button>
            </div>
          </div>
          </>
        )}

        {/* Step: Done */}
        {state.step === 'done' && (
          <>
          <div className="space-y-6 animate-fade-slide-up">
            {/* Heading */}
            <div>
              <h2 className="text-2xl font-semibold text-neutral-950 mb-1">Article ready!</h2>
              <p className="text-sm text-neutral-600">Your article is ready to publish. Copy the content below.</p>
            </div>

            {/* Thumbnail with download overlay */}
            {state.thumbnailUrl && state.thumbnailUrl !== 'skipped' && (
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
                <div className="relative">
                  <img
                    src={state.thumbnailUrl}
                    alt="Article thumbnail"
                    className="w-full"
                  />
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={handleThumbnailDownload}
                      className="px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Title section */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Title</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(state.articleTitle || '')
                    setCopiedTitle(true)
                    setTimeout(() => setCopiedTitle(false), 2000)
                  }}
                  title="Copy title"
                  className="text-neutral-400 hover:text-neutral-700 transition"
                >
                  {copiedTitle
                    ? <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  }
                </button>
              </div>
              <p className="text-base font-semibold text-neutral-950">{state.articleTitle}</p>
            </div>

            {/* Article HTML section */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Article</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(state.articleHtml || '')
                    setCopiedHtml(true)
                    setTimeout(() => setCopiedHtml(false), 2000)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${copiedHtml ? 'bg-green-50 text-green-600' : 'bg-neutral-950 text-white hover:bg-neutral-800'}`}
                >
                  {copiedHtml ? (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy Article Full HTML</>
                  )}
                </button>
              </div>

              {/* CMS instruction banner */}
              <div className="mx-5 mt-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Use the <span className="font-semibold">Copy Article Full HTML</span> button, then paste it into your CMS using the <span className="font-semibold">Free HTML</span> block, not the regular text editor. This will preserve the styling and images.
                </p>
              </div>

              {/* Article preview — collapsible */}
              <div className={`relative transition-all duration-300 ${expandedArticle ? '' : 'max-h-64 overflow-hidden'}`}>
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#111;padding:0}img{max-width:100%;height:auto;border-radius:8px;display:block}h1,h2,h3{font-weight:700;line-height:1.3}a{color:#0055EE}table{border-collapse:collapse;width:100%}td,th{padding:8px 12px;border:1px solid #e5e5e5}p{margin:0 0 1em}</style></head><body>${state.articleHtml || ''}</body></html>`}
                  className="w-full border-0"
                  scrolling="no"
                  style={{ display: 'block', minHeight: '200px' }}
                  title="Article preview"
                  onLoad={(e) => {
                    const iframe = e.currentTarget
                    const resize = () => {
                      try {
                        const body = iframe.contentDocument?.body
                        if (body) iframe.style.height = body.scrollHeight + 48 + 'px'
                      } catch {
                        iframe.style.height = '2000px'
                      }
                    }
                    resize()
                    setTimeout(resize, 300)
                    setTimeout(resize, 1000)
                  }}
                />
                {/* Fade overlay when collapsed */}
                {!expandedArticle && (
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                )}
              </div>

              {/* Expand / collapse toggle */}
              <div className="flex justify-center py-3 border-t border-neutral-100">
                <button
                  onClick={() => setExpandedArticle((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition"
                >
                  {expandedArticle ? (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>Collapse</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>Expand full article</>
                  )}
                </button>
              </div>
            </div>

            {/* Spacer so content isn't hidden behind sticky bar */}
            <div className="h-20" />
          </div>

          {/* Sticky action bar */}
          <div className={`fixed bottom-0 right-0 z-40 bg-white/90 backdrop-blur border-t border-neutral-200 px-4 py-3 transition-[left] duration-300 ${isSidebarCollapsed ? 'left-0' : 'left-0 md:left-60'}`}>
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => setShowStartAnotherConfirm(true)}
                className="w-full px-4 py-3 border border-neutral-300 text-neutral-700 rounded-xl font-medium hover:bg-neutral-50 transition text-sm"
              >
                Start another article
              </button>
            </div>
          </div>
          </>
        )}
      </div>
    </main>

    {/* Modals — rendered outside main to avoid stacking context issues */}
    {showRestartConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Clear all and start over?</h3>
              <p className="text-sm text-neutral-600 mt-1">This will reset all your progress and take you back to the beginning.</p>
            </div>
            <button onClick={() => setShowRestartConfirm(false)} className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRestartConfirm(false)}
              className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleRestart}
              className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition text-sm"
            >
              Yes, restart
            </button>
          </div>
        </div>
      </div>
    )}
    {blocker.state === 'blocked' && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Leave this page?</h3>
              <p className="text-sm text-neutral-600 mt-1">Your progress will be lost if you navigate away now.</p>
            </div>
            <button onClick={() => blocker.reset()} className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => blocker.reset()}
              className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 transition text-sm"
            >
              Stay
            </button>
            <button
              onClick={() => blocker.proceed()}
              className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition text-sm"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    )}
    {showStartAnotherConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Start a new article?</h3>
              <p className="text-sm text-neutral-600 mt-1">Your article is saved in History. Just make sure you've downloaded your thumbnail before starting fresh.</p>
            </div>
            <button onClick={() => setShowStartAnotherConfirm(false)} className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStartAnotherConfirm(false)}
              className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 transition text-sm"
            >
              Go back
            </button>
            <button
              onClick={handleRestart}
              className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition text-sm"
            >
              Yes, start fresh
            </button>
          </div>
        </div>
      </div>
    )}
    {showRevisionModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Request a revision</h3>
              <p className="text-sm text-neutral-500 mt-1">Tell the editor what to change or improve.</p>
            </div>
            <button onClick={() => setShowRevisionModal(false)} className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="e.g., Make the intro punchier, emphasise the price difference more..."
            className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950 resize-none"
            rows={4}
            autoFocus
          />
          <button
            onClick={() => { setShowRevisionModal(false); handleArticleRevise() }}
            disabled={!feedbackText.trim()}
            className="w-full px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm"
          >
            Submit revision
          </button>
        </div>
      </div>
    )}
    {showThumbnailRevisionModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Regenerate thumbnail</h3>
              <p className="text-sm text-neutral-500 mt-1">Describe what to change about the image.</p>
            </div>
            <button onClick={() => setShowThumbnailRevisionModal(false)} className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <textarea
            value={thumbnailFeedback}
            onChange={(e) => setThumbnailFeedback(e.target.value)}
            placeholder="e.g. make the background warmer, show products from a different angle..."
            className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950 resize-none"
            rows={3}
            autoFocus
          />
          <button
            onClick={() => {
              setShowThumbnailRevisionModal(false)
              handleThumbnailRegenerate()
            }}
            disabled={!thumbnailFeedback.trim()}
            className="w-full px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm"
          >
            Regenerate
          </button>
        </div>
      </div>
    )}
    {showApproveModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Generate a thumbnail?</h3>
              <p className="text-sm text-neutral-500 mt-1">Article approved! Want to generate a thumbnail image to go with it?</p>
            </div>
            <button onClick={() => setShowApproveModal(false)} className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowApproveModal(false)
                setState((s) => ({ ...s, step: 'done' }))
              }}
              className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition text-sm"
            >
              Skip, I'm done
            </button>
            <button
              onClick={() => {
                setShowApproveModal(false)
                setState((s) => ({ ...s, step: 'thumbnail' }))
                handleThumbnailGenerate()
              }}
              className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition text-sm"
            >
              Yes, generate
            </button>
          </div>
        </div>
      </div>
    )}
    {selectedProduct !== null && state.products && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-neutral-200 p-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-neutral-900">Product Details from Shopee</h2>
            <button
              onClick={() => setSelectedProduct(null)}
              className="text-neutral-500 hover:text-neutral-700 text-2xl"
            >
              ✕
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Top: image left, details right */}
            <div className="flex gap-4 items-start">
              <img
                src={state.products[selectedProduct].imageUrl}
                alt={state.products[selectedProduct].cleanProductName}
                className="w-28 h-28 object-cover rounded-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-base font-bold text-neutral-900 leading-snug">
                  {state.products[selectedProduct].cleanProductName}
                </h3>
                <p className="text-lg font-bold text-neutral-950">RM {state.products[selectedProduct].priceMin}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <p className="text-xs text-neutral-400">Rating</p>
                    <p className="font-medium text-neutral-900">★ {state.products[selectedProduct].ratingStar}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Sold</p>
                    <p className="font-medium text-neutral-900">{state.products[selectedProduct].sales}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Shop</p>
                    <p className="font-medium text-neutral-900 truncate">{state.products[selectedProduct].shopName}</p>
                  </div>
                  {state.products[selectedProduct].shopTypeLabel && (
                    <div>
                      <p className="text-xs text-neutral-400">Seller Status</p>
                      <p className="text-xs font-medium text-green-700 bg-green-50 inline-block px-2 py-0.5 rounded-full mt-0.5">
                        {state.products[selectedProduct].shopTypeLabel}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Affiliate link */}
            {state.products[selectedProduct].affiliateLink && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Affiliate Link</p>
                <div className="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2">
                  <a
                    href={state.products[selectedProduct].affiliateLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-blue-600 hover:underline truncate"
                  >
                    {state.products[selectedProduct].affiliateLink}
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(state.products![selectedProduct!].affiliateLink)}
                    className="flex-shrink-0 p-1 text-neutral-400 hover:text-neutral-700 transition"
                    title="Copy link"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* Features */}
            {state.products[selectedProduct].productFeatures && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Features</p>
                <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">
                  {state.products[selectedProduct].productFeatures}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* History drawer */}
    {showHistoryDrawer && (
      <div
        className="fixed inset-0 z-[150]"
        onClick={() => { setHistoryDrawerOpen(false) }}
      >
        {/* Backdrop */}
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${historyDrawerOpen ? 'opacity-100' : 'opacity-0'}`} />
        {/* Drawer */}
        <div
          className={`absolute right-0 top-0 h-full w-80 bg-white shadow-2xl flex flex-col transition-transform duration-300 ${historyDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
          onClick={(e) => e.stopPropagation()}
          onTransitionEnd={() => { if (!historyDrawerOpen) { setShowHistoryDrawer(false) } }}
        >
          {/* Drawer header */}
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <IconHistory className="w-4 h-4 text-neutral-500" />
              <h3 className="font-semibold text-neutral-900 text-sm">History</h3>
              <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 rounded-full px-1.5 py-0.5">{history.length}</span>
              <span className="text-[10px] font-medium text-neutral-400">· Max 10 articles</span>
            </div>
            <button
              onClick={() => { setHistoryDrawerOpen(false) }}
              className="text-neutral-400 hover:text-neutral-600 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
            {history.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                <IconFileText className="w-8 h-8 text-neutral-200" />
                <p className="text-sm text-neutral-400">No articles yet. Completed articles will appear here.</p>
              </div>
            )}
            {history.map((item) => {
              const isExpanded = expandedHistoryId === item.id
              return (
                <div key={item.id}>
                  {/* Row */}
                  <button
                    onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                    className="w-full p-4 flex items-start gap-3 hover:bg-neutral-50 transition text-left"
                  >
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                        <IconFileText className="w-5 h-5 text-neutral-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 line-clamp-2 leading-snug">{item.articleTitle}</p>
                      <p className="text-[10px] text-neutral-400 mt-1">{item.brand} · {relativeTime(item.timestamp)}</p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded actions */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2 animate-fade-slide-up">
                      {item.thumbnailUrl && (
                        <div className="relative rounded-xl overflow-hidden">
                          <img src={item.thumbnailUrl} alt="" className="w-full" />
                          <div className="absolute top-2 right-2">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(item.thumbnailUrl!)
                                  const blob = await res.blob()
                                  const a = document.createElement('a')
                                  a.href = URL.createObjectURL(blob)
                                  a.download = `thumbnail_${item.id}.jpg`
                                  a.click()
                                  URL.revokeObjectURL(a.href)
                                } catch { window.open(item.thumbnailUrl, '_blank') }
                              }}
                              className="px-2.5 py-1 bg-black/60 hover:bg-black/80 backdrop-blur text-white rounded-lg text-[10px] font-medium transition flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              Download
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.articleTitle)
                          setCopiedHistoryTitle(item.id)
                          setTimeout(() => setCopiedHistoryTitle(null), 2000)
                        }}
                        className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${copiedHistoryTitle === item.id ? 'border-green-200 bg-green-50 text-green-600' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}
                      >
                        {copiedHistoryTitle === item.id
                          ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                          : <>Copy Title</>
                        }
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.articleHtml)
                          setCopiedHistoryHtml(item.id)
                          setTimeout(() => setCopiedHistoryHtml(null), 2000)
                        }}
                        className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${copiedHistoryHtml === item.id ? 'bg-green-50 text-green-600' : 'bg-neutral-950 text-white hover:bg-neutral-800'}`}
                      >
                        {copiedHistoryHtml === item.id
                          ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                          : <>Copy Article Full HTML</>
                        }
                      </button>
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                        </svg>
                        <p className="text-[10px] text-amber-800 leading-relaxed">Paste into your CMS using the <span className="font-semibold">Free HTML</span> block, not the regular text editor.</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
