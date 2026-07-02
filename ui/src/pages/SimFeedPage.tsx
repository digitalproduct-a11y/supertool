// CMS simulation harness (standalone, not in sidebar).
//
// Stands in for Drupal: lists the staging article feed and launches the exact
// /cms/post redirect the real CMS will use, passing only site + article id. The
// post type(s) + photo template are then chosen on /cms/post. Testing only.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchArticleFeed, type FeedItem } from '../services/articleFeed'
import { brandFromSite } from '../constants/brands'

const SITE = 'awani'
const PAGE_SIZE = 10

export function SimFeedPage() {
  const navigate = useNavigate()
  const brand = brandFromSite(SITE) ?? 'Astro Awani'

  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const hasNext = feed.length === PAGE_SIZE

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchArticleFeed(SITE, 'ms', page, PAGE_SIZE)
      .then(items => { if (active) { setFeed(items); setError(null); window.scrollTo({ top: 0 }) } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Failed to load feed') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page])

  function launch(item: FeedItem) {
    const qs = new URLSearchParams({ site: SITE, id: String(item.id) })
    navigate(`/cms/post?${qs.toString()}`)
  }

  return (
    <main className="pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">CMS Simulation</h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Pick an article from the {brand} feed to generate from — you'll choose the post
            type(s) and photo template on the next screen. This mirrors the Drupal → Supertool redirect.
          </p>
          <div className="mt-6 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* Feed list */}
        {loading && <p className="text-sm text-neutral-400 py-12 text-center">Loading feed…</p>}
        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
        {!loading && !error && (
          <div className="space-y-3">
            {feed.map(item => (
              <div key={item.id} className="flex items-center gap-4 bg-white rounded-2xl border border-neutral-100 p-3 hover:border-neutral-300 transition-colors">
                <img src={item.imageUrl} alt="" className="w-24 h-20 object-cover rounded-xl bg-neutral-100 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900 line-clamp-2">{item.title}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    #{item.id} · {item.category?.[0]?.name ?? '—'} · {new Date(item.publishDate).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => launch(item)}
                  className="flex-shrink-0 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition active:scale-[0.98]">
                  Generate post
                </button>
              </div>
            ))}

            {/* Pager */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-neutral-700 hover:border-neutral-400 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200">
                ← Prev
              </button>
              <span className="text-sm font-medium text-neutral-500">Page {page}</span>
              <button type="button" onClick={() => setPage(p => p + 1)} disabled={!hasNext}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-neutral-700 hover:border-neutral-400 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
