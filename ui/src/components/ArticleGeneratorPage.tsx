import { useState, useCallback, useEffect } from 'react'
import { useArticleGenerator } from '../hooks/useArticleGenerator'
import type {
  ArticleGeneratorState,
  ArticleGeneratorStep,
} from '../types'
import { BRANDS } from '../constants/brands'

const STEPS: { step: ArticleGeneratorStep; label: string }[] = [
  { step: 'input', label: 'Input' },
  { step: 'pick-angle', label: 'Pick Angle' },
  { step: 'review-article', label: 'Review Article' },
  { step: 'thumbnail', label: 'Thumbnail' },
  { step: 'done', label: 'Done' },
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

export function ArticleGeneratorPage() {
  const [state, setState] = useState<ArticleGeneratorState>({
    step: 'input',
    brand: '',
    links: [],
    isLoading: false,
  })

  const [productLinks, setProductLinks] = useState<string[]>([
    'https://shopee.com.my/Russell-Taylors-Digital-Low-Sugar-Rice-Cooker-(1.8L)-RC10-i.66336205.18483902789?extraParams=%7B%22display_model_id%22%3A109575560766%2C%22model_selection_logic%22%3A3%7D',
    'https://shopee.com.my/-TOP-SALE-Panasonic-1L-1.8L-2.8L-Conventional-Rice-Cooker-SR-Y10G-SR-Y18G-SR-Y18FG-SR-E28-(Periuk-Nasi-%E7%94%B5%E9%A5%AD%E9%94%A5)-i.26881612.1295853816?extraParams=%7B%22display_model_id%22%3A97650596808%2C%22model_selection_logic%22%3A3%7D',
    'https://shopee.com.my/Philips-HD4719-Spherical-Pot-Digital-Rice-Cooker-1.8L-FreshDefense-Tech-48hr-Fresh-Delicious-Rice-HD4719-32-i.175347531.29781796629?extraParams=%7B%22display_model_id%22%3A208378878980%2C%22model_selection_logic%22%3A3%7D',
  ])
  const [feedbackText, setFeedbackText] = useState('')
  const [customAngleText, setCustomAngleText] = useState('')
  const [imagePromptText, setImagePromptText] = useState('')
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showThumbnailGen, setShowThumbnailGen] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Great things coming together...')
  const [currentStep, setCurrentStep] = useState(0)
  const [articleStep, setArticleStep] = useState(0)
  const [articleLoadingMessage, setArticleLoadingMessage] = useState(ARTICLE_QUOTES[0])
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)

  const { intake, generate, thumbnailPrompt, thumbnailGenerate, isLoading, error } =
    useArticleGenerator()

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
    setShowThumbnailGen(false)
  }, [])

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

  const handleArticleApprove = useCallback(async () => {
    setState((s) => ({ ...s, step: 'thumbnail' }))
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

  const handleThumbnailGenerate = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }))

    const body = {
      brand: state.brand,
      article_title: state.articleTitle,
      clean_product_names: state.products?.map((p) => p.cleanProductName) || [],
      image_urls: state.products?.map((p) => p.imageUrl) || [],
      product_features: state.products?.map((p) => p.productFeatures).join(', ') || '',
      user_feedback: null,
    }

    const promptResult = await thumbnailPrompt(body)
    if (promptResult) {
      setImagePromptText(promptResult.image_prompt)
      setState((s) => ({
        ...s,
        imagePrompt: promptResult.image_prompt,
        isLoading: false,
      }))
      setShowThumbnailGen(true)
    } else {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Failed to generate thumbnail prompt. Please try again.',
      }))
    }
  }, [state, thumbnailPrompt])

  const handleThumbnailSkip = useCallback(() => {
    setState((s) => ({ ...s, step: 'done', thumbnailUrl: 'skipped' }))
  }, [])

  const handleThumbnailPromptSubmit = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }))
    const body = { prompt: imagePromptText.trim() }
    const result = await thumbnailGenerate(body)
    if (result) {
      setState((s) => ({
        ...s,
        thumbnailUrl: result.thumbnail_url,
        isLoading: false,
      }))
      setShowThumbnailGen(false)
    } else {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Failed to generate thumbnail. Please try again.',
      }))
    }
  }, [imagePromptText, thumbnailGenerate])

  const handleThumbnailRegenerate = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }))
    const body = { prompt: imagePromptText.trim() }
    const result = await thumbnailGenerate(body)
    if (result) {
      setState((s) => ({
        ...s,
        thumbnailUrl: result.thumbnail_url,
        isLoading: false,
      }))
    } else {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Failed to regenerate thumbnail. Please try again.',
      }))
    }
  }, [imagePromptText, thumbnailGenerate])

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950 tracking-tight">
              Shopee Article Generator
            </h1>
            <p className="text-neutral-500 mt-1 text-sm">
              Write engaging Shopee product articles from links
            </p>
            <div className="mt-4 h-[3px] w-24 rounded-full" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
          </div>
          {state.step !== 'input' && state.step !== 'done' && (
            <button
              onClick={() => setShowRestartConfirm(true)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition border border-blue-300 hover:border-blue-400 whitespace-nowrap mt-0.5"
            >
              🔄 Restart
            </button>
          )}
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
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                          ? 'bg-neutral-950 text-white'
                          : 'bg-neutral-200 text-neutral-500'
                    }`}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <p className="mt-1 text-center text-neutral-600 font-medium truncate">{s.label}</p>
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
                  className={`flex-1 ${
                    isCompleted ? 'bg-green-500' : idx === currentIdx ? 'bg-neutral-950' : 'bg-neutral-200'
                  }`}
                />
              )
            })}
          </div>
        </div>

        {/* Restart confirmation modal */}
        {showRestartConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Clear all and start over?</h3>
              <p className="text-sm text-neutral-600 mb-6">This will reset all your progress and take you back to the beginning.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleRestart}
                  className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition"
                >
                  Yes, restart
                </button>
                <button
                  onClick={() => setShowRestartConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showRevisionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Request a revision</h3>
                <p className="text-sm text-neutral-500 mt-1">Tell the editor what to change or improve.</p>
              </div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="e.g., Make the intro punchier, emphasise the price difference more..."
                className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950 resize-none"
                rows={4}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRevisionModal(false); handleArticleRevise() }}
                  disabled={!feedbackText.trim()}
                  className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm"
                >
                  Submit revision
                </button>
                <button
                  onClick={() => setShowRevisionModal(false)}
                  className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Step: Input */}
        {state.step === 'input' && (
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">Brand</label>
              <select
                value={state.brand}
                onChange={(e) => setState((s) => ({ ...s, brand: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
              >
                <option value="">Select a brand...</option>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
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
                          <span className="text-xs text-red-500">Invalid URL</span>
                        )}
                        {isFilled && isValid && <span className="text-xs text-green-500">✓</span>}
                      </div>
                      <input
                        type="text"
                        value={link}
                        onChange={(e) => handleLinkChange(idx, e.target.value)}
                        placeholder="https://shopee.com.my/product/..."
                        className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 transition ${
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
                  {filledLinks.length - validFilledLinks.length} link(s) are invalid
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
          <div className="glass-card rounded-2xl p-10 text-center space-y-6">
            <div className="text-4xl animate-search-bounce inline-block">🔍</div>
            <div className="flex justify-center gap-2">
              {LOADING_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all duration-700 ${
                    idx < currentStep
                      ? 'bg-green-500 w-4'
                      : idx === currentStep
                      ? 'bg-neutral-900 w-4 animate-pulse-strong'
                      : 'bg-neutral-200 w-2'
                  }`}
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

            {/* Products Carousel */}
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 mb-3">Products we're writing about</h2>
              <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-0 md:px-0">
                {state.products?.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedProduct(idx)}
                    className="flex-shrink-0 w-48 bg-white rounded-xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden hover:shadow-[0_4px_32px_rgba(0,0,0,0.12)] transition text-left"
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.cleanProductName}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="p-3 space-y-2">
                      <h3 className="text-xs font-semibold text-neutral-900 line-clamp-2">
                        {p.cleanProductName}
                      </h3>
                      <p className="text-sm font-bold text-neutral-950">RM {p.priceMin}</p>
                      {p.shopTypeLabel === 'Verified Seller' && (
                        <p className="text-xs text-green-600 font-medium">✓ Verified Seller</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Brand + Theme Combined */}
            {state.brand && state.overallTheme && (
              <div className="glass-card rounded-2xl p-6">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">Article Focus</p>
                <p className="text-sm font-medium text-neutral-900">
                  Writing about <span className="font-semibold text-neutral-900">"{state.overallTheme}"</span> for <span className="font-semibold text-neutral-900">{state.brand}</span>
                </p>
              </div>
            )}

            {/* Product Detail Modal */}
            {selectedProduct !== null && state.products && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-neutral-200 p-4 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-neutral-900">Product Details</h2>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="text-neutral-500 hover:text-neutral-700 text-2xl"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    <img
                      src={state.products[selectedProduct].imageUrl}
                      alt={state.products[selectedProduct].cleanProductName}
                      className="w-full aspect-square object-cover rounded-lg"
                    />

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                          {state.products[selectedProduct].cleanProductName}
                        </h3>
                        <p className="text-xl font-bold text-neutral-950">RM {state.products[selectedProduct].priceMin}</p>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">⭐ {state.products[selectedProduct].ratingStar}</span>
                        <span className="text-neutral-500">•</span>
                        <span>{state.products[selectedProduct].sales} sold</span>
                      </div>

                      <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-neutral-500 mb-1">Shop</p>
                          <p className="font-semibold text-neutral-900">{state.products[selectedProduct].shopName}</p>
                        </div>
                        {state.products[selectedProduct].shopTypeLabel && (
                          <div>
                            <p className="text-xs font-medium text-neutral-500 mb-1">Seller Status</p>
                            <p className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                              {state.products[selectedProduct].shopTypeLabel}
                            </p>
                          </div>
                        )}
                      </div>

                      {state.products[selectedProduct].productFeatures && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-neutral-900">Features</h4>
                          <p className="text-sm text-neutral-700 whitespace-pre-line">
                            {state.products[selectedProduct].productFeatures}
                          </p>
                        </div>
                      )}

                      {state.products[selectedProduct].affiliateLink && (
                        <a
                          href={state.products[selectedProduct].affiliateLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full px-4 py-3 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition text-center"
                        >
                          Check affiliate link
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content Angles */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-900">Pick an angle here</h2>
              <div className="space-y-2">
                {state.suggestedAngles?.map((angle) => {
                  const angleCategories: Record<number, { label: string; emoji: string; bgColor: string; textColor: string }> = {
                    1: { label: 'PERSONAL EXPERIENCE', emoji: '💭', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
                    2: { label: 'USE-CASE / PROBLEM-SOLVER', emoji: '🔧', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
                    3: { label: 'BUDGET VS VALUE', emoji: '💰', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
                    4: { label: 'GIFT GUIDE', emoji: '🎁', bgColor: 'bg-rose-50', textColor: 'text-rose-700' },
                    5: { label: 'THE SHORTLIST', emoji: '⭐', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
                  }
                  const categoryData = angleCategories[angle.id]
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
                      className={`w-full text-left p-4 rounded-lg border-2 transition ${
                        state.selectedAngle === angle.id
                          ? 'border-neutral-950 bg-neutral-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-bold text-neutral-500 mt-0.5">[{angle.id}]</span>
                        <div className="flex-1">
                          {categoryData && (
                            <div className={`inline-block ${categoryData.bgColor} ${categoryData.textColor} px-2.5 py-1 rounded-full text-xs font-semibold mb-2`}>
                              <span className="mr-1">{categoryData.emoji}</span>
                              {categoryData.label}
                            </div>
                          )}
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
          <div className="glass-card rounded-2xl p-10 text-center space-y-6">
            <div className="text-4xl animate-write-bounce inline-block">✏️</div>
            <div className="flex justify-center gap-2">
              {ARTICLE_LOADING_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all duration-700 ${
                    idx < articleStep
                      ? 'bg-green-500 w-4'
                      : idx === articleStep
                      ? 'bg-neutral-900 w-4 animate-pulse-strong'
                      : 'bg-neutral-200 w-2'
                  }`}
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
            {/* Article title label */}
            <div className="px-1">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Article Preview</p>
              <h2 className="text-lg font-semibold text-neutral-950">{state.articleTitle}</h2>
            </div>

            {/* Full HTML preview in iframe for style isolation */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#111;margin:0;padding:24px}img{max-width:100%;height:auto;border-radius:8px}h1,h2,h3{font-weight:700;line-height:1.3}a{color:#0055EE}table{border-collapse:collapse;width:100%}td,th{padding:8px 12px;border:1px solid #e5e5e5}p{margin:0 0 1em}</style></head><body>${state.articleHtml || ''}</body></html>`}
                className="w-full border-0"
                style={{ minHeight: '600px', height: 'auto' }}
                title="Article preview"
                onLoad={(e) => {
                  const iframe = e.currentTarget
                  try {
                    const doc = iframe.contentDocument
                    if (doc) {
                      iframe.style.height = doc.documentElement.scrollHeight + 'px'
                    }
                  } catch {
                    iframe.style.height = '700px'
                  }
                }}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
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
                Approve ✓
              </button>
            </div>
          </div>
        )}

        {/* Step: Thumbnail */}
        {state.step === 'thumbnail' && !state.thumbnailUrl && !showThumbnailGen && (
          <div className="glass-card rounded-2xl p-6 space-y-4 text-center">
            <p className="text-sm text-neutral-700">Generate a thumbnail for this article?</p>
            <div className="flex gap-2">
              <button
                onClick={handleThumbnailGenerate}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? 'Generating...' : 'Yes, generate'}
              </button>
              <button
                onClick={handleThumbnailSkip}
                className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 transition"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {state.step === 'thumbnail' && showThumbnailGen && !state.thumbnailUrl && (
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">Image Prompt</label>
              <textarea
                value={imagePromptText}
                onChange={(e) => setImagePromptText(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-950"
                rows={4}
              />
              <p className="text-xs text-neutral-500 mt-1">Edit the prompt if needed before generating</p>
            </div>

            <button
              onClick={handleThumbnailPromptSubmit}
              disabled={!imagePromptText.trim() || isLoading}
              className="w-full px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Generating...' : 'Generate Thumbnail'}
            </button>
          </div>
        )}

        {state.step === 'thumbnail' && isLoading && showThumbnailGen && (
          <div className="glass-card rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-neutral-200 border-t-neutral-950 animate-spin mx-auto" />
            <p className="text-sm font-medium text-neutral-900">Generating thumbnail...</p>
          </div>
        )}

        {state.step === 'thumbnail' && state.thumbnailUrl && state.thumbnailUrl !== 'skipped' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-6">
              <img
                src={state.thumbnailUrl}
                alt="Generated thumbnail"
                className="w-full rounded-lg mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleThumbnailRegenerate}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? 'Regenerating...' : 'Regenerate'}
                </button>
                <button
                  onClick={() => setState((s) => ({ ...s, step: 'done' }))}
                  className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {state.step === 'done' && (
          <div className="space-y-4 animate-fade-slide-up">
            {/* Success banner */}
            <div className="glass-card rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-neutral-900">Article ready!</p>
                <p className="text-sm text-neutral-500 mt-0.5">{state.articleTitle}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(state.articleHtml || '')
                }}
                className="w-full px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition text-sm"
              >
                Copy HTML
              </button>
            </div>

            {/* Thumbnail if generated */}
            {state.thumbnailUrl && state.thumbnailUrl !== 'skipped' && (
              <div className="glass-card rounded-2xl p-4 space-y-3">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Thumbnail</p>
                <img
                  src={state.thumbnailUrl}
                  alt="Article thumbnail"
                  className="w-full rounded-lg"
                />
                <a
                  href={state.thumbnailUrl}
                  download="thumbnail.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-sm font-medium text-center hover:bg-neutral-50 transition"
                >
                  Download thumbnail
                </a>
              </div>
            )}

            <button
              onClick={handleRestart}
              className="w-full px-4 py-2.5 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition text-sm"
            >
              Start another article
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
