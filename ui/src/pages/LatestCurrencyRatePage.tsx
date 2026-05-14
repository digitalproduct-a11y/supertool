import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useBrand } from '../context/BrandContext'
import { BRANDS } from '../constants/brands'
import { IconDownload } from '@tabler/icons-react'
import { BackButton } from '../components/ds'
import { toast } from '../hooks/useToast'
import { ScheduleModal } from '../components/ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'

async function callZernioWebhook(
  imageUrl: string,
  caption: string,
  brand: string,
  scheduledFor: string | undefined,
  passcode: string,
): Promise<{ success: boolean; message: string; status?: string }> {
  const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) return { success: false, message: 'Webhook not configured.' }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fb_ai_image_url: imageUrl,
        fb_ai_caption: caption,
        brand: brand.toLowerCase(),
        ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        passcode,
      }),
    })
    const data = await res.json() as { success?: boolean; status?: string; message?: string }
    if (data.status === 'AUTH_ERROR') {
      clearCredentials(brand.toLowerCase())
      return { success: false, message: data.message ?? 'Invalid passcode.', status: 'AUTH_ERROR' }
    }
    if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
      saveCredentials(brand.toLowerCase(), passcode)
      return { success: true, message: data.message ?? 'Scheduled!' }
    }
    return { success: false, message: data.message ?? 'Something went wrong.' }
  } catch {
    return { success: false, message: 'Network error. Please try again.' }
  }
}

export function LatestCurrencyRatePage() {
  const { selectedBrand: globalBrand, isAdmin } = useBrand()
  const webhookUrl = import.meta.env.VITE_LATEST_CURRENCY_RATE_WEBHOOK_URL as string | undefined

  const [selectedBrand, setSelectedBrand] = useState<string>((!isAdmin && globalBrand) ? globalBrand : '')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [stage, setStage] = useState<'intro' | 'generate'>('intro')
  const [scheduleState, setScheduleState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  async function handleSchedule(scheduledFor: string, passcode: string) {
    if (!imageUrl) return
    setScheduleState('posting')
    const finalPasscode = passcode || getCredentials(selectedBrand.toLowerCase())?.passcode || ''
    const response = await callZernioWebhook(imageUrl, caption, selectedBrand, scheduledFor, finalPasscode)
    if (response.status === 'AUTH_ERROR') {
      setShowScheduleModal(true)
      setScheduleState('idle')
      toast.error('Invalid passcode. Please try again.')
    } else if (response.success) {
      setScheduleState('done')
      setShowScheduleModal(false)
      toast.success('Scheduled on Facebook!')
    } else {
      setScheduleState('error')
      toast.error(response.message || "Couldn't schedule. Please try again.")
    }
  }

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
      link.download = `currency-rate-${selectedBrand}-${new Date().toISOString().split('T')[0]}.png`
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
            <BackButton />
            <h1 className="text-2xl font-semibold text-neutral-950">Latest Currency Rate</h1>
          </div>
          <p className="text-sm text-neutral-600">Generate daily foreign exchange rate graphics</p>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {stage === 'intro' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-8 text-center space-y-4">
              <p className="text-sm text-neutral-600">Get the latest foreign exchange rates and generate a branded post ready for Facebook.</p>
              {(isAdmin || !globalBrand) && (
                <div className="text-left">
                  <label className="block text-sm font-medium text-neutral-950 mb-2">Select Brand</label>
                  <div className="relative">
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full px-4 py-3 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition"
                    >
                      <option value="">Select a brand...</option>
                      {BRANDS.map((brand) => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setStage('generate'); handleGenerate() }}
                disabled={!selectedBrand || isLoading}
                className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
              >
                Generate Post
              </button>
            </div>
          </div>
        )}

        {stage === 'generate' && (<>
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-900">Currency rates update Monday–Friday. No updates on weekends.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
          {/* Left: Controls */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-5">
            {(isAdmin || !globalBrand) && (
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Brand</label>
                <div className="relative">
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full px-4 py-3 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition"
                  >
                    <option value="">Select a brand...</option>
                    {BRANDS.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {imageUrl && (
              <div className="pt-4 border-t border-neutral-100 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Caption</label>
                  {isLoading ? (
                    <div className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm bg-neutral-50 flex items-center justify-center min-h-[7rem]">
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
                      rows={4}
                    />
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleDownload}
                    className="flex-1 px-4 py-3 border border-neutral-200 hover:bg-neutral-50 text-neutral-950 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <IconDownload className="w-4 h-4" />
                    Download image
                  </button>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    disabled={scheduleState === 'posting'}
                    className="flex-1 px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {scheduleState === 'posting' ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Scheduling…
                      </>
                    ) : 'Schedule on FB'}
                  </button>
                </div>
                {scheduleState === 'error' && (
                  <p className="text-xs text-red-500">Failed to schedule. Please try again.</p>
                )}
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden min-h-96 flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-800 mb-1">Generating your post</h3>
                  <p className="text-xs text-neutral-400">This usually takes around 10 seconds</p>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            ) : imageUrl ? (
              <img src={imageUrl} alt="Currency Rate" className="w-full h-auto" />
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <svg className="w-12 h-12 text-neutral-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-neutral-400 text-sm">Your generated post will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {showScheduleModal && imageUrl && createPortal(
          <ScheduleModal
            brand={selectedBrand}
            hasCredentials={!!getCredentials(selectedBrand.toLowerCase())}
            isPosting={scheduleState === 'posting'}
            onConfirm={(sf, passcode) => void handleSchedule(sf ?? '', passcode ?? '')}
            onClose={() => setShowScheduleModal(false)}
          />,
          document.body
        )}
        </>)}
      </div>
    </div>
  )
}
