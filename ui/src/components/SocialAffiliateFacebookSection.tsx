import { useState } from 'react'
import type { SocialAffiliateFacebookResult } from '../types'

interface SocialAffiliateFacebookSectionProps {
  data: SocialAffiliateFacebookResult
  onContentChange?: (paragraphs: string[], fullText: string) => void
  hideTitle?: boolean
}

export function SocialAffiliateFacebookSection({
  data,
  onContentChange,
  hideTitle = false,
}: SocialAffiliateFacebookSectionProps) {
  const [paragraphs, setParagraphs] = useState(data?.paragraphs || [])
  const [fullText, setFullText] = useState(data?.fullText || '')
  const [copied, setCopied] = useState(false)

  if (!data?.paragraphs?.length) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
        <p className="text-sm text-neutral-500">No Facebook content available.</p>
      </div>
    )
  }

  const handleParagraphChange = (index: number, newContent: string) => {
    const updated = [...paragraphs]
    updated[index] = newContent
    const newFullText = updated.join('\n\n')
    setParagraphs(updated)
    setFullText(newFullText)
    onContentChange?.(updated, newFullText)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const charCount = fullText.length

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">Facebook Post</h2>
            {data.contentLabel && (
              <p className="text-xs text-neutral-500 mt-0.5">{data.contentLabel}</p>
            )}
          </div>
          <button
            onClick={handleCopy}
            className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
              copied ? 'bg-green-100 text-green-700' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy Facebook Post'}
          </button>
        </div>
      )}
      {hideTitle && (
        <button
          onClick={handleCopy}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            copied ? 'bg-green-100 text-green-700' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy Facebook Post'}
        </button>
      )}

      <div className="space-y-3">
        {paragraphs.map((paragraph, index) => (
          <div key={index} className="bg-white border border-neutral-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-800">Paragraph {index + 1}</h3>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">
                {paragraph.length} chars
              </span>
            </div>
            <textarea
              value={paragraph}
              onChange={(e) => handleParagraphChange(index, e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none placeholder:text-neutral-400"
              rows={3}
            />
          </div>
        ))}
      </div>

      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-800">Full Text Preview</h3>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-200 text-neutral-600">
            {charCount} chars
          </span>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-3 text-sm text-neutral-700 whitespace-pre-wrap font-mono leading-relaxed">
          {fullText}
        </div>
      </div>
    </div>
  )
}
