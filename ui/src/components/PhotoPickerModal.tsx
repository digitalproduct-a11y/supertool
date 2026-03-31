import { useState } from 'react'
import type { PhotoEmotion } from '../types'

const EMOTION_FILTERS: PhotoEmotion[] = ['positive', 'neutral', 'intense', 'historical']

interface PhotoPickerModalProps {
  playerName: string
  onSelect: (photoUrl: string) => void
  onClose: () => void
}

export default function PhotoPickerModal({ playerName, onSelect, onClose }: PhotoPickerModalProps) {
  const [selectedEmotion, setSelectedEmotion] = useState<PhotoEmotion | 'all'>('all')
  const [photos, setPhotos] = useState<string[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const handleUpload = async () => {
    if (!uploadFile) return

    try {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          onSelect(e.target.result as string)
        }
      }
      reader.readAsDataURL(uploadFile)
    } catch (err) {
      console.error('Upload failed:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-[0_2px_24px_rgba(0,0,0,0.12)]">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">Pick a Photo</h2>
            <p className="text-sm text-gray-600">Player: <span className="font-medium">{playerName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 text-2xl leading-none transition"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!showUpload ? (
            <>
              {/* Emotion Filters */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-3 uppercase">Emotion</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedEmotion('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedEmotion === 'all'
                        ? 'bg-neutral-950 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {EMOTION_FILTERS.map((emotion) => (
                    <button
                      key={emotion}
                      onClick={() => setSelectedEmotion(emotion)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                        selectedEmotion === emotion
                          ? 'bg-neutral-950 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {emotion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photos Grid */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-3 uppercase">Available Photos</p>
                {isLoadingPhotos ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border border-gray-200 border-t-neutral-900" />
                  </div>
                ) : photos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {photos.map((photo, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSelect(photo)}
                        className="aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden hover:ring-2 ring-neutral-900 transition-all"
                      >
                        <img src={photo} alt="Photo option" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-sm mb-4">No photos found for this player</p>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="inline-block px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-sm font-medium transition active:scale-[0.98]"
                    >
                      + Upload Photo
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Upload Form */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2 uppercase">Select Image</p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label htmlFor="photo-upload" className="cursor-pointer inline-block">
                      <div className="text-gray-400 mb-2 text-3xl">📁</div>
                      <p className="text-sm font-medium text-neutral-950">
                        {uploadFile ? uploadFile.name : 'Click to upload or drag & drop'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF (max 5MB)</p>
                    </label>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2 uppercase">Emotion Tag</p>
                  <select
                    defaultValue="positive"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition appearance-none"
                  >
                    {EMOTION_FILTERS.map((emotion) => (
                      <option key={emotion} value={emotion}>
                        {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-600 mt-2">
                    Player tag: <span className="font-medium">{playerName}</span> (pre-filled)
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-between gap-3">
          {showUpload ? (
            <>
              <button
                onClick={() => {
                  setShowUpload(false)
                  setUploadFile(null)
                }}
                className="flex-1 px-4 py-2 text-neutral-500 hover:text-neutral-900 underline text-xs font-medium transition"
              >
                ← Back
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile}
                className="flex-1 px-4 py-2 bg-neutral-950 hover:bg-neutral-800 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-lg text-xs font-medium transition active:scale-[0.98]"
              >
                Upload & Select
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowUpload(true)}
                className="flex-1 px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-medium transition"
              >
                + Upload New
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-neutral-500 hover:text-neutral-900 underline text-xs font-medium transition"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
