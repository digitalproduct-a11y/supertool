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
      const localUrl = URL.createObjectURL(file)
      console.log('Local blob URL created:', localUrl)
      setUploadedImageUrl(localUrl)

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
    console.log('renderCanvas called', { canvas: !!canvasInstance.current, url: !!uploadedImageUrl })

    if (!uploadedImageUrl) {
      console.log('Skip render - no URL')
      return
    }

    if (!canvasInstance.current) {
      const initialized = initializeCanvas()
      if (!initialized) {
        console.log('Failed to initialize canvas')
        return
      }
    }

    try {
      const canvas = canvasInstance.current!
      console.log('Starting canvas render with URL:', uploadedImageUrl)
      canvas.clear()

      const bgImage = await fabric.Image.fromURL(uploadedImageUrl)
      console.log('Background image loaded successfully')
      bgImage.set({
        left: 0,
        top: 0,
        scaleX: 1080 / (bgImage.width || 1080),
        scaleY: 1350 / (bgImage.height || 1350),
      })
      canvas.add(bgImage)
      canvas.sendObjectToBack(bgImage)
      console.log('Background image added and positioned')

      const gradient = new fabric.Rect({
        width: 1080,
        height: 1350,
        fill: 'rgba(6,6,8,0.5)',
        selectable: false,
      })
      canvas.add(gradient)
      canvas.sendObjectToBack(gradient)
      console.log('Gradient added')

      const editionText = new fabric.Text(translatedEdition, {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: '#E9B949',
        fontWeight: 'bold',
        left: 40,
        top: 1220,
        selectable: false,
      })
      canvas.add(editionText)
      console.log('Edition text added:', { text: translatedEdition, top: editionText.top, left: editionText.left })

      const headlineText = new fabric.Text(idea.headline, {
        fontFamily: 'Arial',
        fontSize: 32,
        fontWeight: 'bold',
        fill: '#faf7ee',
        left: 40,
        top: 1050,
        selectable: false,
      })
      canvas.add(headlineText)
      console.log('Headline text added:', { text: idea.headline, top: headlineText.top, left: headlineText.left })

      const factText = new fabric.Text(idea.fact.substring(0, 150), {
        fontFamily: 'Arial',
        fontSize: 13,
        fill: 'rgba(245,242,234,.9)',
        left: 40,
        top: 1100,
        selectable: false,
      })
      canvas.add(factText)
      console.log('Fact text added:', { textLength: idea.fact.length, top: factText.top, left: factText.left })

      if (brandLogoUrl) {
        console.log('Loading logo from:', brandLogoUrl)
        const logoImage = await fabric.Image.fromURL(brandLogoUrl, {
          crossOrigin: 'anonymous',
        })
        logoImage.scaleToHeight(40)
        logoImage.set({ left: 980, top: 50, selectable: false })
        canvas.add(logoImage)
        console.log('Logo loaded and added')
      }

      canvas.renderAll()
      console.log('Canvas render complete')
    } catch (err) {
      console.error('Canvas rendering failed:', err)
      toast.error('Canvas rendering failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const initializeCanvas = () => {
    if (canvasInstance.current) return
    if (!canvasRef.current) {
      console.log('Cannot initialize - canvas ref not available')
      return false
    }

    console.log('Creating fabric canvas')
    canvasInstance.current = new fabric.Canvas(canvasRef.current, {
      width: 1080,
      height: 1350,
      backgroundColor: '#0a0a0c',
    })
    console.log('Canvas created:', canvasInstance.current)
    return true
  }

  useEffect(() => {
    return () => {
      console.log('Disposing canvas')
      canvasInstance.current?.dispose()
    }
  }, [])

  useEffect(() => {
    console.log('Render effect triggered:', { uploadedImageUrl, headline: idea.headline })
    if (uploadedImageUrl) {
      renderCanvas()
    }
  }, [uploadedImageUrl, idea.headline, idea.fact])

  const handleDownload = async () => {
    if (!uploadedImageUrl) {
      toast.error('Please upload an image first')
      return
    }

    try {
      if (!canvasInstance.current) {
        const tempCanvas = new fabric.Canvas(document.createElement('canvas'), {
          width: 1080,
          height: 1350,
          backgroundColor: '#0a0a0c',
        })
        canvasInstance.current = tempCanvas
        await renderCanvas()
      }

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
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Download failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
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
                        alt="brand"
                        style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  {/* Spacer to push content to bottom */}
                  <div className="flex-1" />

                  {/* Edition label */}
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
                    {translatedEdition}
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
