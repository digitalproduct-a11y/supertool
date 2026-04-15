import { useState } from 'react'
import type { SocialAffiliateFormData } from '../types'

const TONE_OPTIONS = [
  { value: 'problem-solution', label: 'Problem–Solution' },
  { value: 'soft-sell', label: 'Soft Sell' },
  { value: 'hard-sell', label: 'Hard Sell' },
  { value: 'casual-rojak', label: 'Casual / Rojak' },
  { value: 'friendly-recommendation', label: 'Friendly Recommendation' },
]

const BRAND_OPTIONS = [
  { value: 'stadiumastro', label: 'Stadium Astro' },
  { value: 'astroarena', label: 'Astro Arena' },
  { value: 'astroawani', label: 'Astro Awani' },
  { value: 'astroulagam', label: 'Astro Ulagam' },
  { value: 'sinar', label: 'Sinar' },
  { value: 'era', label: 'Era' },
  { value: 'hitz', label: 'Hitz' },
  { value: 'mix', label: 'Mix' },
  { value: 'raaga', label: 'Raaga' },
  { value: 'meletop', label: 'Meletop' },
]

interface SocialAffiliateInputFormProps {
  onSubmit: (data: SocialAffiliateFormData) => void
  isLoading: boolean
  initialData?: Partial<SocialAffiliateFormData>
  onFetchName: (link: string) => Promise<string>
}

const inputClass = 'w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent placeholder:text-neutral-400 bg-white'
const labelClass = 'block text-xs font-medium text-neutral-700 mb-1'
const selectClass = 'w-full px-3 py-2 pr-8 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer'

export function SocialAffiliateInputForm({
  onSubmit,
  isLoading,
  initialData,
  onFetchName,
}: SocialAffiliateInputFormProps) {
  const [formData, setFormData] = useState<SocialAffiliateFormData>({
    productName: initialData?.productName || '',
    affiliateLink: initialData?.affiliateLink || '',
    angle: initialData?.angle || '',
    targetAudience: initialData?.targetAudience || '',
    tone: initialData?.tone || '',
    brand: initialData?.brand || 'stadiumastro',
  })
  const [fetchingName, setFetchingName] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const isValid =
    formData.affiliateLink.trim() &&
    formData.angle.trim() &&
    formData.targetAudience.trim() &&
    formData.tone.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid) onSubmit(formData)
  }

  const handleClear = () => {
    setFormData({ productName: '', affiliateLink: '', angle: '', targetAudience: '', tone: '', brand: 'stadiumastro' })
    setFetchError(null)
  }

  const handleFetchName = async () => {
    if (!formData.affiliateLink.trim()) {
      setFetchError('Please paste a product link first')
      return
    }
    setFetchingName(true)
    setFetchError(null)
    try {
      const name = await onFetchName(formData.affiliateLink)
      setFormData((prev) => ({ ...prev, productName: name }))
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch product name')
    } finally {
      setFetchingName(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Shopee Product Link + Fetch Name */}
      <div>
        <label className={labelClass}>Shopee Product Link</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={formData.affiliateLink}
            onChange={(e) => setFormData((prev) => ({ ...prev, affiliateLink: e.target.value }))}
            placeholder="https://shopee.com/..."
            className={inputClass + ' flex-1'}
          />
          <button
            type="button"
            onClick={handleFetchName}
            disabled={fetchingName || !formData.affiliateLink.trim()}
            className="px-3 py-2 text-sm font-semibold border border-neutral-200 rounded-lg bg-white text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {fetchingName ? 'Fetching...' : 'Fetch Name'}
          </button>
        </div>
        {fetchError && <p className="mt-1 text-xs text-red-500">{fetchError}</p>}
      </div>

      {/* Product Name */}
      <div>
        <label className={labelClass}>Product Name</label>
        <input
          type="text"
          value={formData.productName}
          onChange={(e) => setFormData((prev) => ({ ...prev, productName: e.target.value }))}
          placeholder="e.g., Xiaomi Smart Desk Fan 30cm"
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-neutral-400">Auto-extracted or edit manually</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Content Angle */}
        <div>
          <label className={labelClass}>Content Angle</label>
          <textarea
            value={formData.angle}
            onChange={(e) => setFormData((prev) => ({ ...prev, angle: e.target.value }))}
            placeholder="e.g., bilik panas dan ruang kecil"
            rows={2}
            className={inputClass + ' resize-none'}
          />
        </div>

        {/* Target Audience */}
        <div>
          <label className={labelClass}>Target Audience</label>
          <textarea
            value={formData.targetAudience}
            onChange={(e) => setFormData((prev) => ({ ...prev, targetAudience: e.target.value }))}
            placeholder="e.g., student dan orang bujang"
            rows={2}
            className={inputClass + ' resize-none'}
          />
        </div>

        {/* Tone */}
        <div className="relative">
          <label className={labelClass}>Tone</label>
          <select
            value={formData.tone}
            onChange={(e) => setFormData((prev) => ({ ...prev, tone: e.target.value }))}
            className={selectClass}
          >
            <option value="" disabled>Select Tone</option>
            {TONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-[26px] text-neutral-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Brand */}
        <div className="relative">
          <label className={labelClass}>Brand</label>
          <select
            value={formData.brand}
            onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
            className={selectClass}
          >
            {BRAND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-[26px] text-neutral-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={isLoading}
          className="flex-1 py-2.5 px-4 text-sm font-semibold border border-neutral-200 rounded-xl bg-white text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear Form
        </button>
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Generating...' : 'Generate Content'}
        </button>
      </div>
    </form>
  )
}
