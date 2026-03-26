import { useState, useCallback } from 'react'
import { useArticleGenerator } from '../hooks/useArticleGenerator'
import type {
  ArticleGeneratorState,
  ArticleGeneratorStep,
  BrandVoice,
  Product,
  SuggestedAngle,
} from '../types'
import { BRANDS } from '../constants/brands'

const STEPS: { step: ArticleGeneratorStep; label: string }[] = [
  { step: 'input', label: 'Input' },
  { step: 'processing', label: 'Processing' },
  { step: 'angle-selection', label: 'Pick Angle' },
  { step: 'writing', label: 'Writing' },
  { step: 'article', label: 'Article' },
  { step: 'thumbnail-choice', label: 'Thumbnail' },
  { step: 'thumbnail-prompt', label: 'Prompt' },
  { step: 'thumbnail-result', label: 'Result' },
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

export function ArticleGeneratorPage() {
  const [state, setState] = useState<ArticleGeneratorState>({
    step: 'input',
    brand: '',
    links: [],
    isLoading: false,
  })

  const [productLinks, setProductLinks] = useState<string[]>(['', '', ''])
  const [feedbackText, setFeedbackText] = useState('')
  const [customAngleText, setCustomAngleText] = useState('')
  const [imagePromptText, setImagePromptText] = useState('')
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)

  const { intake, generate, thumbnailPrompt, thumbnailGenerate, isLoading, error } =
    useArticleGenerator()

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

    setState((s) => ({ ...s, step: 'processing', links: filledLinks, isLoading: true }))

    const result = await intake(state.brand, filledLinks)
    if (result) {
      setState((s) => ({
        ...s,
        step: 'angle-selection',
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

    setState((s) => ({ ...s, step: 'writing', isLoading: true }))

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
        step: 'article',
        articleHtml: result.article_html,
        articleTitle: result.article_title,
        isLoading: false,
      }))
    } else {
      setState((s) => ({
        ...s,
        step: 'angle-selection',
        isLoading: false,
        error: 'Failed to generate article. Please try again.',
      }))
    }
  }, [state, generate])

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

  const handleThumbnailYes = useCallback(async () => {
    setState((s) => ({ ...s, step: 'thumbnail-prompt', isLoading: true }))

    const body = {
      brand: state.brand,
      article_title: state.articleTitle,
      clean_product_names: state.products?.map((p) => p.cleanProductName) || [],
      image_urls: state.products?.map((p) => p.imageUrl) || [],
      product_features: state.products?.map((p) => p.productFeatures).join(', ') || '',
      user_feedback: null,
    }

    const result = await thumbnailPrompt(body)
    if (result) {
      setState((s) => ({
        ...s,
        imagePrompt: result.image_prompt,
        isLoading: false,
      }))
      setImagePromptText(result.image_prompt)
    } else {
      setState((s) => ({
        ...s,
        step: 'thumbnail-choice',
        isLoading: false,
        error: 'Failed to generate thumbnail prompt. Please try again.',
      }))
    }
  }, [state, thumbnailPrompt])

  const handleThumbnailSkip = useCallback(() => {
    setState((s) => ({ ...s, step: 'thumbnail-result', thumbnailUrl: 'skipped' }))
  }, [])

  const handleThumbnailGenerate = useCallback(async () => {
    setState((s) => ({ ...s, step: 'thumbnail-result', isLoading: true }))

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
        step: 'thumbnail-prompt',
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
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-neutral-950 tracking-tight">
            Shopee Article Generator
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Write engaging Shopee product articles from links
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8 bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-4">
          <div className="flex justify-between items-center overflow-x-auto">
            {STEPS.map((s, idx) => {
              const currentIdx = getCurrentStepIndex()
              const isCompleted = idx < currentIdx
              const isActive = idx === currentIdx
              return (
                <div key={s.step} className="flex items-center flex-1 min-w-max">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                          ? 'bg-neutral-950 text-white'
                          : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        isCompleted ? 'bg-green-500' : 'bg-neutral-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Restart button (hidden on input step) */}
        {state.step !== 'input' && (
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => setShowRestartConfirm(true)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition"
            >
              Restart
            </button>
          </div>
        )}

        {/* Restart confirmation */}
        {showRestartConfirm && (
          <div className="mb-6 bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <p className="text-sm text-neutral-700 mb-3">Clear all and start over?</p>
            <div className="flex gap-2">
              <button
                onClick={handleRestart}
                className="text-xs font-medium px-3 py-1.5 bg-neutral-950 text-white rounded-lg hover:bg-neutral-800 transition"
              >
                Yes, restart
              </button>
              <button
                onClick={() => setShowRestartConfirm(false)}
                className="text-xs font-medium px-3 py-1.5 bg-neutral-200 text-neutral-950 rounded-lg hover:bg-neutral-300 transition"
              >
                Cancel
              </button>
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
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-6">
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
                const isRequired = idx < 3
                const isValid = link.trim() === '' || isValidShopeeLink(link)
                const isFilled = link.trim() !== ''

                return (
                  <div key={idx} className="flex gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-xs font-medium text-neutral-700">
                          Product {idx + 1}
                          {isRequired && <span className="text-red-500">*</span>}
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

        {/* Step: Processing */}
        {state.step === 'processing' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-3 border-neutral-200 border-t-neutral-950 animate-spin mx-auto" />
            <p className="text-sm font-medium text-neutral-900">Analyzing products...</p>
            <p className="text-xs text-neutral-500">Fetching product data and generating content angles</p>
          </div>
        )}

        {/* Step: Angle Selection */}
        {state.step === 'angle-selection' && (
          <div className="space-y-6">
            {/* Products */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
              <h2 className="text-sm font-semibold text-neutral-900 mb-4">Products</h2>
              <div className="space-y-3">
                {state.products?.map((p) => (
                  <div
                    key={p.cleanProductName}
                    className="flex gap-3 p-3 bg-neutral-50 rounded-lg"
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.cleanProductName}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {p.cleanProductName}
                      </p>
                      <p className="text-xs text-neutral-500">${p.priceMin}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Angles */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
              <h2 className="text-sm font-semibold text-neutral-900 mb-4">Content Angles</h2>
              <div className="space-y-2 mb-4">
                {state.suggestedAngles?.map((angle) => (
                  <button
                    key={angle.id}
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        selectedAngle: angle.id,
                        customAngle: undefined,
                      }))
                    }
                    className={`w-full text-left p-3 rounded-lg border-2 transition ${
                      state.selectedAngle === angle.id
                        ? 'border-neutral-950 bg-neutral-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <p className="text-sm font-medium text-neutral-900">{angle.title}</p>
                    <p className="text-xs text-neutral-500 mt-1">{angle.description}</p>
                  </button>
                ))}
              </div>

              {/* Custom angle */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-2">
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
                className="w-full mt-4 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? 'Writing...' : 'Write Article'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Writing */}
        {state.step === 'writing' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-3 border-neutral-200 border-t-neutral-950 animate-spin mx-auto" />
            <p className="text-sm font-medium text-neutral-900">Writing your article...</p>
          </div>
        )}

        {/* Step: Article */}
        {state.step === 'article' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
              <h2 className="text-sm font-semibold text-neutral-900 mb-4">{state.articleTitle}</h2>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: state.articleHtml || '' }}
              />
            </div>

            {/* Revision form */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-900 mb-2">
                  Request revision (optional)
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="e.g., Make it more casual, emphasize durability, add price comparison..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleArticleRevise}
                  disabled={!feedbackText.trim() || isLoading}
                  className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? 'Revising...' : 'Revise'}
                </button>
                <button
                  onClick={() => setState((s) => ({ ...s, step: 'thumbnail-choice' }))}
                  className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Thumbnail Choice */}
        {state.step === 'thumbnail-choice' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4 text-center">
            <p className="text-sm text-neutral-700">Generate a thumbnail for this article?</p>
            <div className="flex gap-2">
              <button
                onClick={handleThumbnailYes}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Yes, generate
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

        {/* Step: Thumbnail Prompt */}
        {state.step === 'thumbnail-prompt' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
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
              onClick={handleThumbnailGenerate}
              disabled={!imagePromptText.trim() || isLoading}
              className="w-full px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Generating...' : 'Generate Thumbnail'}
            </button>
          </div>
        )}

        {/* Step: Thumbnail Result */}
        {state.step === 'thumbnail-result' && state.thumbnailUrl !== 'skipped' && (
          <div className="space-y-4">
            {state.thumbnailUrl && isLoading === false && (
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
                <img
                  src={state.thumbnailUrl}
                  alt="Generated thumbnail"
                  className="w-full rounded-lg mb-4"
                />
                <button
                  onClick={handleThumbnailRegenerate}
                  disabled={isLoading}
                  className="w-full px-4 py-2 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Regenerate
                </button>
              </div>
            )}

            {isLoading && (
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full border-3 border-neutral-200 border-t-neutral-950 animate-spin mx-auto" />
                <p className="text-sm font-medium text-neutral-900">Generating thumbnail...</p>
              </div>
            )}

            <button
              onClick={handleRestart}
              className="w-full px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition"
            >
              Done! Start over
            </button>
          </div>
        )}

        {/* Step: Thumbnail Result (Skipped) */}
        {state.step === 'thumbnail-result' && state.thumbnailUrl === 'skipped' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 text-center space-y-4">
            <p className="text-sm text-neutral-700">Article complete!</p>
            <button
              onClick={handleRestart}
              className="w-full px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition"
            >
              Start another article
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
