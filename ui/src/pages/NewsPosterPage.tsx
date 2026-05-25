import { useRef, useEffect, useState, useCallback } from 'react'
import { StaticCanvas } from 'fabric'
import { BRANDS, getBrandLogoUrl } from '../constants/brands'
import { renderImageOnCanvas } from '../utils/canvasRenderingUtils'
import { useBrand } from '../context/BrandContext'
import { BackButton } from '../components/ds'

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1350

export function NewsPosterPage() {
  const { selectedBrand: globalBrand, isAdmin } = useBrand()
  const [selectedBrand, setSelectedBrand] = useState<string>((!isAdmin && globalBrand) ? globalBrand : '')
  const [headline, setHeadline] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isRendering, setIsRendering] = useState(false)

  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<StaticCanvas | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const render = useCallback(async () => {
    if (!canvasElRef.current || !imageUrl) return

    setIsRendering(true)

    if (fabricRef.current) {
      fabricRef.current.dispose()
      fabricRef.current = null
    }

    const el = canvasElRef.current
    ;(el as any).__fabricjsInstance = undefined
    el.width = CANVAS_WIDTH
    el.height = CANVAS_HEIGHT

    const canvas = new StaticCanvas(el, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#000',
    })

    const brandLogoUrl = selectedBrand ? getBrandLogoUrl(selectedBrand) : ''

    await renderImageOnCanvas(
      canvas,
      imageUrl,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      headline,
      subtitle,
      200,
      220,
      brandLogoUrl,
    )

    el.style.width = '100%'
    el.style.height = '100%'
    fabricRef.current = canvas
    setIsRendering(false)
  }, [imageUrl, headline, subtitle, selectedBrand])

  useEffect(() => {
    render()
    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  }, [render])

  useEffect(() => {
    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  }, [])

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImageUrl(url)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDownload = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 })
    const link = document.createElement('a')
    link.href = dataUrl
    const slug = headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80)
    link.download = `news-poster-${slug || 'untitled'}.png`
    link.click()
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <BackButton />
            <h1 className="text-2xl font-semibold text-neutral-950">News Poster</h1>
          </div>
          <p className="text-sm text-neutral-600">Create a branded news poster with headline, subtitle and brand logo.</p>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
          {/* Left: controls */}
          <div className="space-y-5">
            {/* Brand */}
            {(isAdmin || !globalBrand) && (
              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Brand</label>
                <div className="relative">
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full px-4 py-3 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition"
                  >
                    <option value="">Select a brand...</option>
                    {BRANDS.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Headline */}
            <div>
              <label className="block text-sm font-medium text-neutral-950 mb-2">Headline</label>
              <textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                rows={2}
                placeholder="Enter headline..."
                className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-sm font-medium text-neutral-950 mb-2">Subtitle</label>
              <textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={3}
                placeholder="Enter subtitle..."
                className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
              />
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-neutral-950 mb-2">Background Image</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                  isDragging ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                {imageFile ? (
                  <>
                    <img
                      src={imageUrl!}
                      alt="preview"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <p className="text-xs text-neutral-500">{imageFile.name}</p>
                    <p className="text-xs text-neutral-400">Click or drag to replace</p>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-neutral-500">Drag & drop or click to upload</p>
                    <p className="text-xs text-neutral-400">JPG, PNG, WEBP</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={!imageUrl || isRendering}
              className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
            >
              {isRendering ? 'Rendering...' : 'Download PNG'}
            </button>
          </div>

          {/* Right: canvas preview */}
          <div
            className="w-full rounded-xl border border-neutral-200 overflow-hidden"
            style={{ aspectRatio: '1080 / 1350', backgroundColor: '#000' }}
          >
            {imageUrl ? (
              <canvas
                ref={canvasElRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ display: 'block', width: '100%', height: '100%' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-neutral-500">Upload an image to see preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
