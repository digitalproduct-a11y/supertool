import { useState, useRef } from 'react'
import { IconDownload, IconChevronLeft } from '@tabler/icons-react'
import { DidYouKnowCanvas, type DidYouKnowCanvasHandle } from './DidYouKnowCanvas'
import type { DidYouKnowIdea } from '../hooks/useDidYouKnow'
import { toast } from '../hooks/useToast'

interface DidYouKnowCardProps {
  idea: DidYouKnowIdea
  brand: string
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

export function DidYouKnowCard({ idea, brand, edition, brandLogoPublicId, language, onBack, onUpdateField }: DidYouKnowCardProps) {
  const canvasRef = useRef<DidYouKnowCanvasHandle>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const isMalay = language === 'ms' || language.startsWith('ms') || language?.toLowerCase().includes('malay')
  const translatedEdition = editionTranslations[edition]?.[isMalay ? 'ms' : 'en'] || edition
  const captionHeader = isMalay ? 'TAHUKAH ANDA?' : 'DID YOU KNOW?'

  const brandLogo = brandLogoPublicId || 'default_logo'


  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    setUploadedImageUrl(URL.createObjectURL(file))
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

  const handleDownload = () => {
    if (!canvasRef.current) {
      toast.error('Preview not ready')
      return
    }

    canvasRef.current.downloadAsPng()
    toast.success('Downloaded!')
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
              value={`${captionHeader}\n\n${idea.caption}`}
              onChange={(e) => {
                const fullText = e.target.value
                const captionOnly = fullText.replace(/^(TAHUKAH ANDA\?|DID YOU KNOW\?)\n\n/, '')
                onUpdateField('caption', captionOnly.slice(0, 300))
              }}
              maxLength={300}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none font-mono"
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
            }`}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="block cursor-pointer">
              <p className="text-sm font-medium text-neutral-950">Upload background image</p>
              <p className="text-xs text-neutral-500 mt-1">Drag & drop or click to browse</p>
            </label>
          </div>

          {uploadedImageUrl && (
            <button
              onClick={handleDownload}
              className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <IconDownload className="w-4 h-4" />
              Download
            </button>
          )}
        </div>

        {/* Right: Preview */}
        <div>
          <p className="text-sm font-medium text-neutral-950 mb-2">Preview</p>
          <div className="w-full rounded-xl border border-neutral-200 overflow-hidden" style={{ aspectRatio: '1080 / 1350', backgroundColor: '#f5f5f5' }}>
            <DidYouKnowCanvas
              ref={canvasRef}
              idea={idea}
              imageUrl={uploadedImageUrl}
              brandLogoPublicId={brandLogo}
              translatedEdition={translatedEdition}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
