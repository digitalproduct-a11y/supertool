import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '@tabler/icons-react'
import { useScheduledPosts } from '../hooks/useScheduledPosts'
import { PostCard } from './PostCard'
import { Spinner } from './ds/Spinner'

export function ScheduledPostsPage({ brand }: { brand: string }) {
  const navigate = useNavigate()

  // Convert URL slug to proper brand name (e.g., "astro-ulagam" → "Astro Ulagam")
  const rawBrand = brand
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  // MY brand uses all-caps; slug "my" must not be titlecased
  const displayBrand = rawBrand === 'My' ? 'MY' : rawBrand

  const { posts, isLoading, error, loadPosts, refetchPosts, schedulePost } = useScheduledPosts(displayBrand)

  const handleRefetch = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    void refetchPosts()
  }, [refetchPosts])

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
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-700">Failed to load posts</p>
              <p className="text-xs text-neutral-400 mt-1">{error}</p>
            </div>
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
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-700">No posts for {displayBrand} today yet</p>
              <p className="text-xs text-neutral-400 mt-1">The workflow runs at 10:00 AM daily. Check back after it runs.</p>
            </div>
          </div>
        )}

        {/* Posts grouped by origin */}
        {!isLoading && !error && (
          <>
            {posts.filter(p => p.status !== 'error').length > 0 ? (
              <div className="space-y-8">
                {Object.entries(
                  posts
                    .filter(p => p.status !== 'error')
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
