import { useEffect } from 'react'
import { useScheduledPosts } from '../hooks/useScheduledPosts'
import { PostCard } from './PostCard'
import { Spinner } from './ds/Spinner'
import { trackEvent } from '../utils/analytics'

export function ScheduledPostsPage() {
  const { posts, isLoading, error, loadPosts, schedulePost } = useScheduledPosts('Astro Ulagam')

  useEffect(() => {
    trackEvent({
      event_type: 'page_visit',
      tool_id: 'scheduled-posts',
      tool_label: 'Schedule Trending News',
    })
  }, [])

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
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
            Schedule Trending News
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Astro Ulagam · {today}
            {!isLoading && posts.length > 0 && (
              <span> · {posts.length} posts generated at 10:00 AM</span>
            )}
          </p>
          <div
            className="mt-3 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Spinner className="w-8 h-8 text-neutral-400" />
            <p className="text-sm text-neutral-500">Loading today's posts…</p>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-sm text-neutral-500">{error}</p>
            <button
              onClick={loadPosts}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p className="text-sm font-medium text-neutral-700">No posts for today yet.</p>
            <p className="text-sm text-neutral-500">The workflow runs at 10:00 AM daily.</p>
          </div>
        )}

        {/* 3-column grid */}
        {!isLoading && !error && posts.length > 0 && (
          <div
            className="gap-6"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
          >
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onSchedule={schedulePost}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
