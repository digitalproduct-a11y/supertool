import { useState } from 'react'
import type { SocialAffiliateThreadsResult, SocialAffiliateThreadPost } from '../types'
import { SocialAffiliatePostCard } from './SocialAffiliatePostCard'

interface SocialAffiliateThreadsSectionProps {
  data: SocialAffiliateThreadsResult
  onPostsChange?: (posts: SocialAffiliateThreadPost[]) => void
  hideTitle?: boolean
}

export function SocialAffiliateThreadsSection({
  data,
  onPostsChange,
  hideTitle = false,
}: SocialAffiliateThreadsSectionProps) {
  const [posts, setPosts] = useState(data?.posts || [])
  const [copied, setCopied] = useState(false)

  if (!data?.posts?.length) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
        <p className="text-sm text-neutral-500">No Threads posts available.</p>
      </div>
    )
  }

  const handlePostChange = (postNumber: number, newContent: string) => {
    const updated = posts.map((p) =>
      p.postNumber === postNumber ? { ...p, content: newContent } : p
    )
    setPosts(updated)
    onPostsChange?.(updated)
  }

  const handleCopyAll = async () => {
    const combined = posts.map((p) => p.content).join('\n\n---\n\n')
    try {
      await navigator.clipboard.writeText(combined)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">Threads Posts</h2>
            {data.contentLabel && (
              <p className="text-xs text-neutral-500 mt-0.5">{data.contentLabel}</p>
            )}
          </div>
          <button
            onClick={handleCopyAll}
            className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
              copied ? 'bg-green-100 text-green-700' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy All Threads'}
          </button>
        </div>
      )}
      {hideTitle && (
        <button
          onClick={handleCopyAll}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            copied ? 'bg-green-100 text-green-700' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy All Threads'}
        </button>
      )}

      <div className="grid gap-3">
        {posts.map((post) => (
          <SocialAffiliatePostCard
            key={post.postNumber}
            post={post}
            onContentChange={(content) => handlePostChange(post.postNumber, content)}
            showCopyButton={true}
          />
        ))}
      </div>
    </div>
  )
}
