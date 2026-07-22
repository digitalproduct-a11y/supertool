import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBrandPath } from '../hooks/useBrandNavigate'
import type { EngagementIdea } from '../types'
import { BRAND_LOGO_IDS } from '../constants/brands'
import { TOPIC_CONFIGS } from '../constants/topics'
import PhotoPickerModal from './PhotoPickerModal'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials } from '../utils/fbCredentials'
import GempakEntertainmentCanvas, { type GempakEntertainmentCanvasHandle } from '../features/engagement/GempakEntertainmentCanvas'
import { EngagementPostCanvas, type EngagementPostCanvasHandle } from '../features/engagement/EngagementPostCanvas'
import { uploadToCloudinary, uploadedImageUrl, buildEngagementPreviewUrl } from '../utils/imageProvider'
import { toast } from '../hooks/useToast'

const FORMAT_BADGES: Record<string, string> = {
  challenge: '🏆',
  debate: '💬',
  nostalgia: '🕐',
  quiz: '🧠',
  hot_take: '🔥',
  quick_news: '📰',
}

const FORMAT_LABELS: Record<string, string> = {
  challenge: 'Challenge',
  debate: 'Debate',
  nostalgia: 'Nostalgia',
  quiz: 'Quiz',
  hot_take: 'Hot Take',
  quick_news: 'Quick News',
}

const getBadge = (type: string): string => FORMAT_BADGES[type] || '✨'
const getLabel = (type: string): string => FORMAT_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')

interface IdeaCardProps {
  idea: EngagementIdea
  onUpdateField: (ideaId: string, field: 'headline' | 'subtitle' | 'caption', value: string) => void
  onPhotoSelected: (ideaId: string, photo: { url: string; publicId: string }) => void
  onScheduleOnFB?: (previewUrl: string, caption: string, brand: string, scheduledFor?: string, passcode?: string) => Promise<{ success: boolean; message: string }>
  selectedBrand: string
  index: number
  cachedPhotos?: Record<string, any[]>
  downloadPrefix?: string
  uploadPreset?: string
  headlineFontSpec?: string
  subtitleFontSpec?: string
  playerLabel?: string
  logoSize?: number
  showTypeOnImage?: boolean
  subtitleY?: number
  /** Render EPL/UCL via the client Fabric EngagementPostCanvas (ImageKit path)
   *  instead of the legacy Cloudinary buildPreviewUrl `<img>` (still used by PrimeTalk). */
  useEngagementCanvas?: boolean
  // When true, the preview is rendered client-side via fabric.js
  // (GempakEntertainmentCanvas) and the Cloudinary URL is built lazily at
  // schedule-time. Default false → existing EPL Cloudinary URL preview path.
  useFabricCanvas?: boolean
  topic?: string
}

export default function IdeaCard({
  idea,
  onUpdateField,
  onPhotoSelected,
  onScheduleOnFB,
  selectedBrand,
  index,
  cachedPhotos,
  downloadPrefix = 'epl-post',
  uploadPreset,
  headlineFontSpec,
  subtitleFontSpec,
  playerLabel,
  logoSize = 150,
  showTypeOnImage = false,
  subtitleY = 1100,
  useEngagementCanvas = false,
  useFabricCanvas = false,
  topic = 'epl',
}: IdeaCardProps) {
  const postQueuePath = useBrandPath('/post-queue')
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [committedHeadline, setCommittedHeadline] = useState(idea.headline)
  const [committedSubtitle, setCommittedSubtitle] = useState(idea.subtitle)
  const gempakCanvasRef = useRef<GempakEntertainmentCanvasHandle>(null)
  const engagementRef = useRef<EngagementPostCanvasHandle>(null)
  const topicConfig = TOPIC_CONFIGS[topic] || null

  // Sync committed values when a new idea is generated (idea.id changes)
  useEffect(() => {
    setCommittedHeadline(idea.headline)
    setCommittedSubtitle(idea.subtitle)
  }, [idea.id])

  const brandLogoId = BRAND_LOGO_IDS[selectedBrand as keyof typeof BRAND_LOGO_IDS] || 'stadium_astro_logo'

  // Provider-aware engagement composite (Prime Talk / #10). ImageKit rebuilds it
  // as a `?tr=` layer chain; Cloudinary keeps the legacy buildPreviewUrl output.
  // EPL/UCL/Gempak render via their Fabric canvases instead (useEngagementCanvas/
  // useFabricCanvas), so this only drives the PrimeTalk `<img>` path.
  const buildPreviewUrl = (headline: string, subtitle: string, photoPublicId: string | null) =>
    buildEngagementPreviewUrl({
      headline,
      subtitle,
      photoPublicId,
      type: idea.type,
      showTypeOnImage,
      brandLogoId,
      logoSize,
      subtitleY,
      headlineFontSpec,
      subtitleFontSpec,
    })
  const previewUrl = buildPreviewUrl(committedHeadline, committedSubtitle, idea.photo_public_id)

  const headlineChars = idea.headline.length
  const subtitleChars = idea.subtitle.length
  const captionChars = idea.caption.length

  const headlineLimit = topicConfig?.headlineLimit ?? 35
  const subtitleLimit = topicConfig?.subtitleLimit ?? 70
  const captionLimit = topicConfig?.captionLimit ?? 600

  const headlineValid = headlineChars > 0 && headlineChars <= headlineLimit
  const subtitleValid = subtitleChars > 0 && subtitleChars <= subtitleLimit
  const captionValid = captionChars > 0 && captionChars <= captionLimit
  const photoValid = !!idea.photo_url

  return (
    <>
      <div className="flex flex-col">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-2 pb-3 border-b border-gray-200">
          <span className="text-sm font-semibold text-neutral-950">Idea {index + 1}</span>
          <div className="flex items-center gap-2">
            <span className="text-lg">{getBadge(idea.post_type || idea.type)}</span>
            <span className="text-xs font-semibold text-gray-600 uppercase">{getLabel(idea.post_type || idea.type)}</span>
          </div>
        </div>

        {/* Context, Player & Club Reference */}
        <p className="text-xs text-gray-500 mb-4">
          {idea.context && (
            <>
              Context: <span className="font-medium text-gray-700">{idea.context}</span>{' | '}
            </>
          )}
          {playerLabel ?? 'Reference player'}: <span className="font-medium text-gray-700">{idea.player}</span>
          {idea.club && (
            <>
              {' | '}Club: <span className="font-medium text-gray-700">{idea.club}</span>
            </>
          )}
        </p>

        {/* Live Preview */}
        <div className={`aspect-[1080/1350] rounded-xl border-2 overflow-hidden bg-gray-100 mb-4`}>
          {useFabricCanvas ? (
            <GempakEntertainmentCanvas
              ref={gempakCanvasRef}
              headline={idea.headline}
              subtitle={idea.subtitle}
              brand={selectedBrand}
              photoUrl={idea.photo_url}
              typeLabel={showTypeOnImage ? idea.type : undefined}
            />
          ) : useEngagementCanvas ? (
            <EngagementPostCanvas
              ref={engagementRef}
              topic={topic}
              headline={committedHeadline}
              subtitle={committedSubtitle}
              photoUrl={idea.photo_url}
              brand={selectedBrand}
              typeLabel={showTypeOnImage ? idea.type : undefined}
            />
          ) : (
            <img src={previewUrl} alt="Live preview" className="w-full h-full object-cover" />
          )}
        </div>

        <button
          onClick={() => setShowPhotoModal(true)}
          className="w-full px-3 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium transition active:scale-[0.98] mb-4"
        >
          {idea.photo_url ? 'Change Photo' : 'Select Photo'}
        </button>
        {!photoValid && <p className="text-xs text-yellow-600 font-medium mb-4">Please select photo to proceed</p>}

        {/* Text Fields */}
        <div className="space-y-4">
            {/* Headline */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-gray-700 uppercase">Headline</label>
                <span className="text-xs text-gray-500">{Number.isFinite(headlineLimit) ? `${headlineChars}/${headlineLimit}` : headlineChars}</span>
              </div>
              <input
                type="text"
                value={idea.headline}
                onChange={(e) => onUpdateField(idea.id, 'headline', e.target.value.slice(0, headlineLimit))}
                onBlur={() => setCommittedHeadline(idea.headline)}
                placeholder="Enter headline..."
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition ${
                  headlineValid ? 'border-gray-200' : 'border-red-300'
                }`}
              />
              {!headlineValid && <span className="text-xs text-red-600 font-medium mt-1 block">Required</span>}
            </div>

            {/* Subtitle */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-gray-700 uppercase">Subtitle</label>
                <span className="text-xs text-gray-500">{Number.isFinite(subtitleLimit) ? `${subtitleChars}/${subtitleLimit}` : subtitleChars}</span>
              </div>
              <input
                type="text"
                value={idea.subtitle}
                onChange={(e) => onUpdateField(idea.id, 'subtitle', e.target.value.slice(0, subtitleLimit))}
                onBlur={() => setCommittedSubtitle(idea.subtitle)}
                placeholder="Enter subtitle..."
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition ${
                  subtitleValid ? 'border-gray-200' : 'border-red-300'
                }`}
              />
              {!subtitleValid && <span className="text-xs text-red-600 font-medium mt-1 block">Required</span>}
            </div>

            {/* Caption */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-gray-700 uppercase">Caption</label>
                <span className="text-xs text-gray-500">{captionChars}/{captionLimit}</span>
              </div>
              <textarea
                value={idea.caption}
                onChange={(e) => onUpdateField(idea.id, 'caption', e.target.value.slice(0, captionLimit))}
                placeholder="Enter caption..."
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition resize-none h-20 ${
                  captionValid ? 'border-gray-200' : 'border-red-300'
                }`}
              />
              {!captionValid && <span className="text-xs text-red-600 font-medium mt-1 block">Required</span>}
            </div>

            {/* Download Button */}
            <button
              onClick={async () => {
                try {
                  const fileBase = idea.headline.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_') || `${downloadPrefix}-${idea.type}`
                  if (useFabricCanvas) {
                    gempakCanvasRef.current?.downloadAsPng(`${fileBase}.png`)
                    return
                  }
                  if (useEngagementCanvas) {
                    engagementRef.current?.downloadAsPng(`${fileBase}.png`)
                  } else {
                    const res = await fetch(previewUrl)
                    const blob = await res.blob()
                    const url = window.URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = `${fileBase}.jpg`
                    link.click()
                    window.URL.revokeObjectURL(url)
                  }
                } catch (err) {
                  console.error('Download failed:', err)
                }
              }}
              disabled={!idea.headline.trim() || !idea.subtitle.trim() || !photoValid}
              className="w-full px-3 py-2 bg-neutral-950 hover:bg-neutral-800 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-lg text-xs font-medium transition active:scale-[0.98]"
            >
              Download
            </button>

            {/* Schedule on FB Button */}
            {onScheduleOnFB && (
              <>
                {showScheduleModal && (
                  <ScheduleModal
                    brand={selectedBrand}
                    hasCredentials={!!getCredentials(selectedBrand.toLowerCase())}
                    isPosting={isScheduling}
                    onConfirm={async (scheduledFor, passcode) => {
                      setIsScheduling(true)
                      try {
                        // Client-canvas topics (Gempak / Badminton-MotoGP / EPL-UCL):
                        // render → PNG → upload via the active image provider (lazy, so
                        // un-scheduled ideas never upload). PrimeTalk still uses the
                        // Cloudinary preview URL directly.
                        let urlForFb: string
                        if (useFabricCanvas || useEngagementCanvas) {
                          const dataUrl = useFabricCanvas
                            ? gempakCanvasRef.current?.getDataUrl()
                            : engagementRef.current?.getDataUrl()
                          if (!dataUrl) throw new Error('Canvas not ready')
                          const blob = await (await fetch(dataUrl)).blob()
                          const file = new File([blob], `${downloadPrefix}-${idea.type}.png`, { type: 'image/png' })
                          urlForFb = uploadedImageUrl(await uploadToCloudinary(file))
                        } else {
                          urlForFb = buildPreviewUrl(idea.headline, idea.subtitle, idea.photo_public_id)
                        }
                        const result = await onScheduleOnFB(urlForFb, idea.caption, selectedBrand, scheduledFor, passcode)
                        setScheduleStatus(result.success ? 'done' : 'error')
                      } catch (err) {
                        console.error('Schedule failed:', err)
                        toast.error('Image upload failed. Please try again.')
                        setScheduleStatus('error')
                      } finally {
                        setIsScheduling(false)
                        setShowScheduleModal(false)
                      }
                    }}
                    onClose={() => setShowScheduleModal(false)}
                  />
                )}
                <button
                  onClick={() => setShowScheduleModal(true)}
                  disabled={isScheduling || !captionValid || !photoValid}
                  className="w-full px-3 py-2 border border-neutral-950 text-neutral-950 hover:bg-neutral-950 hover:text-white disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition active:scale-[0.98]"
                >
                  {isScheduling ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Scheduling…
                    </span>
                  ) : 'Schedule on FB'}
                </button>
                {scheduleStatus === 'done' && (
                  <div className="text-center space-y-1">
                    <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
                    <p className="text-xs text-neutral-400">
                      To view or delete your scheduled post, check{' '}
                      <Link to={postQueuePath} className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
                        here
                      </Link>.
                    </p>
                  </div>
                )}
                {scheduleStatus === 'error' && (
                  <p className="text-xs text-red-500 text-center">✗ Failed to schedule. Try again.</p>
                )}
              </>
            )}
            </div>
        </div>

      {/* Photo Picker Modal */}
      {showPhotoModal && (
        <PhotoPickerModal
          playerName={idea.player}
          club={idea.club}
          onSelect={(photo) => {
            onPhotoSelected(idea.id, photo)
            setShowPhotoModal(false)
          }}
          onClose={() => setShowPhotoModal(false)}
          cachedPhotos={cachedPhotos}
          uploadPreset={uploadPreset}
          topic={topic}
        />
      )}
    </>
  )
}
