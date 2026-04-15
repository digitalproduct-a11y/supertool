import { useState } from 'react'
import type { SocialAffiliateThreadPost } from '../types'

interface SocialAffiliatePostCardProps {
  post: SocialAffiliateThreadPost
  onContentChange?: (content: string) => void
  showCopyButton?: boolean
}

export function SocialAffiliatePostCard({
  post,
  onContentChange,
  showCopyButton = true,
}: SocialAffiliatePostCardProps) {
  const [content, setContent] = useState(post.content)
  const [copied, setCopied] = useState(false)
  const charCount = content.length
  const isWarning = charCount > 500

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    onContentChange?.(newContent)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3 shadow-[0_1px_6px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-7 h-7 bg-neutral-950 text-white font-bold text-xs rounded-full">
            {post.postNumber}
          </span>
          <h3 className="text-sm font-semibold text-neutral-800">{post.title}</h3>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
          isWarning ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100 text-neutral-500'
        }`}>
          {charCount} chars
        </span>
      </div>

      <textarea
        value={content}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none placeholder:text-neutral-400"
        rows={4}
      />

      {showCopyButton && (
        <button
          onClick={handleCopy}
          className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            copied
              ? 'bg-green-100 text-green-700'
              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy Post'}
        </button>
      )}
    </div>
  )
}
