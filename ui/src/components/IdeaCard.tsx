import { useState } from 'react'
import type { EngagementIdea } from '../types'
import { BRAND_LOGO_IDS } from '../constants/brands'
import PhotoPickerModal from './PhotoPickerModal'

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
  selectedBrand,
  index,
  cachedPhotos,
  downloadPrefix = 'epl-post',
  uploadPreset,
}: IdeaCardProps) {
  const [showPhotoModal, setShowPhotoModal] = useState(false)

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

  const previewUrl = buildPreviewUrl(idea.headline, idea.subtitle, idea.photo_public_id)

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
