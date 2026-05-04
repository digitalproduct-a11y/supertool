import { useState, useRef } from 'react'
import { IconDownload, IconChevronLeft } from '@tabler/icons-react'
import { DidYouKnowCanvas, type DidYouKnowCanvasHandle } from './DidYouKnowCanvas'
import type { DidYouKnowIdea } from '../../hooks/useDidYouKnow'
import { toast } from '../../hooks/useToast'
import { ScheduleModal } from '../../components/ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../../utils/fbCredentials'
import { EDITION_TRANSLATIONS } from './constants'

interface DidYouKnowCardProps {
  idea: DidYouKnowIdea
  edition: string
  brandLogoPublicId: string | null
  language: string
  brand: string
  onBack: () => void
  onUpdateField: (field: 'headline' | 'fact' | 'caption', value: string) => void
}

export function DidYouKnowCard({
  idea,
  edition,
  brandLogoPublicId,
  language,
  brand,
  onBack,
  onUpdateField,
}: DidYouKnowCardProps) {
  const canvasRef = useRef<DidYouKnowCanvasHandle>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<'idle' | 'done' | 'error'>('idle')

  const isMalay = language === 'ms' || language.startsWith('ms') || language?.toLowerCase().includes('malay')
  const translatedEdition = EDITION_TRANSLATIONS[edition]?.[isMalay ? 'ms' : 'en'] || edition
  const captionHeader = isMalay ? 'TAHUKAH ANDA?' : 'DID YOU KNOW?'

  const brandLogo = brandLogoPublicId || 'default_logo'

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    setUploadedImageUrl(URL.createObjectURL(file))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const handleDownload = () => {
    if (!canvasRef.current) {
      toast.error('Preview not ready')
      return
    }

    canvasRef.current.downloadAsPng()
    toast.success('Downloaded!')
  }

  const uploadCanvasToCloudinary = async (dataUrl: string): Promise<string | null> => {
    try {
      const uploadPreset = (import.meta.env.VITE_CLOUDINARY_DIDYOUKNOW_UPLOAD_PRESET as string | undefined)?.trim()
      const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim()

      if (!uploadPreset || !cloudName) {
        console.error('Cloudinary config missing')
        return null
      }

      // Convert data URL to blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      // Create FormData and upload
      const formData = new FormData()
      formData.append('file', blob)
      formData.append('upload_preset', uploadPreset)

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData }
      )

      if (!uploadResponse.ok) {
        console.error('Cloudinary upload failed:', uploadResponse.status)
        return null
      }

      const data = await uploadResponse.json()
      return data.secure_url || null
    } catch (err) {
      console.error('Cloudinary upload error:', err)
      return null
    }
  }

  const handleScheduleOnFB = async (scheduledFor: string, passcode?: string) => {
    if (!canvasRef.current) {
      toast.error('Preview not ready')
      return { success: false }
    }

    const imageDataUrl = canvasRef.current.getDataUrl()
    if (!imageDataUrl) {
      toast.error('Failed to generate image')
      return { success: false }
    }

    setIsScheduling(true)

    try {
      const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
      if (!webhookUrl) {
        toast.error('Schedule webhook not configured')
        return { success: false }
      }

      const brandLower = brand.toLowerCase()
      const resolvedPasscode = passcode ?? getCredentials(brandLower)?.passcode
      if (!resolvedPasscode) {
        toast.error('Passcode required')
        return { success: false }
      }

      // Upload canvas to Cloudinary
      const cloudinaryUrl = await uploadCanvasToCloudinary(imageDataUrl)
      if (!cloudinaryUrl) {
        toast.error('Failed to upload image')
        return { success: false }
      }

      const payload = {
        fb_ai_image_url: cloudinaryUrl,
        fb_ai_caption: `${captionHeader}\n\n${idea.caption}`,
        brand: brandLower,
        passcode: resolvedPasscode,
        scheduled_for: scheduledFor,
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      // Handle auth error
      if (data.status === 'AUTH_ERROR') {
        clearCredentials(brandLower)
        toast.error('Authentication failed. Please try again.')
        setShowScheduleModal(true)
        return { success: false }
      }

      // Handle brand error
      if (data.status === 'BRAND_ERROR') {
        toast.error(data.message || 'Brand error')
        return { success: false }
      }

      // Handle success
      if (data.success || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
        saveCredentials(brandLower, resolvedPasscode)
        toast.success('Scheduled on Facebook!')
        setScheduleStatus('done')
        return { success: true }
      }

      // Handle other errors
      toast.error(data.message || 'Failed to schedule post')
      return { success: false }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule post')
      return { success: false }
    } finally {
      setIsScheduling(false)
    }
  }

  const hasCredentials = !!getCredentials(brand.toLowerCase())

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-sm text-neutral-600 hover:text-neutral-950 transition flex items-center gap-1"
      >
        <IconChevronLeft className="w-4 h-4" />
        Back to ideas
      </button>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left: White card with editor */}
        <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-950 mb-2">Headline (≤80 chars)</label>
            <input
              type="text"
              value={idea.headline}
              onChange={(e) => onUpdateField('headline', e.target.value.slice(0, 80))}
              maxLength={80}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            <p className="text-xs text-neutral-400 mt-1">{idea.headline.length}/80</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-950 mb-2">Fact (≤400 chars)</label>
            <textarea
              value={idea.fact}
              onChange={(e) => onUpdateField('fact', e.target.value.slice(0, 400))}
              maxLength={400}
              rows={4}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            />
            <p className="text-xs text-neutral-400 mt-1">{idea.fact.length}/400</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-950 mb-2">Caption (≤300 chars)</label>
            <textarea
              value={`${captionHeader}\n\n${idea.caption}`}
              onChange={(e) => {
                const fullText = e.target.value
                const captionOnly = fullText.replace(/^(TAHUKAH ANDA\?|DID YOU KNOW\?)\n\n/, '')
                onUpdateField('caption', captionOnly.slice(0, 300))
              }}
              maxLength={300}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none font-mono"
            />
            <p className="text-xs text-neutral-400 mt-1">{idea.caption.length}/300</p>
          </div>

          {/* Upload section */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
              isDragging ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="block cursor-pointer">
              <p className="text-sm font-medium text-neutral-950">Upload background image</p>
              <p className="text-xs text-neutral-500 mt-1">Drag & drop or click to browse</p>
            </label>
          </div>
        </div>

        {/* Right: Glass card with preview and schedule */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <p className="text-sm font-medium text-neutral-950">Preview</p>
          <div className="w-full rounded-xl border border-neutral-200 overflow-hidden" style={{ aspectRatio: '1080 / 1350', backgroundColor: '#f5f5f5' }}>
            <DidYouKnowCanvas
              ref={canvasRef}
              idea={idea}
              imageUrl={uploadedImageUrl}
              brandLogoPublicId={brandLogo}
              translatedEdition={translatedEdition}
              language={language}
            />
          </div>

          {uploadedImageUrl && (
            <div className="space-y-3 pt-2">
              <button
                onClick={handleDownload}
                className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <IconDownload className="w-4 h-4" />
                Download
              </button>

              <button
                onClick={() => setShowScheduleModal(true)}
                disabled={isScheduling}
                className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                {isScheduling ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Scheduling…
                  </>
                ) : (
                  'Schedule on FB'
                )}
              </button>

              {scheduleStatus === 'done' && (
                <div className="text-green-600 text-xs font-medium">
                  Scheduled on Facebook!{' '}
                  <a href="/post-queue" className="underline hover:text-green-700">
                    View queue
                  </a>
                </div>
              )}

              {scheduleStatus === 'error' && (
                <div className="text-red-600 text-xs font-medium">Failed to schedule. Try again.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          brand={brand}
          hasCredentials={hasCredentials}
          isPosting={isScheduling}
          onClose={() => setShowScheduleModal(false)}
          onConfirm={async (scheduledFor: string, passcode?: string) => {
            setShowScheduleModal(false)
            await handleScheduleOnFB(scheduledFor, passcode)
          }}
        />
      )}
    </div>
  )
}
