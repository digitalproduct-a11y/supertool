import { useState } from 'react'
import { createPortal } from 'react-dom'

interface ImageUploadModalProps {
  onSelect: (photo: { url: string; publicId: string }) => void
  onClose: () => void
}

export default function ImageUploadModal({ onSelect, onClose }: ImageUploadModalProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = (file: File | null) => {
    setUploadFile(file)
    setUploadError(null)
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
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
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file)
    } else {
      setUploadError('Please select an image file')
    }
  }

  const handleClose = () => {
    // Clean up preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    onClose()
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setIsUploading(true)
    setUploadError(null)

    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_TEMP_UPLOADS_PRESET as string | undefined

      if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary configuration missing')
      }

      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('upload_preset', uploadPreset)

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData }
      )

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`)
      }

      const data = await res.json()
      onSelect({ url: data.secure_url, publicId: data.public_id })
      handleClose()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-[0_2px_24px_rgba(0,0,0,0.12)]">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">Upload Image</h2>
            <p className="text-sm text-gray-600 mt-1">Drag and drop or select an image</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-900 text-2xl leading-none transition"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!uploadFile ? (
            <>
              {/* Drag and Drop */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
                  isDragging
                    ? 'border-neutral-900 bg-neutral-50'
                    : 'border-neutral-300 hover:border-neutral-400'
                }`}
              >
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-neutral-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6"
                  />
                </svg>
                <p className="text-sm font-medium text-neutral-900 mb-1">Drag and drop your image</p>
                <p className="text-xs text-neutral-500 mb-4">or click to browse</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="inline-block px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-medium rounded-lg cursor-pointer transition"
                >
                  Select File
                </label>
              </div>

              {uploadError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{uploadError}</div>
              )}
            </>
          ) : (
            <>
              {/* Image Preview */}
              {previewUrl && (
                <div className="rounded-lg overflow-hidden bg-neutral-100">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-64 object-cover"
                  />
                </div>
              )}

              {/* File Selected */}
              <div className="bg-neutral-50 rounded-lg p-4">
                <p className="text-sm font-medium text-neutral-900 mb-2">Selected:</p>
                <p className="text-sm text-neutral-600 truncate">{uploadFile.name}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <button
                onClick={() => handleFileSelect(null)}
                className="w-full px-3 py-2 border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition"
              >
                Choose Different File
              </button>

              {uploadError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{uploadError}</div>
              )}
            </>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!uploadFile || isUploading}
            className="w-full px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-500 text-white rounded-lg text-sm font-semibold transition"
          >
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
