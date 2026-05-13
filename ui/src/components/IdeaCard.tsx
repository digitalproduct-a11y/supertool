import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { EngagementIdea } from '../types'
import { BRAND_LOGO_IDS } from '../constants/brands'
import { TOPIC_CONFIGS } from '../constants/topics'
import PhotoPickerModal from './PhotoPickerModal'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials } from '../utils/fbCredentials'
import GempakEntertainmentCanvas, { type GempakEntertainmentCanvasHandle } from '../features/engagement/GempakEntertainmentCanvas'
import { uploadToCloudinary } from '../utils/cloudinary'
import { toast } from '../hooks/useToast'
import BadmintonPostCanvas from './BadmintonPostCanvas'
import type { BadmintonPostCanvasHandle } from './BadmintonPostCanvas'
import { StaticCanvas } from 'fabric'
import { renderImageOnCanvas } from '../utils/canvasRenderingUtils'

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
  useFabricCanvas = false,
  topic = 'epl',
}: IdeaCardProps) {
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [committedHeadline, setCommittedHeadline] = useState(idea.headline)
  const [committedSubtitle, setCommittedSubtitle] = useState(idea.subtitle)
  const gempakCanvasRef = useRef<GempakEntertainmentCanvasHandle>(null)
  const canvasRef = useRef<BadmintonPostCanvasHandle>(null)

  // Text box position — edit this value to adjust headline/subtitle group position
  const TEXT_BOX_OFFSET = 160
  const previewCanvasElRef = useRef<HTMLCanvasElement>(null)
  const previewFabricRef = useRef<StaticCanvas | null>(null)
  const topicConfig = TOPIC_CONFIGS[topic] || null
  // useCanvas = motogp/badminton style canvas (BadmintonPostCanvas)
  // useFabricCanvas = gempak-entertainment style canvas (GempakEntertainmentCanvas)
  const useCanvasTopic = topicConfig?.useCanvas ?? false

  const PREVIEW_WIDTH = 1080
  const PREVIEW_HEIGHT = 1350

  // Sync committed values when a new idea is generated (idea.id changes)
  useEffect(() => {
    setCommittedHeadline(idea.headline)
    setCommittedSubtitle(idea.subtitle)
  }, [idea.id])

  // Listen for HMR updates from canvasRenderingUtils
  const [renderKey, setRenderKey] = useState(0)
  useEffect(() => {
    const handler = () => setRenderKey(prev => prev + 1)
    window.addEventListener('canvas-utils-updated', handler)
    return () => window.removeEventListener('canvas-utils-updated', handler)
  }, [])

  // Initialize and render preview canvas for badminton/motogp topics
  useEffect(() => {
    if (!useCanvasTopic || !previewCanvasElRef.current) return

    const canvas = new StaticCanvas(previewCanvasElRef.current, {
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      backgroundColor: '#f3f4f6',
    })

    // Override fabric's inline width/height styles so canvas scales with container
    if (previewCanvasElRef.current) {
      previewCanvasElRef.current.style.width = '100%'
      previewCanvasElRef.current.style.height = '100%'
    }

    const renderPreview = async () => {
      if (idea.photo_url) {
        await renderImageOnCanvas(canvas, idea.photo_url, PREVIEW_WIDTH, PREVIEW_HEIGHT, idea.headline, idea.subtitle, TEXT_BOX_OFFSET, TEXT_BOX_OFFSET, brandLogoUrl)
      } else {
        canvas.clear()
        canvas.renderAll()
      }
    }

    renderPreview()

    const prev = previewFabricRef.current
    previewFabricRef.current = canvas
    if (prev) prev.dispose()

    return () => {
      if (canvas) canvas.dispose()
    }
  }, [useCanvasTopic, previewCanvasElRef, idea, TEXT_BOX_OFFSET, renderKey])

  const DEFAULT_PHOTO = 'placeholder_img_cveevd'
  const brandLogoId = BRAND_LOGO_IDS[selectedBrand as keyof typeof BRAND_LOGO_IDS] || 'stadium_astro_logo'
  const brandLogoUrl = `https://res.cloudinary.com/dymmqtqyg/image/upload/${brandLogoId}`

  const buildPreviewUrl = (headline: string, subtitle: string, photoPublicId: string | null) => {
    const enc = (t: string) => encodeURIComponent(encodeURIComponent(t))
    const hFont = headlineFontSpec ?? 'Montserrat_90_bold_normal_center_line_spacing_-20'
    const sFont = subtitleFontSpec ?? 'Montserrat_38_normal_center_line_spacing_0'
    const isExternalUrl = photoPublicId?.startsWith('http')
    const uploadType = isExternalUrl ? 'fetch' : 'upload'
    const finalPhotoId = isExternalUrl ? encodeURIComponent(photoPublicId!) : (photoPublicId || DEFAULT_PHOTO)
    return [
      `https://res.cloudinary.com/dymmqtqyg/image/${uploadType}`,
      'c_fill,g_face,w_1080,h_1350',
      'c_pad,w_1080,h_1350,g_north',
      'l_black_fade_pexvn5,c_fill,w_1080,h_1350/fl_layer_apply,g_south,y_0',
      showTypeOnImage && idea.type ? `l_text:${sFont}:${enc(idea.type)},co_rgb:FFD700,c_fit,w_700/fl_layer_apply,g_north,x_0,y_845` : null,
      `l_text:${hFont}:${enc(headline)},co_rgb:FFFFFF,c_fit,w_900/fl_layer_apply,g_north,x_0,y_900`,
      `l_text:${sFont}:${enc(subtitle)},co_rgb:FFFFFF,c_fit,w_850/fl_layer_apply,g_north,x_0,y_${subtitleY}`,
      `l_${brandLogoId},w_${logoSize}/fl_layer_apply,g_south,y_35`,
      finalPhotoId,
    ].filter(Boolean).join('/')
  }

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
              photoPublicId={idea.photo_public_id}
              typeLabel={showTypeOnImage ? idea.type : undefined}
            />
          ) : useCanvasTopic ? (
            <canvas
              ref={previewCanvasElRef}
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
              }}
            />
          ) : (
            <img src={previewUrl} alt="Live preview" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Hidden download canvas (1080x1350) for badminton/motogp */}
        {useCanvasTopic && (
          <div style={{ display: 'none' }}>
            <BadmintonPostCanvas
              ref={canvasRef}
              headline={committedHeadline}
              content={committedSubtitle}
              photoUrl={idea.photo_url}
              brandLogoUrl={brandLogoUrl}
              headlineOffset={TEXT_BOX_OFFSET}
              subtitleOffset={TEXT_BOX_OFFSET}
            />
          </div>
        )}

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
                  if (useCanvasTopic && canvasRef.current) {
                    canvasRef.current.downloadAsPng(`${fileBase}.png`)
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
                        let urlForFb: string
                        if (useFabricCanvas) {
                          // Render fabric canvas → PNG → upload to Cloudinary
                          // → use returned public URL for FB scheduling. Upload
                          // happens lazily here so un-scheduled ideas never
                          // touch Cloudinary.
                          const dataUrl = gempakCanvasRef.current?.getDataUrl()
                          if (!dataUrl) throw new Error('Canvas not ready')
                          const blob = await (await fetch(dataUrl)).blob()
                          const file = new File([blob], `${downloadPrefix}-${idea.type}.png`, { type: 'image/png' })
                          const publicId = await uploadToCloudinary(file)
                          const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
                          urlForFb = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`
                        } else if (useCanvasTopic && canvasRef.current) {
                          urlForFb = canvasRef.current.getDataUrl()
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
                      <Link to="/post-queue" className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
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
