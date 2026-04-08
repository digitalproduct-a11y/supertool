import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '@tabler/icons-react'
import { useScheduledPosts } from '../hooks/useScheduledPosts'
import { PostCard } from './PostCard'
import { Spinner } from './ds/Spinner'
import { trackEvent } from '../utils/analytics'

export function ScheduledPostsPage({ brand }: { brand: string }) {
  const navigate = useNavigate()

  // Convert URL slug to proper brand name (e.g., "astro-ulagam" → "Astro Ulagam")
  const displayBrand = brand
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  const { posts, isLoading, error, loadPosts, refetchPosts, schedulePost } = useScheduledPosts(displayBrand)

  const handleRefetch = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    void refetchPosts()
  }, [refetchPosts])

  useEffect(() => {
    trackEvent({
      event_type: 'page_visit',
      tool_id: 'scheduled-posts',
      tool_label: 'Schedule Trending News',
      brand: displayBrand,
    })
  }, [displayBrand])

  const today = new Date().toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-12">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/scheduled-posts')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center justify-between">
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                Schedule Trending News for {displayBrand}
              </h1>
              <button
                onClick={handleRefetch}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm font-medium border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 transition"
              >
                Refetch articles
              </button>
            </div>
          </div>
          <p className="text-neutral-500 mt-1 text-sm">
            View and schedule trending news posts from {displayBrand}
          </p>
          {!isLoading && posts.length > 0 && (
            <p className="text-neutral-400 mt-2 text-xs">
              {posts.length} posts available · {today}
            </p>
          )}
          <div
            className="mt-3 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Spinner />
            <p className="text-sm text-neutral-500">Loading today's posts…</p>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-sm text-neutral-500">{error}</p>
            <button
              onClick={() => void loadPosts()}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p className="text-sm font-medium text-neutral-700">No posts for {displayBrand} today yet.</p>
            <p className="text-sm text-neutral-500">The workflow runs at 10:00 AM daily.</p>
          </div>
        )}

        {/* Posts grouped by origin */}
        {!isLoading && !error && (
          <>
            {posts.filter(p => p.status !== 'failed').length > 0 ? (
              <div className="space-y-8">
                {Object.entries(
                  posts
                    .filter(p => p.status !== 'failed')
                    .reduce((acc: Record<string, typeof posts>, post) => {
                      const origin = post.origin || 'Other'
                      if (!acc[origin]) acc[origin] = []
                      acc[origin].push(post)
                      return acc
                    }, {})
                ).map(([origin, originPosts]) => (
                  <div key={origin}>
                    <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                      Trending News from: {origin} ({originPosts.length})
                    </h2>
                    <div
                      className="gap-6"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                      }}
                    >
                      {originPosts.map(post => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onSchedule={schedulePost}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 gap-2">
                <p className="text-sm font-medium text-neutral-700">No valid posts for today.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
