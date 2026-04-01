import { useState, useEffect, useRef } from 'react'
import type { WorkflowResult } from '../types'
import { toast } from '../hooks/useToast'

interface ResultPreviewProps {
  result: WorkflowResult
  isRunning: boolean
  onPostDraft?: (imageUrl: string, caption: string, brand: string, scheduledFor?: string, extraPhotos?: string[], postMode?: string) => Promise<{success: boolean, message: string, postId?: string, status?: string}>
}

export function ResultPreview({
  result,
  isRunning,
  onPostDraft,
}: ResultPreviewProps) {
  const [caption, setCaption] = useState(result.caption ?? '')
  const [copied, setCopied] = useState(false)
  const [draftState, setDraftState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [draftPostId, setDraftPostId] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<string | null>(null)
  const [postMode, setPostMode] = useState<'publish' | 'schedule' | 'draft'>('publish')
  const [scheduledFor, setScheduledFor] = useState('')
  const [extraPhotos, setExtraPhotos] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync caption textarea when result.caption changes (e.g. after caption_only regen)
  useEffect(() => {
    setCaption(result.caption ?? '')
  }, [result.caption])

  // Reset extra photos when a new AI image is generated
  useEffect(() => {
    setExtraPhotos([])
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

  function handleSlotClick() {
    if (extraPhotos.length < 9) fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtraPhotos(prev => [...prev, file].slice(0, 9))
    e.target.value = ''
  }

  function removeExtraPhoto(index: number) {
    setExtraPhotos(prev => prev.filter((_, i) => i !== index))
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
      const base64Extras = extraPhotos.length > 0
        ? await Promise.all(extraPhotos.map(file => new Promise<string>((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result as string)
            reader.onerror = rej
            reader.readAsDataURL(file)
          })))
        : undefined
      const response = await onPostDraft(result.imageUrl, caption, result.brand, isoSchedule, base64Extras, postMode)
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
        <img
          src={result.imageUrl}
          alt="Generated Facebook image"
          className="w-full aspect-[4/5] object-cover"
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
      </div>


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

    </div>
  )
}
