import { useState, useCallback } from 'react'
import { useArticleGenerator } from '../hooks/useArticleGenerator'

export function ArticlePage() {
  const {
    state,
    products,
    angles,
    context,
    articleHtml,
    articleTitle,
    thumbnailPrompt,
    thumbnailUrl,
    errorMessage,
    processProducts,
    generateArticle,
    reviseArticle,
    prepareThumbnail,
    generateThumbnail,
    reviseThumbnail,
    finish,
    reset,
    isLoading,
  } = useArticleGenerator()

  // Form inputs
  const [brand, setBrand] = useState('')
  const [shopeeLinksText, setShopeeLinksText] = useState('')
  const [selectedAngleIndex, setSelectedAngleIndex] = useState<number | null>(null)
  const [useCustomAngle, setUseCustomAngle] = useState(false)
  const [customAngleTitle, setCustomAngleTitle] = useState('')
  const [customAngleDesc, setCustomAngleDesc] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [editedPrompt, setEditedPrompt] = useState('')
  const [expandProducts, setExpandProducts] = useState(false)
  const [showThumbnailFeedback, setShowThumbnailFeedback] = useState(false)
  const [thumbnailFeedback, setThumbnailFeedback] = useState('')

  const handleProcessProducts = useCallback(async () => {
    const links = shopeeLinksText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    await processProducts(brand, links)
  }, [brand, shopeeLinksText, processProducts])

  const handleGenerateArticle = useCallback(async () => {
    if (useCustomAngle) {
      const customAngle = `${customAngleTitle}\n${customAngleDesc}`
      await generateArticle(customAngle)
    } else if (selectedAngleIndex !== null) {
      await generateArticle((selectedAngleIndex + 1).toString())
    }
  }, [useCustomAngle, selectedAngleIndex, customAngleTitle, customAngleDesc, generateArticle])

  const handleRevise = useCallback(async () => {
    await reviseArticle(feedbackText)
    setFeedbackText('')
    setShowFeedback(false)
  }, [feedbackText, reviseArticle])

  const handleGenerateThumbnail = useCallback(async () => {
    const finalPrompt = editedPrompt.trim() || thumbnailPrompt
    await generateThumbnail(finalPrompt)
  }, [editedPrompt, thumbnailPrompt, generateThumbnail])

  const handleReviseThumbnail = useCallback(async () => {
    await reviseThumbnail(thumbnailFeedback)
    setThumbnailFeedback('')
    setShowThumbnailFeedback(false)
  }, [thumbnailFeedback, reviseThumbnail])

  const handleDownloadThumbnail = useCallback(async () => {
    if (!thumbnailUrl) return
    try {
      const response = await fetch(thumbnailUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `thumbnail-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }, [thumbnailUrl])

  const handleCopyHtml = useCallback(() => {
    navigator.clipboard.writeText(articleHtml)
  }, [articleHtml])

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-0 px-4 md:px-8 py-8">
      <main className="flex-1 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shopee Article Generator</h1>
          <p className="text-gray-500 mt-1">Create affiliate articles with AI-written drafts and auto-generated thumbnails</p>
        </div>

        {/* Error state */}
        {state === 'error' && (
          <div className="mb-6 bg-white rounded-2xl shadow-sm border border-red-200 p-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-700">Error</p>
                <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
                <button
                  onClick={reset}
                  className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition"
                >
                  Start over
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Idle: Input form */}
        {state === 'idle' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Brand</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g., Samsung, Apple, Lenovo"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Shopee Links</label>
                <p className="text-xs text-gray-500 mb-2">Paste one link per line</p>
                <textarea
                  value={shopeeLinksText}
                  onChange={(e) => setShopeeLinksText(e.target.value)}
                  placeholder="https://shopee.sg/product/123/456&#10;https://shopee.sg/product/789/012"
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              <button
                onClick={handleProcessProducts}
                disabled={isLoading || !brand.trim() || !shopeeLinksText.trim()}
                className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition"
              >
                {isLoading ? 'Analyzing…' : 'Analyze & Generate Angles'}
              </button>
            </div>
          </div>
        )}

        {/* Processing products */}
        {state === 'processing_products' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mx-auto mb-4" />
            <p className="font-semibold text-gray-700">Fetching product data…</p>
            <p className="text-sm text-gray-500 mt-2">Analyzing and generating content angles</p>
          </div>
        )}

        {/* Angle selection */}
        {state === 'angle_selection' && (
          <div className="space-y-6">
            {/* Product summary badge */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <button
                onClick={() => setExpandProducts(!expandProducts)}
                className="w-full flex items-center justify-between"
              >
                <div className="text-left">
                  <p className="font-semibold text-blue-900">
                    {products.length} product{products.length !== 1 ? 's' : ''} found
                  </p>
                  <p className="text-sm text-blue-700">{context?.brand}</p>
                </div>
                <svg
                  className={`w-5 h-5 text-blue-700 transition ${expandProducts ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>

              {expandProducts && (
                <div className="mt-4 pt-4 border-t border-blue-200 space-y-2">
                  {products.map((p, i) => (
                    <div key={i} className="text-sm text-blue-900">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-blue-700">★ {p.rating} • {p.price}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Angles */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose a content angle or write your own</h2>

              {/* AI angles */}
              <div className="space-y-3 mb-6">
                {angles.map((angle, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedAngleIndex(i)
                      setUseCustomAngle(false)
                    }}
                    className={`w-full text-left p-4 rounded-lg border-2 transition ${
                      selectedAngleIndex === i && !useCustomAngle
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold text-gray-900">{angle.title}</p>
                    <p className="inline-block mt-2 px-2 py-1 bg-gray-200 text-xs font-medium text-gray-700 rounded">
                      {angle.category}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">{angle.game_plan}</p>
                  </button>
                ))}
              </div>

              {/* Custom angle toggle */}
              <div className="border-t border-gray-200 pt-6">
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={useCustomAngle}
                    onChange={(e) => {
                      setUseCustomAngle(e.target.checked)
                      if (e.target.checked) setSelectedAngleIndex(null)
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="font-medium text-gray-700">Write my own angle</span>
                </label>

                {useCustomAngle && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Article Title Idea</label>
                      <input
                        type="text"
                        value={customAngleTitle}
                        onChange={(e) => setCustomAngleTitle(e.target.value)}
                        placeholder="e.g., The Best Wireless Earbuds Under $100"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Article Description</label>
                      <textarea
                        value={customAngleDesc}
                        onChange={(e) => setCustomAngleDesc(e.target.value)}
                        placeholder="Describe the angle and what the article should cover…"
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action button */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleGenerateArticle}
                  disabled={
                    isLoading ||
                    (useCustomAngle && (!customAngleTitle.trim() || !customAngleDesc.trim())) ||
                    (!useCustomAngle && selectedAngleIndex === null)
                  }
                  className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition"
                >
                  {isLoading ? 'Generating…' : 'Write Article'}
                </button>
                <button
                  onClick={reset}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generating article */}
        {state === 'generating_article' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mx-auto mb-4" />
            <p className="font-semibold text-gray-700">Writing your article…</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few minutes</p>
          </div>
        )}

        {/* Review draft */}
        {state === 'review_draft' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              {/* Article title */}
              <h1 className="text-4xl font-bold text-gray-900 mb-8">{articleTitle}</h1>

              {/* HTML preview */}
              <div className="prose prose-sm max-w-none mb-8 pb-8 border-b border-gray-200">
                <div
                  dangerouslySetInnerHTML={{ __html: articleHtml }}
                  className="text-gray-700 leading-relaxed"
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleCopyHtml}
                  className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition"
                >
                  Copy HTML
                </button>
                <button
                  onClick={() => prepareThumbnail()}
                  className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition"
                >
                  Approve & Generate Thumbnail
                </button>
                <button
                  onClick={() => setShowFeedback(!showFeedback)}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
                >
                  Suggest Changes
                </button>
              </div>

              {/* Feedback input */}
              {showFeedback && (
                <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      What would you like to change?
                    </label>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="E.g., Make the intro shorter, add more comparisons…"
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRevise}
                      disabled={isLoading || !feedbackText.trim()}
                      className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition"
                    >
                      {isLoading ? 'Revising…' : 'Revise Article'}
                    </button>
                    <button
                      onClick={() => setShowFeedback(false)}
                      className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Revising article */}
        {state === 'revising_article' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mx-auto mb-4" />
            <p className="font-semibold text-gray-700">Revising your article…</p>
          </div>
        )}

        {/* Thumbnail prompt */}
        {state === 'thumbnail_prompt' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Generate Thumbnail</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Image Prompt</label>
                <p className="text-xs text-gray-500 mb-2">Review and edit if needed</p>
                <textarea
                  value={editedPrompt || thumbnailPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleGenerateThumbnail}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition"
                >
                  {isLoading ? 'Generating…' : 'Generate Thumbnail'}
                </button>
                <button
                  onClick={() => {
                    finish()
                  }}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
                >
                  Skip Thumbnail
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generating thumbnail */}
        {state === 'generating_thumbnail' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mx-auto mb-4" />
            <p className="font-semibold text-gray-700">Generating 16:9 thumbnail…</p>
            <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
          </div>
        )}

        {/* Thumbnail result */}
        {state === 'thumbnail_result' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="space-y-6">
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={thumbnailUrl}
                  alt="Generated thumbnail"
                  className="w-full h-auto"
                  style={{ aspectRatio: '16 / 9' }}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleDownloadThumbnail}
                  className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition"
                >
                  Download
                </button>
                <button
                  onClick={() => setShowThumbnailFeedback(!showThumbnailFeedback)}
                  className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => finish()}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
                >
                  Finish
                </button>
              </div>

              {/* Thumbnail feedback */}
              {showThumbnailFeedback && (
                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      What would you like to change?
                    </label>
                    <textarea
                      value={thumbnailFeedback}
                      onChange={(e) => setThumbnailFeedback(e.target.value)}
                      placeholder="E.g., Make it brighter, add more product focus, change background…"
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleReviseThumbnail}
                      disabled={isLoading || !thumbnailFeedback.trim()}
                      className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-semibold transition"
                    >
                      {isLoading ? 'Refining…' : 'Regenerate with Feedback'}
                    </button>
                    <button
                      onClick={() => setShowThumbnailFeedback(false)}
                      className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Done state */}
        {state === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <svg
                  className="w-6 h-6 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-lg">All done!</p>
                {articleTitle && <p className="text-gray-600 mt-2">{articleTitle}</p>}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row pt-6">
                {articleHtml && (
                  <button
                    onClick={handleCopyHtml}
                    className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition"
                  >
                    Copy Article HTML
                  </button>
                )}
                {thumbnailUrl && (
                  <button
                    onClick={handleDownloadThumbnail}
                    className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition"
                  >
                    Download Thumbnail
                  </button>
                )}
              </div>

              <button
                onClick={reset}
                className="w-full mt-6 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
              >
                Start New Article
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
