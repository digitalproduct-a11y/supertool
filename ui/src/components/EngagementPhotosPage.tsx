import { useState } from 'react'
import type { EngagementPost } from '../types'
import { useEngagementPhotos } from '../hooks/useEngagementPhotos'
import { Button } from './ds/Button'
import { Spinner } from './ds/Spinner'

export function EngagementPhotosPage() {
  const { posts, isLoading, error, generate } = useEngagementPhotos()
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const handleDownload = (post: EngagementPost, index: number) => {
    const link = document.createElement('a')
    link.href = post.image_url
    link.download = `engagement-post-${index + 1}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyCaption = (caption: string, index: number) => {
    navigator.clipboard.writeText(caption)
    setCopiedId(index)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold mb-2">Engagement Photos Generator</h1>
        <p className="text-neutral-400">Auto-generates 10 sports posts from the latest news</p>
      </div>

      {/* Generate Button */}
      <div className="max-w-7xl mx-auto mb-12">
        <Button
          onClick={generate}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Spinner />
              Generating 10 posts…
            </>
          ) : (
            'Generate'
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto mb-8 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="max-w-7xl mx-auto">
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post, index) => (
              <div
                key={index}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors"
              >
                {/* Image */}
                <div className="aspect-[4/5] bg-zinc-800 overflow-hidden">
                  <img
                    src={post.image_url}
                    alt={post.headline}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  {/* Caption */}
                  <textarea
                    value={post.caption}
                    readOnly
                    className="w-full h-16 p-2 bg-zinc-800 text-white rounded text-sm resize-none focus:outline-none border border-zinc-700"
                  />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(post, index)}
                      className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                    <button
                      onClick={() => handleCopyCaption(post.caption, index)}
                      className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                        copiedId === index
                          ? 'bg-green-600 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700'
                      }`}
                    >
                      {copiedId === index ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !isLoading && !error ? (
          <div className="text-center py-12 text-neutral-400">
            Click "Generate" to create your first set of engagement posts
          </div>
        ) : null}
      </div>
    </div>
  )
}
