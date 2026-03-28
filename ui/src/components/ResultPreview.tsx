import { useState, useEffect } from 'react'
import type { WorkflowResult } from '../types'
import { toast } from '../hooks/useToast'

interface ResultPreviewProps {
  result: WorkflowResult
  isRunning: boolean
  articleUrl: string
  onPostDraft?: (url: string, brand: string) => Promise<{success: boolean, message: string}>
}

export function ResultPreview({
  result,
  isRunning,
  articleUrl,
  onPostDraft,
}: ResultPreviewProps) {
  const [caption, setCaption] = useState(result.caption ?? '')
  const [copied, setCopied] = useState(false)
  const [draftState, setDraftState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')

  // Sync caption textarea when result.caption changes (e.g. after caption_only regen)
  useEffect(() => {
    setCaption(result.caption ?? '')
  }, [result.caption])

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

  async function handlePostDraftClick() {
    if (!onPostDraft || !articleUrl) return
    setDraftState('posting')
    try {
      const response = await onPostDraft(articleUrl, result.brand)
      if (response.success) {
        setDraftState('done')
        toast.success('Draft posted to Facebook!')
        setTimeout(() => setDraftState('idle'), 3000)
      } else {
        setDraftState('error')
        toast.error("Couldn't post draft. Please try again.")
      }
    } catch {
      setDraftState('error')
      toast.error("Couldn't post draft. Please try again.")
    }
  }

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

      {/* Create Draft button */}
      {onPostDraft && (
        <div className="pt-2">
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
                Posting draft…
              </span>
            ) : draftState === 'done' ? (
              '✓ Draft posted!'
            ) : (
              `Create Draft on ${result.brand.replace(/\b\w/g, c => c.toUpperCase())}'s FB`
            )}
          </button>
        </div>
      )}
    </div>
  )
}
