import { useEffect, useState } from 'react'
import { useSocialAffiliatePosting } from '../hooks/useSocialAffiliatePosting'
import type { SocialAffiliateFormData } from '../types'
import { SocialAffiliateInputForm } from './SocialAffiliateInputForm'
import { SocialAffiliateResultsMeta } from './SocialAffiliateResultsMeta'
import { SocialAffiliateThreadsSection } from './SocialAffiliateThreadsSection'
import { SocialAffiliateFacebookSection } from './SocialAffiliateFacebookSection'
import { Spinner } from './ds/Spinner'

const LOADING_MESSAGES = [
  'Tengah cari info produk...',
  'AI sedang tulis content untuk Threads...',
  'Menyiapkan post Facebook...',
  'Menjana affiliate link...',
  'Hampir siap...',
]

const TONE_OPTIONS = [
  { value: 'problem-solution', label: 'Problem–Solution' },
  { value: 'soft-sell', label: 'Soft Sell' },
  { value: 'hard-sell', label: 'Hard Sell' },
  { value: 'casual-rojak', label: 'Casual / Rojak' },
  { value: 'friendly-recommendation', label: 'Friendly Recommendation' },
]

export function SocialAffiliatePostingPage() {
  const { state, result, error, formData, generate, extractProductName, reset } = useSocialAffiliatePosting()
  const [messageIndex, setMessageIndex] = useState(0)
  const [regenData, setRegenData] = useState<SocialAffiliateFormData | null>(null)

  useEffect(() => {
    if (state !== 'loading') return
    setMessageIndex(0)
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [state])

  useEffect(() => {
    if (state === 'success' && formData) {
      setRegenData({ ...formData })
    }
  }, [state, formData])

  const handleCopyAffiliateLink = (link: string) => {
    navigator.clipboard.writeText(link).catch(() => {
      // fallback: select + execCommand (legacy browsers)
      const el = document.getElementById('sa-affiliate-link-input') as HTMLInputElement | null
      if (el) { el.select(); document.execCommand('copy') }
    })
  }

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Social Affiliate Posting</h1>
          <p className="text-neutral-500 mt-1 text-sm">Generate Threads and Facebook content for Shopee affiliate products</p>
          <div className="mt-3 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* IDLE — show form */}
        {state === 'idle' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
              <SocialAffiliateInputForm
                onSubmit={generate}
                isLoading={false}
                onFetchName={extractProductName}
              />
            </div>
          </div>
        )}

        {/* LOADING */}
        {state === 'loading' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 flex flex-col items-center gap-5">
              <Spinner />
              <p className="text-sm text-neutral-500 text-center transition-all duration-500">
                {LOADING_MESSAGES[messageIndex]}
              </p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {state === 'error' && (
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-red-900 mb-1">Generation failed</h2>
              <p className="text-sm text-red-700 mb-4">{error}</p>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition"
              >
                Try Again
              </button>
            </div>
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
                <p className="text-sm font-semibold text-neutral-700 mb-4">Retry with different values</p>
                <SocialAffiliateInputForm
                  onSubmit={generate}
                  isLoading={false}
                  initialData={formData || undefined}
                  onFetchName={extractProductName}
                />
              </div>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {state === 'success' && result && formData && regenData && (
          <div className="space-y-6 pb-20">
            {/* Meta summary */}
            <SocialAffiliateResultsMeta data={result} brand={formData.brand} />

            {/* Threads + Facebook — two column */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Threads */}
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
                <div className="bg-neutral-950 px-6 py-4 flex items-center gap-3">
                  <img src="/threads logo white.png" alt="Threads" className="w-5 h-5" />
                  <h2 className="text-base font-semibold text-white">Threads</h2>
                </div>
                <div className="p-6">
                  <SocialAffiliateThreadsSection data={result.threads} hideTitle={true} />
                </div>
              </div>

              {/* Facebook */}
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center gap-3">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <h2 className="text-base font-semibold text-white">Facebook</h2>
                </div>
                <div className="p-6">
                  <SocialAffiliateFacebookSection data={result.facebook} hideTitle={true} />
                </div>
              </div>
            </div>

            {/* Affiliate Link */}
            {result.affiliateLinkGenerated && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-green-900 mb-3">Your Affiliate Link</h3>
                <div className="flex items-center gap-3">
                  <input
                    id="sa-affiliate-link-input"
                    type="text"
                    value={result.affiliateLinkGenerated}
                    readOnly
                    className="flex-1 px-3 py-2 border border-green-300 rounded-lg bg-white text-green-900 font-mono text-sm focus:outline-none"
                  />
                  <CopyButton text={result.affiliateLinkGenerated} onCopy={handleCopyAffiliateLink} />
                </div>
              </div>
            )}

            {/* Thumbnail */}
            {result.thumbnailUrl && (
              <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-neutral-900 mb-4">AI-Generated Thumbnail</h3>
                <img
                  src={result.thumbnailUrl}
                  alt={result.productName}
                  className="w-full rounded-xl shadow-md mb-4"
                />
                <a
                  href={result.thumbnailUrl}
                  download={`${result.productName}-thumbnail.png`}
                  className="inline-block px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-semibold rounded-xl transition"
                >
                  Download Thumbnail
                </a>
              </div>
            )}

            {/* Quick Regenerate */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-1">Quick Regenerate</h3>
              <p className="text-xs text-neutral-500 mb-4">Ubah angle, audience, atau tone tanpa perlu isi product details lagi:</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Content Angle</label>
                  <textarea
                    value={regenData.angle}
                    onChange={(e) => setRegenData((prev) => prev ? { ...prev, angle: e.target.value } : prev)}
                    placeholder="e.g., bilik panas dan ruang kecil"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none placeholder:text-neutral-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Target Audience</label>
                  <textarea
                    value={regenData.targetAudience}
                    onChange={(e) => setRegenData((prev) => prev ? { ...prev, targetAudience: e.target.value } : prev)}
                    placeholder="e.g., student dan orang bujang"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none placeholder:text-neutral-400 bg-white"
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Tone</label>
                  <select
                    value={regenData.tone}
                    onChange={(e) => setRegenData((prev) => prev ? { ...prev, tone: e.target.value } : prev)}
                    className="w-full px-3 py-2 pr-8 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer"
                  >
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
                <button
                  onClick={() => generate(regenData)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
                >
                  Regenerate Content
                </button>
              </div>
            </div>

            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition"
            >
              Generate New Content
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function CopyButton({ text, onCopy }: { text: string; onCopy: (t: string) => void }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    onCopy(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handle}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition whitespace-nowrap ${
        copied ? 'bg-green-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
      }`}
    >
      {copied ? '✓ Copied!' : 'Copy'}
    </button>
  )
}
