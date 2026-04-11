import { useState, useRef, useCallback, useEffect } from 'react'
import JSZip from 'jszip'
import type { CarouselResult } from '../types'
import { toast } from '../hooks/useToast'
import { updateTitleInImageUrl } from '../utils/cloudinary'

interface ImageReplacement {
  file: File
  previewUrl: string
}

interface CarouselResultPreviewProps {
  result: CarouselResult
}

export function CarouselResultPreview({ result }: CarouselResultPreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [replacements, setReplacements] = useState<Map<string, ImageReplacement>>(new Map())
  const [title, setTitle] = useState(result.title ?? '')
  const [caption, setCaption] = useState(result.caption ?? '')
  const [isZipping, setIsZipping] = useState(false)
  const [copied, setCopied] = useState(false)
  const [slideTitles, setSlideTitles] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const img of result.images) {
      if (img.imageTitle) map.set(img.id, img.imageTitle)
    }
    return map
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetIdRef = useRef<string | null>(null)

  // Sync fields when result changes
  useEffect(() => { setTitle(result.title ?? '') }, [result.title])
  useEffect(() => { setCaption(result.caption ?? '') }, [result.caption])
  useEffect(() => {
    const map = new Map<string, string>()
    for (const img of result.images) {
      if (img.imageTitle) map.set(img.id, img.imageTitle)
    }
    setSlideTitles(map)
  }, [result.images])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      replacements.forEach(r => URL.revokeObjectURL(r.previewUrl))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: active (non-deleted) images
  const activeImages = result.images.filter(img => !deletedIds.has(img.id))

  // Clamp selectedIndex when active images shrink
  const clampedIndex = Math.min(selectedIndex, Math.max(0, activeImages.length - 1))
  const currentImage = activeImages[clampedIndex]

  function getDisplayUrl(id: string, fallback: string): string {
    const replacement = replacements.get(id)
    if (replacement) return replacement.previewUrl

    // If user has edited the slide title, rebuild the Cloudinary URL with the new title
    const img = result.images.find(i => i.id === id)
    if (img?.imageTitle) {
      const currentTitle = slideTitles.get(id)
      if (currentTitle !== undefined && currentTitle !== img.imageTitle) {
        return updateTitleInImageUrl(fallback, img.imageTitle, currentTitle)
      }
    }

    return fallback
  }

  // Navigation
  const goLeft = useCallback(() => {
    setSelectedIndex(i => Math.max(0, i - 1))
  }, [])

  const goRight = useCallback(() => {
    setSelectedIndex(i => Math.min(activeImages.length - 1, i + 1))
  }, [activeImages.length])

  // Download single image
  async function downloadImage(id: string, src: string, index: number) {
    const url = getDisplayUrl(id, src)
    const replacement = replacements.get(id)
    try {
      let blob: Blob
      if (replacement) {
        blob = replacement.file
      } else {
        const res = await fetch(url)
        blob = await res.blob()
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${result.brand}_${String(index + 1).padStart(2, '0')}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(url, '_blank')
    }
  }

  // Replace image — open file picker
  function openReplace(imageId: string) {
    replaceTargetIdRef.current = imageId
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const targetId = replaceTargetIdRef.current
    if (!file || !targetId) return
    const previewUrl = URL.createObjectURL(file)
    setReplacements(prev => {
      const next = new Map(prev)
      const old = next.get(targetId)
      if (old) URL.revokeObjectURL(old.previewUrl)
      next.set(targetId, { file, previewUrl })
      return next
    })
    e.target.value = ''
    replaceTargetIdRef.current = null
  }

  // Delete image (soft)
  function handleDelete(imageId: string) {
    const idx = activeImages.findIndex(img => img.id === imageId)
    const newActive = activeImages.filter(img => img.id !== imageId)
    setDeletedIds(prev => new Set([...prev, imageId]))
    if (newActive.length === 0) {
      setSelectedIndex(0)
    } else if (idx <= clampedIndex && clampedIndex > 0) {
      setSelectedIndex(s => s - 1)
    }
  }

  // Restore image
  function handleRestore(imageId: string) {
    setDeletedIds(prev => {
      const next = new Set(prev)
      next.delete(imageId)
      return next
    })
  }

  // Download all as ZIP
  async function handleDownloadZip() {
    if (activeImages.length === 0) {
      toast.error('No images to download.')
      return
    }
    setIsZipping(true)
    const zip = new JSZip()
    let failCount = 0

    for (let i = 0; i < activeImages.length; i++) {
      const img = activeImages[i]
      const replacement = replacements.get(img.id)
      const url = getDisplayUrl(img.id, img.src)
      try {
        let blob: Blob
        if (replacement) {
          blob = replacement.file
        } else {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          blob = await res.blob()
        }
        zip.file(`${result.brand}_${String(i + 1).padStart(2, '0')}.jpg`, blob)
      } catch {
        failCount++
      }
    }

    const successCount = activeImages.length - failCount
    if (successCount === 0) {
      toast.error('All downloads failed. Please check your connection.')
      setIsZipping(false)
      return
    }
    if (failCount > 0) {
      toast.error(`${failCount} image(s) could not be fetched and were skipped.`)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(zipBlob)
    a.download = `${result.brand}_carousel_${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
    setIsZipping(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const deletedImages = result.images.filter(img => deletedIds.has(img.id))

  return (
    <div className="space-y-4">
      {/* Hidden file input for image replacement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main image viewer */}
      <div className="relative bg-neutral-50 rounded-xl overflow-hidden border border-gray-200 aspect-[4/5] w-full">
        {currentImage ? (
          <>
            <img
              key={currentImage.id}
              src={getDisplayUrl(currentImage.id, currentImage.src)}
              alt={currentImage.alt}
              className="w-full h-full object-cover animate-fade-slide-up"
              onError={(e) => { (e.target as HTMLImageElement).src = '' }}
            />

            {/* Nav arrows */}
            {clampedIndex > 0 && (
              <button
                onClick={goLeft}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                aria-label="Previous image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {clampedIndex < activeImages.length - 1 && (
              <button
                onClick={goRight}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                aria-label="Next image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Position counter */}
            {activeImages.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
                {clampedIndex + 1} / {activeImages.length}
              </div>
            )}

            {/* Download + Replace buttons for active image */}
            <div className="absolute top-3 right-3 flex gap-1.5">
              <button
                onClick={() => openReplace(currentImage.id)}
                title="Replace image"
                className="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h14M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              <button
                onClick={() => downloadImage(currentImage.id, currentImage.src, clampedIndex)}
                title="Download image"
                className="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              {currentImage.type === 'pexels' && (
                <button
                  onClick={() => handleDelete(currentImage.id)}
                  title="Remove from carousel"
                  className="w-8 h-8 rounded-lg bg-black/50 hover:bg-red-600/80 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center w-full h-full text-gray-400 text-sm">
            No images in carousel
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {result.images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {result.images.map((img, originalIndex) => {
            const isDeleted = deletedIds.has(img.id)
            const activeIdx = activeImages.findIndex(a => a.id === img.id)
            const isSelected = !isDeleted && activeIdx === clampedIndex

            return (
              <div
                key={img.id}
                className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
                  isDeleted
                    ? 'opacity-30 border-dashed border-gray-300 cursor-default'
                    : isSelected
                    ? 'border-neutral-950 shadow-sm'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                onClick={() => {
                  if (!isDeleted) setSelectedIndex(activeIdx)
                }}
              >
                <img
                  src={getDisplayUrl(img.id, img.src)}
                  alt={img.alt}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = '' }}
                />

                {/* Hero badge */}
                {img.type === 'hero' && (
                  <div className="absolute top-1 left-1 px-1 py-0.5 rounded text-[9px] font-bold bg-neutral-950 text-white leading-none">
                    MAIN
                  </div>
                )}

                {/* Deleted overlay */}
                {isDeleted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRestore(img.id) }}
                      className="text-[10px] font-semibold text-neutral-700 underline"
                    >
                      Restore
                    </button>
                  </div>
                )}

                {/* Hover overlay — actions */}
                {!isDeleted && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-center gap-1 pt-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); openReplace(img.id) }}
                      title="Replace"
                      className="w-6 h-6 rounded bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h14M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadImage(img.id, img.src, originalIndex) }}
                      title="Download"
                      className="w-6 h-6 rounded bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    {img.type === 'pexels' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(img.id) }}
                        title="Delete"
                        className="w-6 h-6 rounded bg-white/20 hover:bg-red-500/70 text-white flex items-center justify-center transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Restored deleted images notice */}
      {deletedImages.length > 0 && (
        <p className="text-xs text-gray-400">
          {deletedImages.length} image{deletedImages.length > 1 ? 's' : ''} removed from carousel.{' '}
          <button
            onClick={() => setDeletedIds(new Set())}
            className="underline hover:text-gray-600 transition-colors"
          >
            Restore all
          </button>
        </p>
      )}

      {/* Editable fields */}
      <div className="space-y-4">
        {/* Image Title — editable per-slide if imageTitle exists, otherwise post title */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Image Title</label>
            {currentImage?.imageTitle && !replacements.has(currentImage.id) && slideTitles.get(currentImage.id) !== currentImage.imageTitle ? (
              <button
                onClick={() => setSlideTitles(prev => {
                  const next = new Map(prev)
                  next.set(currentImage.id, currentImage.imageTitle!)
                  return next
                })}
                className="text-[11px] text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                Reset
              </button>
            ) : (
              <span className="text-xs text-gray-400">{(currentImage?.imageTitle ? (slideTitles.get(currentImage.id) ?? currentImage.imageTitle) : title).length}</span>
            )}
          </div>
          {currentImage?.imageTitle && !replacements.has(currentImage.id) ? (
            <input
              key={currentImage.id}
              type="text"
              value={slideTitles.get(currentImage.id) ?? currentImage.imageTitle}
              onChange={(e) => {
                const id = currentImage.id
                setSlideTitles(prev => {
                  const next = new Map(prev)
                  next.set(id, e.target.value)
                  return next
                })
              }}
              placeholder="Enter image title…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
            />
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
            />
          )}
        </div>

        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Caption</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{caption.length}/600</span>
              <button onClick={handleCopy} title="Copy caption" className="text-neutral-400 hover:text-neutral-700 transition">
                {copied
                  ? <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                }
              </button>
            </div>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 600))}
            rows={8}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent font-sans leading-relaxed transition"
          />
        </div>
      </div>

      {/* Download ZIP */}
      <button
        onClick={handleDownloadZip}
        disabled={isZipping || activeImages.length === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 text-white disabled:text-neutral-400 rounded-xl text-sm font-medium transition-colors"
      >
        {isZipping ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Packaging zip…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download all as ZIP ({activeImages.length} image{activeImages.length !== 1 ? 's' : ''})
          </>
        )}
      </button>
    </div>
  )
}
