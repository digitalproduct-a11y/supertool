import { useRef, useState } from 'react'
import { IconDownload, IconChevronLeft } from '@tabler/icons-react'
import { buildDidYouKnowUrl, uploadToCloudinary } from '../utils/cloudinary'
import { BRAND_LOGO_IDS } from '../constants/brands'
import { toast } from '../hooks/useToast'
import type { DidYouKnowIdea } from '../hooks/useDidYouKnow'

interface DidYouKnowCardProps {
  idea: DidYouKnowIdea
  selectedBrand: string
  onBack: () => void
}

export function DidYouKnowCard({ idea, selectedBrand, onBack }: DidYouKnowCardProps) {
  const [uploadedImageId, setUploadedImageId] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [headline, setHeadline] = useState(idea.headline)
  const [fact, setFact] = useState(idea.fact)
  const [caption, setCaption] = useState(idea.caption)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const brandLogoId = BRAND_LOGO_IDS[selectedBrand.toLowerCase()] || 'astro_supersport_cwmnpk'
  const previewUrl = uploadedImageId
    ? buildDidYouKnowUrl(uploadedImageId, headline, fact, brandLogoId)
    : ''

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const publicId = await uploadToCloudinary(file)
      setUploadedImageId(publicId)
      toast.success('Image uploaded!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const publicId = await uploadToCloudinary(file)
      setUploadedImageId(publicId)
      toast.success('Image uploaded!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = async () => {
    if (!previewUrl) {
      toast.error('Please upload an image first')
      return
    }

    try {
      const res = await fetch(previewUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `did-you-know-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Downloaded!')
    } catch (err) {
      toast.error('Download failed')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        onClick={onBack}
        className="text-sm text-neutral-600 hover:text-neutral-950 transition flex items-center gap-1"
      >
        <IconChevronLeft className="w-4 h-4" />
        Back to ideas
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: Upload + Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neutral-950">Upload Background Image</h3>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative aspect-[1080/1350] rounded-2xl border-2 border-dashed cursor-pointer transition ${
              uploadedImageId
                ? 'border-green-300 bg-green-50'
                : isUploading
                  ? 'border-neutral-300 bg-neutral-50'
                  : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50 hover:bg-neutral-100'
            }`}
          >
            {uploadedImageId ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-cover rounded-xl"
              />
            ) : isUploading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin text-2xl mb-2">⚙️</div>
                  <p className="text-sm text-neutral-600">Uploading...</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <div className="text-4xl">📸</div>
                <p className="text-sm font-medium text-neutral-900">Drag & drop or click to upload</p>
                <p className="text-xs text-neutral-600">JPG, PNG up to 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* RIGHT: Edit Fields + Download */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neutral-950">Edit Content</h3>

          <div>
            <label className="block text-sm font-medium text-neutral-950 mb-2">
              Headline <span className="text-xs text-neutral-500">({headline.length}/35)</span>
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value.slice(0, 35))}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="e.g. Ronaldo's Double!"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-950 mb-2">
              Fact <span className="text-xs text-neutral-500">({fact.length}/70)</span>
            </label>
            <textarea
              value={fact}
              onChange={(e) => setFact(e.target.value.slice(0, 70))}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none h-20"
              placeholder="e.g. He scored 8 goals..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-950 mb-2">
              Caption <span className="text-xs text-neutral-500">({caption.length}/300)</span>
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 300))}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none h-24"
              placeholder="Full fact or story (up to 300 chars)"
            />
          </div>

          <button
            onClick={handleDownload}
            disabled={!uploadedImageId}
            className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            <IconDownload className="w-4 h-4" />
            Download Image
          </button>
        </div>
      </div>
    </div>
  )
}
