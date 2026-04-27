import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANDS } from '../constants/brands'
import { IconChevronLeft, IconDownload, IconRefresh } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'

export function LatestFuelPricePage() {
  const navigate = useNavigate()
  const webhookUrl = import.meta.env.VITE_LATEST_FUEL_PRICE_WEBHOOK_URL as string | undefined

  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerate = async () => {
    if (!selectedBrand) {
      toast.error('Please select a brand')
      return
    }

    if (!webhookUrl) {
      toast.error('Webhook URL not configured')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: selectedBrand }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json() as { image_url?: string; caption?: string; error?: string }

      if (data.error) {
        toast.error(data.error)
        return
      }

      if (data.image_url) {
        setImageUrl(data.image_url)
        setCaption(data.caption || '')
        toast.success('Generated successfully!')
      } else {
        toast.error('No image URL in response')
      }
    } catch (error) {
      toast.error(`Failed to generate: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!imageUrl) return
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `fuel-price-${selectedBrand}-${new Date().toISOString().split('T')[0]}.png`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download image')
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/engagement-photos')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-neutral-950">Latest Fuel Price</h1>
          </div>
          <p className="text-sm text-neutral-600">Generate weekly Malaysian fuel price graphics</p>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-900">⛽ Fuel prices update weekly on Thursdays.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
          {/* LEFT: Controls */}
          <div>
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Select Brand</label>
                <div className="relative">
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full px-4 py-3 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition"
                  >
                    <option value="">Select a brand...</option>
                    {BRANDS.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!selectedBrand || isLoading}
                className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <IconRefresh className="w-4 h-4" />
                {isLoading ? 'Generating...' : 'Generate'}
              </button>

              {imageUrl && (
                <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-950 mb-2">Caption</label>
                    {isLoading ? (
                      <div className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm bg-neutral-50 flex items-center justify-center min-h-24">
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" />
                          <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
                        </div>
                      </div>
                    ) : (
                      <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                        rows={3}
                      />
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleDownload}
                      className="flex-1 px-4 py-3 border border-neutral-200 hover:bg-neutral-50 text-neutral-950 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <IconDownload className="w-4 h-4" />
                      Download Image
                    </button>
                    <div className="relative group flex-1">
                      <button
                        disabled
                        className="w-full px-4 py-3 bg-neutral-200 text-neutral-400 rounded-xl text-sm font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2m0 0v-8m0 8H7m5-8V5m0 0H7" />
                        </svg>
                        Schedule on FB
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-neutral-950 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        Coming soon
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Preview */}
          <div className="space-y-4">
            {/* Fixed-height image container — prevents layout jump */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden min-h-96 flex flex-col">
              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-800 mb-1">
                      Generating your post
                    </h3>
                    <p className="text-xs text-neutral-400">
                      This usually takes around 10 seconds
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              ) : imageUrl ? (
                <img src={imageUrl} alt="Fuel Price" className="w-full h-auto" />
              ) : (
                <div className="flex-1 flex items-center justify-center text-center">
                  <div>
                    <svg
                      className="w-12 h-12 text-neutral-300 mx-auto mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-neutral-400 text-sm">Select a brand and generate</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
