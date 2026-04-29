import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { CarouselImage } from '../types'
import { extractBaseImageUrl } from '../utils/cloudinary'

interface CarouselImagePickerModalProps {
  articleImages: string[]
  pexelsImages: CarouselImage[]   // max 10, type === 'pexels' from result.images
  onSelect: (payload: { kind: 'file'; file: File } | { kind: 'url'; url: string }) => void
  onClose: () => void
}

export function CarouselImagePickerModal({
  articleImages,
  pexelsImages,
  onSelect,
  onClose,
}: CarouselImagePickerModalProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleGridSelect = (url: string) => {
    setSelectedUrl(url)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setStagedFile(null)
  }

  const handleFileStage = (file: File) => {
    setSelectedUrl(null)
    setStagedFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
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
    if (file && file.type.startsWith('image/')) handleFileStage(file)
  }

  const handleClose = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    onClose()
  }, [previewUrl, onClose])

  const handleConfirm = () => {
    if (selectedUrl) {
      onSelect({ kind: 'url', url: selectedUrl })
    } else if (stagedFile) {
      onSelect({ kind: 'file', file: stagedFile })
    }
    // Note: do NOT revoke previewUrl here — the caller still needs to display
    // it as an instant preview until the Cloudinary upload completes.
    onClose()
  }

  const canConfirm = selectedUrl !== null || stagedFile !== null

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  return createPortal(
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-[0_2px_24px_rgba(0,0,0,0.12)]">

        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">Change Image</h2>
            <p className="text-sm text-gray-600 mt-1">Pick an image or upload your own</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-900 text-2xl leading-none transition"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Article images */}
          {articleImages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">From Article</p>
              <div className="grid grid-cols-2 gap-3">
                {articleImages.map((url) => (
                  <div key={url} className="relative">
                    <button
                      type="button"
                      onClick={() => handleGridSelect(url)}
                      className={`w-full block rounded-lg overflow-hidden border-2 transition ${
                        selectedUrl === url ? 'border-blue-600' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={url} alt="Article image" className="w-full h-auto" />
                    </button>
                    {selectedUrl === url && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
                        Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pexels images */}
          {pexelsImages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">From Pexels</p>
              <div className="grid grid-cols-2 gap-3">
                {pexelsImages.map((img) => {
                  const displaySrc = extractBaseImageUrl(img.src) ?? img.src
                  return (
                  <div key={img.id} className="relative">
                    <button
                      type="button"
                      onClick={() => handleGridSelect(img.src)}
                      className={`w-full block rounded-lg overflow-hidden border-2 transition ${
                        selectedUrl === img.src ? 'border-blue-600' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={displaySrc} alt={img.alt} className="w-full h-auto" />
                    </button>
                    {selectedUrl === img.src && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
                        Selected
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upload section */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">Upload Your Own</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileStage(file)
                e.target.value = ''
              }}
            />
            {!previewUrl ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-neutral-900 bg-neutral-50'
                    : 'border-neutral-300 hover:border-neutral-400'
                }`}
              >
                <p className="text-sm font-medium text-neutral-900 mb-1">Click to upload or drag & drop</p>
                <p className="text-xs text-neutral-500">PNG, JPG, GIF</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-100 rounded-lg overflow-hidden">
                  <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-48 object-contain" />
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
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-neutral-600 hover:text-neutral-900 border border-gray-300 rounded-lg text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 px-4 py-2 bg-neutral-950 hover:bg-neutral-800 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-lg text-xs font-medium transition active:scale-[0.98]"
          >
            Select Image
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
