import { useState, useRef, useEffect } from 'react'
import type { WorkflowResult, TitleMode, CaptionTitleMode, WorkflowOperation } from '../types'

interface ResultPreviewProps {
  result: WorkflowResult
  titleMode: TitleMode
  customTitle: string
  captionTitleMode: CaptionTitleMode
  isRunning: boolean
  onApprove: (caption: string) => void
  onPartialRegenerate: (op: WorkflowOperation, titleMode: TitleMode, customTitle: string, captionTitleMode: CaptionTitleMode) => void
}

export function ResultPreview({
  result,
  titleMode,
  customTitle,
  captionTitleMode,
  isRunning,
  onPartialRegenerate,
}: ResultPreviewProps) {
  const [caption, setCaption] = useState(result.caption ?? '')
  const [copied, setCopied] = useState(false)
  const [editingImageTitle, setEditingImageTitle] = useState(false)
  const [editingCaption, setEditingCaption] = useState(false)
  const [localTitleMode, setLocalTitleMode] = useState<TitleMode>(titleMode)
  const [localCustomTitle, setLocalCustomTitle] = useState(customTitle)
  const [localCaptionTitleMode, setLocalCaptionTitleMode] = useState<CaptionTitleMode>(captionTitleMode)
  const [loadingSection, setLoadingSection] = useState<'image' | 'caption' | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync caption textarea when result.caption changes (e.g. after caption_only regen)
  useEffect(() => {
    setCaption(result.caption ?? '')
  }, [result.caption])

  // Clear loading section indicator once the request finishes
  useEffect(() => {
    if (!isRunning) setLoadingSection(null)
  }, [isRunning])

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

  async function copyCaption() {
    await navigator.clipboard.writeText(caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleConfirmImageTitle() {
    setLoadingSection('image')
    onPartialRegenerate('image_only', localTitleMode, localCustomTitle, localCaptionTitleMode)
    setEditingImageTitle(false)
  }

  function handleConfirmCaption() {
    setLoadingSection('caption')
    onPartialRegenerate('caption_only', localTitleMode, localCustomTitle, localCaptionTitleMode)
    setEditingCaption(false)
  }

  function handleCancelImageTitle() {
    setEditingImageTitle(false)
    setLocalTitleMode(titleMode)
    setLocalCustomTitle(customTitle)
  }

  function handleCancelCaption() {
    setEditingCaption(false)
    setLocalCaptionTitleMode(captionTitleMode)
  }

  return (
    <div className="space-y-4">
      {/* Image label */}
      <label className="text-sm font-medium text-gray-700 block">Image</label>

      {/* Image preview */}
      <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-square flex items-center justify-center relative">
        {loadingSection === 'image' ? (
          <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm font-medium">Regenerating image…</span>
          </div>
        ) : (
          <img
            src={result.imageUrl}
            alt="Generated Facebook image"
            className="w-full h-full object-contain"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = ''
            }}
          />
        )}
      </div>

      {/* Image actions */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold rounded-lg transition text-sm"
          disabled={isRunning}
        >
          Download
        </button>
        <button
          onClick={() => setEditingImageTitle(!editingImageTitle)}
          className="flex-1 py-2 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition text-sm disabled:opacity-50"
          disabled={isRunning}
        >
          Edit Image Title
        </button>
      </div>

      {/* Edit image title inline */}
      {editingImageTitle && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="text-xs font-medium text-gray-700 block">Image Title</label>
          <div className="flex gap-1 bg-white rounded-lg p-1 w-fit">
            {(['original', 'ai', 'custom'] as const).map((tm) => (
              <button
                key={tm}
                type="button"
                onClick={() => setLocalTitleMode(tm)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  localTitleMode === tm ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tm === 'original' ? 'Original' : tm === 'ai' ? 'AI ✨' : 'Custom'}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-500">
            {localTitleMode === 'original' && "Uses the article's headline as-is"}
            {localTitleMode === 'ai' && "AI generates the headline according to your brand voice"}
            {localTitleMode === 'custom' && "Enter your custom headline below"}
          </p>

          {localTitleMode === 'custom' && (
            <input
              type="text"
              value={localCustomTitle}
              onChange={(e) => setLocalCustomTitle(e.target.value)}
              placeholder="Enter custom title"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleConfirmImageTitle}
              disabled={isRunning || (localTitleMode === 'custom' && !localCustomTitle.trim())}
              className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold rounded-lg transition text-sm"
            >
              Confirm
            </button>
            <button
              onClick={handleCancelImageTitle}
              disabled={isRunning}
              className="flex-1 py-2 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Caption section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 block">Caption</label>
          <p className="text-xs text-gray-400">{caption.length} characters</p>
        </div>

        {loadingSection === 'caption' ? (
          <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center gap-2 text-gray-400" style={{minHeight: '10rem'}}>
            <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm">Regenerating caption…</span>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent font-sans leading-relaxed"
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={copyCaption}
            className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition text-sm"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => setEditingCaption(!editingCaption)}
            className="flex-1 py-2 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition text-sm disabled:opacity-50"
            disabled={isRunning}
          >
            Readjust Caption
          </button>
        </div>
      </div>

      {/* Edit caption inline */}
      {editingCaption && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="text-xs font-medium text-gray-700 block">Caption Title</label>
          <div className="flex gap-1 bg-white rounded-lg p-1 w-fit">
            {(['original', 'ai'] as const).map((ctm) => (
              <button
                key={ctm}
                type="button"
                onClick={() => setLocalCaptionTitleMode(ctm)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  localCaptionTitleMode === ctm ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {ctm === 'original' ? 'Original' : 'AI ✨'}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-500">
            {localCaptionTitleMode === 'original' && "Uses the article's headline in the caption"}
            {localCaptionTitleMode === 'ai' && "AI rewrites the headline in the caption"}
          </p>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleConfirmCaption}
              disabled={isRunning}
              className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold rounded-lg transition text-sm"
            >
              Confirm
            </button>
            <button
              onClick={handleCancelCaption}
              disabled={isRunning}
              className="flex-1 py-2 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
