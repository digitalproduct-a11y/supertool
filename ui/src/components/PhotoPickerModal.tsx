import { useState, useEffect, useRef } from 'react'
import { TOPIC_CONFIGS } from '../constants/topics'
import { signedUpload } from '../utils/imageProvider'

// Map an engagement topic to its ImageKit photo-bank folder (search is tag-based,
// so this is organizational; Cloudinary dual-run still tags identically).
function engagementFolder(topic?: string): string {
  const sport = topic === 'gempak-entertainment' ? 'entertainment' : (topic ?? 'misc')
  return `/engagement-photos/${sport}`
}

interface PhotoPickerModalProps {
  playerName: string
  club?: string
  onSelect: (photo: { url: string; publicId: string }) => void
  onClose: () => void
  cachedPhotos?: Record<string, any[]>
  uploadPreset?: string
  topic?: string
}

export default function PhotoPickerModal({
  playerName,
  club,
  onSelect,
  onClose,
  cachedPhotos,
  uploadPreset,
  topic,
}: PhotoPickerModalProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [photos, setPhotos] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [tags, setTags] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [showUploadSection, setShowUploadSection] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load photos from cache based on topic
  useEffect(() => {
    if (!cachedPhotos) {
      setPhotos([])
      return
    }

    const topicConfig = topic ? TOPIC_CONFIGS[topic] : null
    const cacheKey = topicConfig?.photosCacheKey || (playerName + (club || ''))
    setPhotos(cachedPhotos[cacheKey] || [])
  }, [topic, playerName, club, cachedPhotos])

  const handleFileSelect = (file: File | null) => {
    setUploadFile(file)
    setUploadError(null)
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      // Pre-fill tags based on topic config or player/club
      const topicConfig = topic ? TOPIC_CONFIGS[topic] : null
      const defaultTags = topicConfig?.photosCacheKey || (club ? `${playerName}, ${club}` : playerName)
      setTags(defaultTags)
      setShowUploadSection(true)
    } else {
      setPreviewUrl(null)
      setTags('')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !tags.trim()) return
    if (!uploadPreset) {
      setUploadError('Upload preset not configured')
      return
    }
    setIsUploading(true)
    setUploadError(null)

    try {
      const data = await signedUpload(uploadFile, uploadPreset, { tags, folder: engagementFolder(topic) })
      onSelect({ url: data.secure_url, publicId: data.public_id })
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.',
      )
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-[0_2px_24px_rgba(0,0,0,0.12)]">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">
              Select Photo
            </h2>
            <p className="text-sm text-gray-600">
              Searching photos tagged with{' '}
              <span className="font-medium">{playerName}</span>
              {club && (
                <>
                  , <span className="font-medium">{club}</span>
                </>
              )}
            </p>
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
          {/* File input must always be in DOM for button to work */}
          <input
            ref={fileInputRef}
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            className="hidden"
          />

          {/* Photos Grid */}
          {photos.length > 0 && !previewUrl && !showUploadSection && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-3 uppercase">Your Photos</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {photos.map((photo) => (
                  <div key={photo.public_id} className="relative">
                    <button
                      onClick={() => setSelectedPhotoId(photo.public_id)}
                      className="w-full block rounded-lg overflow-hidden"
                    >
                      <img
                        src={photo.secure_url}
                        alt="Photo option"
                        className="w-full h-auto"
                      />
                    </button>
                    {selectedPhotoId === photo.public_id && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
                        Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Section */}
          {(photos.length === 0 || showUploadSection) && (
            <div>
              {photos.length === 0 && !previewUrl && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800">
                    No photos found for this individual. Please upload one below.
                  </p>
                </div>
              )}
              {previewUrl && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-800">
                    This photo can be used in the future once uploaded
                  </p>
                </div>
              )}
              <p className="text-xs font-medium text-gray-700 mb-3 uppercase">
                Upload Photo
              </p>

              {!previewUrl ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
                    isDragging
                      ? 'border-neutral-900 bg-neutral-50'
                      : 'border-gray-300 bg-white'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <p className="text-sm font-medium text-neutral-950">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG, GIF (max 10MB)
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-gray-100 rounded-lg overflow-hidden mx-auto w-32">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-auto"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-2 text-xs text-neutral-600 hover:text-neutral-900 border border-gray-300 rounded-lg transition"
                  >
                    Change Photo
                  </button>
                </div>
              )}

              {/* Tags Input */}
              {uploadFile && (
                <div className="pt-6 border-t border-gray-200 mt-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2 uppercase">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g., Mohamed Salah, Liverpool"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Separate multiple tags with commas
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {uploadError && (
            <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
              {uploadError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 flex gap-3">
          <button
            onClick={() => {
              if (showUploadSection && photos.length > 0) {
                // Back to photo grid
                setShowUploadSection(false)
                setSelectedPhotoId(null)
                setUploadFile(null)
                setPreviewUrl(null)
              } else {
                // Open file picker directly
                fileInputRef.current?.click()
              }
            }}
            className="flex-1 px-4 py-2 text-neutral-600 hover:text-neutral-900 border border-gray-300 rounded-lg text-xs font-medium transition"
          >
            {showUploadSection && photos.length > 0 ? 'Back' : 'Upload New Photo'}
          </button>
          <button
            onClick={() => {
              if (selectedPhotoId) {
                const photo = photos.find((p) => p.public_id === selectedPhotoId)
                if (photo) {
                  onSelect({ url: photo.secure_url, publicId: photo.public_id })
                  setSelectedPhotoId(null)
                }
              } else {
                handleUpload()
              }
            }}
            disabled={!selectedPhotoId && (!uploadFile || isUploading || !tags.trim())}
            className="flex-1 px-4 py-2 bg-neutral-950 hover:bg-neutral-800 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-lg text-xs font-medium transition active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent" />
                Uploading...
              </>
            ) : (
              'Select Photo'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
