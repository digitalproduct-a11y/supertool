import { useState, useEffect, useRef } from 'react'
import { IconPhoto } from '@tabler/icons-react'
import type { WorkflowResult } from '../types'
import { toast } from '../hooks/useToast'

interface ResultPreviewProps {
  result: WorkflowResult
  isRunning: boolean
  onPostDraft?: (imageUrl: string, caption: string, brand: string, scheduledFor?: string, extraPhotos?: string[], postMode?: string) => Promise<{success: boolean, message: string, postId?: string, status?: string}>
  onCustomImageUpload?: (file: File) => void
  isImageGenerating?: boolean
}

export function ResultPreview({
  result,
  isRunning,
  onPostDraft,
  onCustomImageUpload,
  isImageGenerating = false,
}: ResultPreviewProps) {
  const [caption, setCaption] = useState(result.caption ?? '')
  const [copied, setCopied] = useState(false)
  const [draftState, setDraftState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [draftPostId, setDraftPostId] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<string | null>(null)
  const [postMode, setPostMode] = useState<'publish' | 'schedule' | 'draft'>('publish')
  const [scheduledFor, setScheduledFor] = useState('')
  const [extraPhotos, setExtraPhotos] = useState<File[]>([])
  const [aiImageRemoved, setAiImageRemoved] = useState(false)
  const [replacementAiPhoto, setReplacementAiPhoto] = useState<File | null>(null)
  const [replacementPreviewUrl, setReplacementPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // Sync caption textarea when result.caption changes (e.g. after caption_only regen)
  useEffect(() => {
    setCaption(result.caption ?? '')
  }, [result.caption])

  // Reset extra photos and image controls when a new AI image is generated
  useEffect(() => {
    if (replacementPreviewUrl) URL.revokeObjectURL(replacementPreviewUrl)
    setExtraPhotos([])
    setAiImageRemoved(false)
    setReplacementAiPhoto(null)
    setReplacementPreviewUrl(null)
  }, [result.imageUrl])

  async function handleDownload() {
    try {
      const res = await fetch(result.imageUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${result.brand}_${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(result.imageUrl, '_blank')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtraPhotos(prev => [...prev, file].slice(0, 9))
    e.target.value = ''
  }

  function handleReplaceAiImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (replacementPreviewUrl) URL.revokeObjectURL(replacementPreviewUrl)
    setReplacementAiPhoto(file)
    setReplacementPreviewUrl(URL.createObjectURL(file))
    setAiImageRemoved(false)
    e.target.value = ''
  }

  function handleRestoreAiImage() {
    if (replacementPreviewUrl) URL.revokeObjectURL(replacementPreviewUrl)
    setAiImageRemoved(false)
    setReplacementAiPhoto(null)
    setReplacementPreviewUrl(null)
  }

  async function handlePostDraftClick() {
    if (!onPostDraft) return
    if (postMode === 'schedule' && !scheduledFor) {
      toast.error('Please pick a date and time to schedule.')
      return
    }
    setDraftState('posting')
    try {
      const isoSchedule = postMode === 'schedule' ? new Date(scheduledFor).toISOString() : undefined
      const effectiveAiImageUrl = (aiImageRemoved || replacementAiPhoto) ? '' : result.imageUrl
      const allExtras = replacementAiPhoto ? [replacementAiPhoto, ...extraPhotos] : extraPhotos
      const base64Extras = allExtras.length > 0
        ? await Promise.all(allExtras.map(file => new Promise<string>((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result as string)
            reader.onerror = rej
            reader.readAsDataURL(file)
          })))
        : undefined
      const response = await onPostDraft(effectiveAiImageUrl, caption, result.brand, isoSchedule, base64Extras, postMode)
      if (response.success) {
        setDraftState('done')
        setDraftPostId(response.postId ?? null)
        setDraftStatus(response.status ?? null)
        if (response.status === 'DRAFT_SAVED') {
          toast.success('Draft saved! Review it on Zernio before publishing.')
        } else {
          toast.success(postMode === 'schedule' ? 'Post scheduled on Facebook!' : 'Published to Facebook!')
        }
      } else {
        setDraftState('error')
        toast.error(response.message || "Couldn't post. Please try again.")
      }
    } catch {
      setDraftState('error')
      toast.error("Couldn't post. Please try again.")
    }
  }

  const brandLabel = result.brand.replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="space-y-4">
      {/* Image with download overlay */}
      <div className="relative bg-neutral-50 rounded-xl overflow-hidden border border-gray-200">
        {isImageGenerating ? (
          <div className="w-full aspect-[4/5] animate-pulse bg-neutral-200" />
        ) : aiImageRemoved && !replacementPreviewUrl ? (
          <div className="flex flex-col items-center justify-center w-full aspect-[4/5] text-gray-400">
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">AI image removed</p>
            <button
              onClick={handleRestoreAiImage}
              className="text-xs text-neutral-500 hover:text-neutral-700 mt-2 underline"
            >
              Restore
            </button>
          </div>
        ) : (
          <>
            <img
              src={replacementPreviewUrl || result.imageUrl}
              alt="Generated Facebook image"
              className="w-full"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = ''
              }}
            />
            <div className="absolute top-3 right-3">
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </>
        )}
      </div>

      {/* Hidden file inputs for photo upload */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={handleReplaceAiImage} />

      {/* Custom image upload */}
      {onCustomImageUpload && (
        <label className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 cursor-pointer bg-white hover:bg-gray-50 transition-colors ${isImageGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
          <IconPhoto size={16} />
          Upload Custom Image
          <input type="file" accept="image/*" className="hidden"
            disabled={isImageGenerating}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onCustomImageUpload(f)
              e.target.value = ''
            }} />
        </label>
      )}

      {/* Caption section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Caption</label>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400">{caption.length} characters</p>
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
          onChange={(e) => setCaption(e.target.value)}
          rows={8}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent font-sans leading-relaxed"
        />
      </div>

      {/* Post mode toggle + action */}
      {onPostDraft && (
        <div className="pt-2 space-y-3">
          {/* Publish Now / Schedule toggle */}
          {draftState !== 'done' && (
            <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl">
              <button
                onClick={() => setPostMode('publish')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition ${postMode === 'publish' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                Publish Now
              </button>
              <button
                onClick={() => setPostMode('schedule')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition ${postMode === 'schedule' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                Schedule
              </button>
              <button
                onClick={() => setPostMode('draft')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition ${postMode === 'draft' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                Draft
              </button>
            </div>
          )}

          {/* Date/time picker (schedule mode only) */}
          {postMode === 'schedule' && draftState !== 'done' && (
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-700"
            />
          )}

          {/* Action button */}
          <button
            onClick={handlePostDraftClick}
            disabled={draftState === 'posting' || isRunning}
            className={`w-full py-3 px-4 font-medium rounded-xl transition text-sm ${
              draftState === 'done'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 text-white'
            }`}
          >
            {draftState === 'posting' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                {postMode === 'draft' ? 'Saving draft…' : postMode === 'schedule' ? 'Scheduling…' : 'Publishing…'}
              </span>
            ) : draftState === 'done' ? (
              draftStatus === 'DRAFT_SAVED' ? '✓ Draft Saved' : postMode === 'schedule' ? '✓ Scheduled!' : '✓ Published!'
            ) : postMode === 'draft' ? (
              `Save as Draft on ${brandLabel}'s FB`
            ) : postMode === 'schedule' ? (
              `Schedule on ${brandLabel}'s FB`
            ) : (
              `Publish on ${brandLabel}'s FB`
            )}
          </button>

          {draftPostId && (
            <p className="text-xs text-neutral-400 text-center">
              Post ID: <span className="font-mono text-neutral-600 select-all">{draftPostId}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
