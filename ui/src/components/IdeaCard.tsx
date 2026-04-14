import { useState, useEffect } from 'react'
import type { EngagementIdea } from '../types'
import { BRAND_LOGO_IDS } from '../constants/brands'
import PhotoPickerModal from './PhotoPickerModal'
import { toast } from '../hooks/useToast'

// ─── Schedule Time Modal ──────────────────────────────────────────────────────

function ScheduleTimeModal({
  brand,
  isPosting,
  onConfirm,
  onClose,
}: {
  brand: string
  isPosting: boolean
  onConfirm: (scheduledFor: string) => void
  onClose: () => void
}) {
  const [scheduledFor, setScheduledFor] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-950">Schedule on FB</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-neutral-500">Posting for <span className="font-medium text-neutral-800">{brand}</span></p>
        <input
          type="datetime-local"
          value={scheduledFor}
          onChange={e => setScheduledFor(e.target.value)}
          min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-700"
        />
        <button
          onClick={() => {
            if (!scheduledFor) {
              toast.error('Please pick a date and time.')
              return
            }
            onConfirm(new Date(scheduledFor).toISOString())
          }}
          disabled={isPosting || !scheduledFor}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isPosting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Scheduling…
            </span>
          ) : 'Schedule'}
        </button>
      </div>
    </div>
  )
}

const FORMAT_BADGES: Record<string, string> = {
  challenge: '🏆',
  debate: '💬',
  nostalgia: '🕐',
  quiz: '🧠',
  hot_take: '🔥',
}

const FORMAT_LABELS: Record<string, string> = {
  challenge: 'Challenge',
  debate: 'Debate',
  nostalgia: 'Nostalgia',
  quiz: 'Quiz',
  hot_take: 'Hot Take',
}

interface IdeaCardProps {
  idea: EngagementIdea
  onUpdateField: (ideaId: string, field: 'headline' | 'subtitle' | 'caption', value: string) => void
  onPhotoSelected: (ideaId: string, photo: { url: string; publicId: string }) => void
  onScheduleOnFB?: (previewUrl: string, caption: string, brand: string, scheduledFor?: string) => Promise<{ success: boolean; message: string }>
  selectedBrand: string
  index: number
  cachedPhotos?: Record<string, any[]>
  downloadPrefix?: string
  uploadPreset?: string
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
}: IdeaCardProps) {
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [committedHeadline, setCommittedHeadline] = useState(idea.headline)
  const [committedSubtitle, setCommittedSubtitle] = useState(idea.subtitle)

  // Sync committed values when a new idea is generated (idea.id changes)
  useEffect(() => {
    setCommittedHeadline(idea.headline)
    setCommittedSubtitle(idea.subtitle)
  }, [idea.id])

  const DEFAULT_PHOTO = 'placeholder_img_cveevd'
  const brandLogoId = BRAND_LOGO_IDS[selectedBrand as keyof typeof BRAND_LOGO_IDS] || 'stadium_astro_logo'

  const buildPreviewUrl = (headline: string, subtitle: string, photoPublicId: string | null) => {
    const enc = (t: string) => encodeURIComponent(encodeURIComponent(t))
    const photoId = photoPublicId || DEFAULT_PHOTO
    return [
      'https://res.cloudinary.com/dymmqtqyg/image/upload',
      'c_fill,g_face,w_1080,h_1350',
      'c_pad,w_1080,h_1350,g_north',
      'l_black_fade_pexvn5,c_fill,w_1080,h_1350/fl_layer_apply,g_south,y_0',
      `l_text:Montserrat_90_bold_normal_center_line_spacing_-20:${enc(headline)},co_rgb:FFFFFF,c_fit,w_900/fl_layer_apply,g_north,x_0,y_900`,
      `l_text:Montserrat_38_normal_center_line_spacing_0:${enc(subtitle)},co_rgb:FFFFFF,c_fit,w_850/fl_layer_apply,g_north,x_0,y_1100`,
      `l_${brandLogoId},w_150/fl_layer_apply,g_south,y_35`,
      photoId,
    ].join('/')
  }

  const previewUrl = buildPreviewUrl(committedHeadline, committedSubtitle, idea.photo_public_id)

  const headlineChars = idea.headline.length
  const subtitleChars = idea.subtitle.length
  const captionChars = idea.caption.length

  const headlineValid = headlineChars > 0 && headlineChars <= 35
  const subtitleValid = subtitleChars > 0 && subtitleChars <= 70
  const captionValid = captionChars > 0 && captionChars <= 600
  const photoValid = !!idea.photo_url

  return (
    <>
      <div className="flex flex-col">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-2 pb-3 border-b border-gray-200">
          <span className="text-sm font-semibold text-neutral-950">Idea {index + 1}</span>
          <div className="flex items-center gap-2">
            <span className="text-lg">{FORMAT_BADGES[idea.type]}</span>
            <span className="text-xs font-semibold text-gray-600 uppercase">{FORMAT_LABELS[idea.type]}</span>
          </div>
        </div>

        {/* Context, Player & Club Reference */}
        <p className="text-xs text-gray-500 mb-4">
          {idea.context && (
            <>
              Context: <span className="font-medium text-gray-700">{idea.context}</span>{' | '}
            </>
          )}
          Reference player: <span className="font-medium text-gray-700">{idea.player}</span>
          {idea.club && (
            <>
              {' | '}Club: <span className="font-medium text-gray-700">{idea.club}</span>
            </>
          )}
        </p>

        {/* Live Preview */}
        <div className={`aspect-[1080/1350] rounded-xl border-2 overflow-hidden bg-gray-100 mb-4`}>
          <img src={previewUrl} alt="Live preview" className="w-full h-full object-cover" />
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
                <span className="text-xs text-gray-500">{headlineChars}/35</span>
              </div>
              <input
                type="text"
                value={idea.headline}
                onChange={(e) => onUpdateField(idea.id, 'headline', e.target.value.slice(0, 35))}
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
                <span className="text-xs text-gray-500">{subtitleChars}/70</span>
              </div>
              <input
                type="text"
                value={idea.subtitle}
                onChange={(e) => onUpdateField(idea.id, 'subtitle', e.target.value.slice(0, 70))}
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
                <span className="text-xs text-gray-500">{captionChars}/600</span>
              </div>
              <textarea
                value={idea.caption}
                onChange={(e) => onUpdateField(idea.id, 'caption', e.target.value.slice(0, 600))}
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
                  const res = await fetch(previewUrl)
                  const blob = await res.blob()
                  const url = window.URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `${downloadPrefix}-${idea.type}.jpg`
                  link.click()
                  window.URL.revokeObjectURL(url)
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
                  <ScheduleTimeModal
                    brand={selectedBrand}
                    isPosting={isScheduling}
                    onConfirm={async (scheduledFor) => {
                      setIsScheduling(true)
                      const result = await onScheduleOnFB(previewUrl, idea.caption, selectedBrand, scheduledFor)
                      setIsScheduling(false)
                      setShowScheduleModal(false)
                      setScheduleStatus(result.success ? 'done' : 'error')
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
                  <p className="text-xs text-green-600 text-center">✓ Scheduled on Facebook</p>
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
        />
      )}
    </>
  )
}
