import { useState } from 'react'
import { IconDownload, IconChevronLeft } from '@tabler/icons-react'
import { buildDidYouKnowUrl, uploadToCloudinary } from '../utils/cloudinary'
import { BRAND_LOGO_IDS } from '../constants/brands'
import type { DidYouKnowIdea } from '../hooks/useDidYouKnow'
import { toast } from '../hooks/useToast'

interface DidYouKnowCardProps {
  idea: DidYouKnowIdea
  brand: string
  edition: string
  brandLogoPublicId: string | null
  onBack: () => void
  onUpdateField: (field: 'headline' | 'fact' | 'caption', value: string) => void
}

export function DidYouKnowCard({ idea, brand, edition, brandLogoPublicId, onBack, onUpdateField }: DidYouKnowCardProps) {
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string
  const brandLogo = brandLogoPublicId || (BRAND_LOGO_IDS[brand as keyof typeof BRAND_LOGO_IDS] || 'default_logo')
  const brandLogoUrl = brandLogoPublicId
    ? `https://res.cloudinary.com/${cloudName}/image/upload/${brandLogoPublicId}`
    : null

  const previewUrl = uploadedImageId
    ? buildDidYouKnowUrl(uploadedImageId, idea.headline, idea.fact, brandLogo)
    : null

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    setIsUploading(true)
    try {
      // Create local preview URL
      const localUrl = URL.createObjectURL(file)
      setUploadedImageUrl(localUrl)

      // Also upload to Cloudinary for final download/export
      const publicId = await uploadToCloudinary(file)
      setUploadedImageId(publicId)
      toast.success('Image uploaded!')
    } catch (err) {
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsUploading(false)
    }
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

  const handleDownload = async () => {
    if (!previewUrl) {
      toast.error('Please upload an image first')
      return
    }

    try {
      const response = await fetch(previewUrl + '?dl=download')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `didyouknow-${idea.id}.jpg`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded!')
    } catch {
      toast.error('Download failed')
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
              value={idea.caption}
              onChange={(e) => onUpdateField('caption', e.target.value.slice(0, 300))}
              maxLength={300}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
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
            } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
              id="image-upload"
              disabled={isUploading}
            />
            <label htmlFor="image-upload" className="block cursor-pointer">
              <p className="text-sm font-medium text-neutral-950">
                {isUploading ? 'Uploading...' : 'Upload background image'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">Drag & drop or click to browse</p>
            </label>
          </div>

          {uploadedImageId && (
            <button
              onClick={handleDownload}
              className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <IconDownload className="w-4 h-4" />
              Download
            </button>
          )}
        </div>

        {/* Right: Live preview */}
        <div>
          <p className="text-sm font-medium text-neutral-950 mb-2">Preview</p>
          {uploadedImageUrl ? (
            <div className="rounded-lg overflow-hidden shadow-lg bg-neutral-900" style={{ aspectRatio: '1080/1350' }}>
              {/* Tribune poster design */}
              <div
                className="w-full h-full relative"
                style={{
                  background: '#0a0a0c',
                }}
              >
                {/* Full-bleed background image */}
                <img
                  src={uploadedImageUrl}
                  alt="background"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg,
                      rgba(6,6,8,0) 0%,
                      rgba(6,6,8,0.100) 30%,
                      rgba(6,6,8,0.506) 55%,
                      rgba(6,6,8,0.810) 78%,
                      rgba(6,6,8,0.92) 100%)`,
                  }}
                />

                {/* Content container */}
                <div className="absolute inset-0 flex flex-col" style={{ padding: '0 20px' }}>
                  {/* Logo at top */}
                  {brandLogoUrl && (
                    <div className="mt-2 mb-12 flex justify-end pr-2">
                      <img
                        src={brandLogoUrl}
                        alt={brand}
                        style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  {/* Spacer to push content to bottom */}
                  <div className="flex-1" />

                  {/* Imbas Kembali above headline */}
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10px',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      color: '#E9B949',
                      fontWeight: 600,
                      marginBottom: '8px',
                      lineHeight: '1.3',
                      backgroundColor: '#000000',
                      padding: '2px 4px',
                      display: 'inline-block',
                      width: 'fit-content',
                    }}
                  >
                    Imbas Kembali — {edition}
                  </div>

                  {/* Headline */}
                  <h1
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: '24px',
                      fontWeight: 900,
                      fontStyle: 'normal',
                      lineHeight: '0.98',
                      letterSpacing: '-1.2px',
                      color: '#faf7ee',
                      margin: '0 0 8px 0',
                      padding: '2px 0',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      WebkitTextStroke: '0.7px #faf7ee',
                    }}
                  >
                    {idea.headline}
                  </h1>

                  {/* Divider */}
                  <div
                    style={{
                      width: '120px',
                      height: '1px',
                      background: 'rgba(250,247,238,.35)',
                      marginBottom: '12px',
                    }}
                  />

                  {/* Fact body with accent rule */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', alignItems: 'stretch', marginBottom: '40px' }}>
                    <div
                      style={{
                        width: '3px',
                        background: '#E9B949',
                        flexShrink: 0,
                      }}
                    />
                    <p
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: '12px',
                        fontWeight: 400,
                        lineHeight: '1.5',
                        color: 'rgba(245,242,234,.9)',
                        margin: 0,
                        padding: 0,
                      }}
                    >
                      {idea.fact}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 aspect-[1080/1350] flex items-center justify-center">
              <p className="text-sm text-neutral-500">Upload an image to see preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
