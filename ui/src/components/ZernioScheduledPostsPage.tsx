import { useState, useMemo } from 'react'
import { IconRefresh, IconTrash, IconCalendarClock } from '@tabler/icons-react'
import { useZernioScheduledPosts } from '../hooks/useZernioScheduledPosts'
import { Pagination } from './ds/Pagination'
import { getCredentials, saveCredentials } from '../utils/fbCredentials'
import type { ZernioPost } from '../types'

function formatScheduledTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  const date = isToday ? 'Today' : d.toLocaleString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true })
  return { date, time }
}


function DeleteModal({
  post,
  brand,
  requirePasscode,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  post: ZernioPost
  brand: string
  requirePasscode: boolean
  isDeleting: boolean
  onConfirm: (passcode?: string) => void
  onCancel: () => void
}) {
  const [passcode, setPasscode] = useState('')

  const canSubmit = !requirePasscode || passcode.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Delete scheduled post?</h3>
            <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
              {post.content || 'This post will be permanently removed from Zernio.'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {requirePasscode && (
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Passcode for <span className="text-neutral-800">{brand}</span>
            </label>
            <input
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSubmit) onConfirm(passcode.trim()) }}
              autoFocus
              placeholder="Enter brand passcode"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 transition text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(requirePasscode ? passcode.trim() : undefined)}
            disabled={isDeleting || !canSubmit}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ZernioScheduledPostsPage() {
  const {
    posts,
    isLoading,
    error,
    page,
    totalPages,
    setPage,
    refetch,
    deletePost,
    deletingId,
  } = useZernioScheduledPosts()

  const [pendingDelete, setPendingDelete] = useState<ZernioPost | null>(null)
  const [brandFilter, setBrandFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pendingDeleteBrand = pendingDelete?.platforms[0]?.accountId?.displayName ?? ''

  const handleDeleteConfirm = async (passcode?: string) => {
    if (!pendingDelete) return
    if (passcode) saveCredentials(pendingDeleteBrand, passcode)
    const ok = await deletePost(pendingDelete._id)
    if (ok) setPendingDelete(null)
  }

  const availableBrands = useMemo(() =>
    Array.from(new Set(
      posts.flatMap(p => p.platforms.map(pl => pl.accountId?.displayName).filter(Boolean))
    )).sort() as string[]
  , [posts])

  const filteredPosts = useMemo(() => {
    if (!brandFilter) return posts
    return posts.filter(p =>
      p.platforms.some(pl => pl.accountId?.displayName === brandFilter)
    )
  }, [posts, brandFilter])

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-28">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Scheduled queue</h1>
              <p className="text-neutral-500 mt-1 text-sm">View and manage all Facebook posts currently scheduled</p>
              <p className="text-neutral-400 mt-1 text-xs">Note: rescheduling is not supported at the moment.</p>
            </div>
            <button
              onClick={refetch}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-50"
              title="Refresh post list"
            >
              <IconRefresh size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        <div className="space-y-6">

          {/* Brand filter */}
          {availableBrands.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-full p-1 shadow-sm">
                <button
                  onClick={() => setBrandFilter('')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${
                    brandFilter === ''
                      ? 'bg-neutral-950 text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  All
                </button>
                {availableBrands.map(brand => (
                  <button
                    key={brand}
                    onClick={() => setBrandFilter(prev => prev === brand ? '' : brand)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${
                      brandFilter === brand
                        ? 'bg-neutral-950 text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="glass-card rounded-2xl p-12 text-center space-y-4">
              <p className="text-sm text-red-500">{error}</p>
              <button
                onClick={refetch}
                className="px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty */}
          {!error && filteredPosts.length === 0 && (
            <div className="glass-card rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                <IconCalendarClock size={24} className="text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700">No scheduled posts</p>
              <p className="text-xs text-neutral-400 mt-1">Posts you schedule on Facebook will appear here.</p>
            </div>
          )}

          {/* Table */}
          {!error && filteredPosts.length > 0 && (
            <>
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-100">
                  <h2 className="text-sm font-semibold text-neutral-700">
                    {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''} in queue{brandFilter ? ` · ${brandFilter}` : ''}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                        <th className="px-6 py-3">Caption</th>
                        <th className="px-4 py-3 whitespace-nowrap">Page</th>
                        <th className="px-4 py-3 whitespace-nowrap">Platform</th>
                        <th className="px-4 py-3 whitespace-nowrap">Scheduled for</th>
                        <th className="px-4 py-3 whitespace-nowrap">Created on</th>
                        <th className="px-4 py-3 whitespace-nowrap">Post ID</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPosts.map(post => {
                        const firstPlatform = post.platforms[0]
                        const displayName = firstPlatform?.accountId?.displayName
                        const platformName = firstPlatform?.platform ?? 'facebook'

                        return (
                          <tr
                            key={post._id}
                            className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors"
                          >
                            {/* Caption */}
                            <td className="px-6 py-4 max-w-[400px]">
                              <p className={`text-neutral-800 text-sm leading-snug font-mulish ${expandedId === post._id ? '' : 'line-clamp-2'}`}>
                                {post.content || <span className="text-neutral-400 italic">No caption</span>}
                              </p>
                              {post.content && post.content.length > 80 && (
                                <button
                                  onClick={() => setExpandedId(expandedId === post._id ? null : post._id)}
                                  className="mt-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
                                >
                                  {expandedId === post._id ? 'Show less' : 'Show more'}
                                </button>
                              )}
                            </td>

                            {/* Page/Profile */}
                            <td className="px-4 py-4">
                              {displayName ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-medium whitespace-nowrap">
                                  {displayName}
                                </span>
                              ) : (
                                <span className="text-neutral-300 text-xs">—</span>
                              )}
                            </td>

                            {/* Platform */}
                            <td className="px-4 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium capitalize whitespace-nowrap">
                                {platformName}
                              </span>
                            </td>

                            {/* Scheduled time */}
                            <td className="px-4 py-4 font-mulish">
                              <p className="text-xs text-neutral-600">{formatScheduledTime(post.scheduledFor).date}</p>
                              <p className="text-xs text-neutral-400">{formatScheduledTime(post.scheduledFor).time}</p>
                            </td>

                            {/* Created */}
                            <td className="px-4 py-4">
                              <div className="font-mulish">
                                <p className="text-xs text-neutral-500">{formatScheduledTime(post.createdAt).date}</p>
                                <p className="text-xs text-neutral-400">{formatScheduledTime(post.createdAt).time}</p>
                              </div>
                            </td>

                            {/* Post ID */}
                            <td className="px-4 py-4">
                              <span className="text-xs text-neutral-400 font-mono">{post._id}</span>
                            </td>

                            {/* Delete */}
                            <td className="px-4 py-4">
                              <button
                                onClick={() => setPendingDelete(post)}
                                disabled={deletingId === post._id}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                                title="Delete post"
                              >
                                <IconTrash size={15} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination
                  page={page - 1}
                  totalPages={totalPages}
                  onPageChange={(p) => setPage(p + 1)}
                />
              )}
            </>
          )}

        </div>
      </div>

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <DeleteModal
          post={pendingDelete}
          brand={pendingDeleteBrand}
          requirePasscode={!getCredentials(pendingDeleteBrand)}
          isDeleting={deletingId === pendingDelete._id}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </main>
  )
}
