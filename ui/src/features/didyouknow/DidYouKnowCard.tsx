import { useState, useRef } from 'react'
import { IconDownload, IconChevronLeft, IconClock } from '@tabler/icons-react'
import { DidYouKnowCanvas, type DidYouKnowCanvasHandle } from './DidYouKnowCanvas'
import type { DidYouKnowIdea } from '../../hooks/useDidYouKnow'
import { toast } from '../../hooks/useToast'
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
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleDateTime, setScheduleDateTime] = useState<string>('')

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

  const handleScheduleToFB = async () => {
    if (!scheduleDateTime) {
      toast.error('Please select a date and time')
      return
    }

    if (!canvasRef.current) {
      toast.error('Preview not ready')
      return
    }

    const imageDataUrl = canvasRef.current.getDataUrl()
    if (!imageDataUrl) {
      toast.error('Failed to generate image')
      return
    }

    setIsScheduling(true)

    try {
      const webhookUrl = import.meta.env.VITE_SCHEDULED_POSTS_SCHEDULE_WEBHOOK_URL as string | undefined
      if (!webhookUrl) {
        toast.error('Schedule webhook not configured')
        setIsScheduling(false)
        return
      }

      const scheduledTime = new Date(scheduleDateTime).toISOString()

      const payload = {
        brand,
        imageUrl: imageDataUrl,
        caption: `${captionHeader}\n\n${idea.caption}`,
        headline: idea.headline,
        scheduledTime,
        edition,
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Schedule failed: ${response.status}`)
      }

      toast.success('Post scheduled successfully!')
      setScheduleDateTime('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule post')
    } finally {
      setIsScheduling(false)
    }
  }

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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Editor */}
        <div className="space-y-4">
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

          {uploadedImageUrl && (
            <div className="space-y-3">
              <button
                onClick={handleDownload}
                className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <IconDownload className="w-4 h-4" />
                Download
              </button>

              <div className="pt-4 border-t border-neutral-200 space-y-3">
                <label className="block text-sm font-medium text-neutral-950">Schedule to Facebook</label>
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <button
                  onClick={handleScheduleToFB}
                  disabled={!scheduleDateTime || isScheduling}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  <IconClock className="w-4 h-4" />
                  {isScheduling ? 'Scheduling...' : 'Schedule Post'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div>
          <p className="text-sm font-medium text-neutral-950 mb-2">Preview</p>
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
        </div>
      </div>
    </div>
  )
}
