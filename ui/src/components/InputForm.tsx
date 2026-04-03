import { type FormEvent, useState } from 'react'
import { BRANDS, DOMAIN_TO_BRAND, detectBrandFromUrl, detectBrandInfoFromUrl } from '../constants/brands'
import type { TitleMode, CaptionTitleMode } from '../types'

interface InputFormProps {
  url: string
  onUrlChange: (url: string) => void
  brand: string
  onBrandChange: (brand: string) => void
  titleMode: TitleMode
  onTitleModeChange: (mode: TitleMode) => void
  customTitle: string
  onCustomTitleChange: (title: string) => void
  captionTitleMode: CaptionTitleMode
  onCaptionTitleModeChange: (mode: CaptionTitleMode) => void
  onSubmit: () => void
  disabled?: boolean
}

export function InputForm({
  url,
  onUrlChange,
  brand,
  onBrandChange,
  titleMode,
  onTitleModeChange,
  customTitle,
  onCustomTitleChange,
  captionTitleMode,
  onCaptionTitleModeChange,
  onSubmit,
  disabled,
}: InputFormProps) {
  const [showSupportedSites, setShowSupportedSites] = useState(false)

  // Track whether the URL itself was auto-detected (separate from manually selected brand)
  const detectedBrand = url ? detectBrandFromUrl(url) : null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    if (!brand) return
    onSubmit()
  }

  function handleUrlChange(newUrl: string) {
    onUrlChange(newUrl)
    const detected = detectBrandFromUrl(newUrl)
    if (detected) onBrandChange(detected)
    // English Stadium Astro → auto-select AI for both title modes
    const info = detectBrandInfoFromUrl(newUrl)
    if (info?.brand === 'Stadium Astro' && info?.language === 'EN') {
      onTitleModeChange('ai')
      onCaptionTitleModeChange('ai')
    } else {
      onTitleModeChange('original')
      onCaptionTitleModeChange('original')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>

      {/* URL input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Article URL
          </label>
          <button
            type="button"
            onClick={() => setShowSupportedSites(true)}
            className="text-neutral-500 hover:text-neutral-800 underline text-xs font-medium transition"
            title="Check supported domains"
          >
            Check supported domains
          </button>
        </div>
        <div className="relative">
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://www.astroawani.com/..."
            disabled={disabled}
            required
            className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 transition"
          />
          {url && (
            <button
              type="button"
              onClick={() => handleUrlChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {url && detectedBrand && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-700 animate-slide-down">
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{detectedBrand} detected</span>
          </div>
        )}
        {url && !detectedBrand && (
          <div className="mt-2 text-xs text-red-500 animate-slide-down">
            Domain not supported — check the list of supported websites
          </div>
        )}
      </div>

      {/* Brand selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Brand To Generate For
        </label>
        <div className="relative">
          <select
            value={brand}
            onChange={(e) => {
              const newBrand = e.target.value
              onBrandChange(newBrand)
              // If manually selected brand doesn't match URL domain, pre-select AI; otherwise Original
              if (detectedBrand && newBrand !== detectedBrand) {
                onTitleModeChange('ai')
                onCaptionTitleModeChange('ai')
              } else {
                onTitleModeChange('original')
                onCaptionTitleModeChange('original')
              }
            }}
            disabled={disabled}
            required
            className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 bg-white transition appearance-none cursor-pointer"
          >
            <option value="">Select a brand...</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Image title control */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Image Title
        </label>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['original', 'ai', 'custom'] as const).map((tm) => (
            <button
              key={tm}
              type="button"
              onClick={() => onTitleModeChange(tm)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                titleMode === tm
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tm === 'original' ? 'Original' : tm === 'ai' ? 'AI ✨' : 'Custom'}
            </button>
          ))}
        </div>

        <p className="mt-2 text-xs text-gray-500">
          {titleMode === 'original' && "Uses the article's headline as-is"}
          {titleMode === 'ai' && "AI generates the headline according to your brand voice"}
          {titleMode === 'custom' && "Enter your custom headline below"}
        </p>

        {titleMode === 'custom' && (
          <input
            type="text"
            value={customTitle}
            onChange={(e) => onCustomTitleChange(e.target.value)}
            placeholder="Enter custom title"
            className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          />
        )}
      </div>

      {/* Caption title control */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Caption Title
        </label>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['original', 'ai'] as const).map((ctm) => (
            <button
              key={ctm}
              type="button"
              onClick={() => onCaptionTitleModeChange(ctm)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                captionTitleMode === ctm
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {ctm === 'original' ? 'Original' : 'AI ✨'}
            </button>
          ))}
        </div>

        <p className="mt-2 text-xs text-gray-500">
          {captionTitleMode === 'original' && "Uses the article's headline in the caption"}
          {captionTitleMode === 'ai' && "AI rewrites the headline in the caption"}
        </p>
      </div>

      {/* Generate button */}
      <button
        type="submit"
        disabled={disabled || !url.trim() || !brand || !detectedBrand || (titleMode === 'custom' && !customTitle.trim())}
        className="w-full py-3 px-6 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-medium rounded-xl transition text-sm active:scale-[0.98]"
      >
        Generate Facebook Post Asset
      </button>

      {/* Supported sites modal */}
      {showSupportedSites && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setShowSupportedSites(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-lg p-6 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Supported websites</h3>
              <button
                type="button"
                onClick={() => setShowSupportedSites(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(DOMAIN_TO_BRAND).map(([domain, info]) => (
                <div key={domain} className="text-sm text-gray-700">
                  • <span className="font-medium">{info.brand}</span>{' '}
                  <a
                    href={`https://${domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    ({domain})
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
