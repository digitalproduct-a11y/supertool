import { useState, useRef, useEffect } from 'react'
import { IconDownload, IconChevronLeft } from '@tabler/icons-react'
import * as fabric from 'fabric'
import { uploadToCloudinary } from '../utils/cloudinary'
import type { DidYouKnowIdea } from '../hooks/useDidYouKnow'
import { toast } from '../hooks/useToast'

interface DidYouKnowCardProps {
  idea: DidYouKnowIdea
  edition: string
  brandLogoPublicId: string | null
  language: string
  onBack: () => void
  onUpdateField: (field: 'headline' | 'fact' | 'caption', value: string) => void
}

const editionTranslations: Record<string, Record<string, string>> = {
  'Edisi Piala Dunia': { ms: 'Edisi Piala Dunia', en: 'World Cup Edition' },
  'Edisi Liga Super Malaysia': { ms: 'Edisi Liga Super Malaysia', en: 'Super League Malaysia Edition' },
  'Edisi Piala Thomas/Uber': { ms: 'Edisi Piala Thomas/Uber', en: 'Thomas/Uber Cup Edition' },
}

export function DidYouKnowCard({ idea, edition, brandLogoPublicId, language, onBack, onUpdateField }: DidYouKnowCardProps) {
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasInstance = useRef<fabric.Canvas | null>(null)

  const isMalay = language === 'ms' || language.startsWith('ms') || language?.toLowerCase().includes('malay')
  const translatedEdition = editionTranslations[edition]?.[isMalay ? 'ms' : 'en'] || edition

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string
  const brandLogoUrl = brandLogoPublicId
    ? `https://res.cloudinary.com/${cloudName}/image/upload/${brandLogoPublicId}`
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

  const renderCanvas = async () => {
    if (!canvasInstance.current || !uploadedImageUrl) return

    try {
      canvasInstance.current.clear()

      const bgImage = await fabric.Image.fromURL(uploadedImageUrl, {
        crossOrigin: 'anonymous',
      })
      bgImage.scaleToWidth(1080)
      canvasInstance.current.add(bgImage)
      canvasInstance.current.sendObjectToBack(bgImage)

      const gradient = new fabric.Rect({
        width: 1080,
        height: 1350,
        fill: 'rgba(6,6,8,0.5)',
        selectable: false,
      })
      canvasInstance.current.add(gradient)

      const editionText = new fabric.Textbox(translatedEdition, {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fill: '#E9B949',
        fontWeight: 600,
        left: 20,
        top: 1180,
        selectable: false,
      })
      canvasInstance.current.add(editionText)

      const headlineText = new fabric.Textbox(idea.headline, {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 28,
        fontWeight: 900,
        fill: '#faf7ee',
        left: 20,
        top: 1100,
        width: 1040,
        selectable: false,
      })
      canvasInstance.current.add(headlineText)

      const factText = new fabric.Textbox(idea.fact, {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 12,
        fill: 'rgba(245,242,234,.9)',
        left: 35,
        top: 1220,
        width: 1000,
        selectable: false,
      })
      canvasInstance.current.add(factText)

      if (brandLogoUrl) {
        const logoImage = await fabric.Image.fromURL(brandLogoUrl, {
          crossOrigin: 'anonymous',
        })
        logoImage.scaleToHeight(40)
        logoImage.set({ left: 980, top: 50, selectable: false })
        canvasInstance.current.add(logoImage)
      }

      canvasInstance.current.renderAll()
    } catch (err) {
      console.error('Canvas rendering failed:', err)
      toast.error('Canvas rendering failed')
    }
  }

  useEffect(() => {
    if (!canvasRef.current) return

    canvasInstance.current = new fabric.Canvas(canvasRef.current, {
      width: 1080,
      height: 1350,
      backgroundColor: '#0a0a0c',
    })

    return () => {
      canvasInstance.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (uploadedImageUrl) {
      renderCanvas()
    }
  }, [uploadedImageUrl, idea.headline, idea.fact])

  const handleDownload = async () => {
    if (!canvasInstance.current) {
      toast.error('Please upload an image first')
      return
    }

    try {
      const canvas = canvasInstance.current.getElement() as HTMLCanvasElement
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Failed to create image')
          return
        }
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `didyouknow-${idea.id}.png`
        link.click()
        URL.revokeObjectURL(url)
        toast.success('Downloaded!')
      }, 'image/png')
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
            <div className="rounded-lg overflow-hidden shadow-lg" style={{ aspectRatio: '1080/1350' }}>
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ display: 'block' }}
              />
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
