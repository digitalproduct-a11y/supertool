import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft, IconRefresh } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'
import { callGenerateWebhook, ImageThumb } from './GeneratePostView'
import { PostCard } from './PostCard'
import type { ScheduledPost } from '../types'
import { Spinner } from './ds/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendingItem {
  id: string
  url: string
  source: string
  brand: string
  category: string
  type: string
  status: 'idle' | 'generating' | 'done' | 'error'
  imageUrl?: string
  title?: string
  caption?: string
  errorMessage?: string
  publishedAt?: string
}

interface GeneratedResult {
  item: TrendingItem
  status: 'generating' | 'done' | 'error'
  imageUrl?: string
  caption?: string
  title?: string
  errorMessage?: string
}

// ─── Recommended sources map ──────────────────────────────────────────────────

export const RECOMMENDED_SOURCES: Record<string, string[]> = {
  'Era':             ['astro awani', 'astro arena', 'gempak'],
  'Sinar':           ['astro awani', 'astro arena', 'gempak'],
  'Era Sarawak':     ['astro awani', 'astro arena', 'gempak'],
  'Era Sabah':       ['astro awani', 'astro arena', 'gempak'],
  'Zayan':           ['astro awani', 'astro arena', 'gempak'],
  'Gegar':           ['astro awani', 'astro arena', 'gempak'],
  'Media Hiburan':   ['gempak', 'rojak daily'],
  'Mingguan Wanita': ['gempak', 'rojak daily'],
  'Astro Ulagam':    ['astro awani', 'stadium astro', 'rojak daily'],
  'Rojak Daily':     ['stadium astro'],
  'Lite':            ['astro awani', 'stadium astro', 'rojak daily'],
  'Hitz':            ['astro awani', 'stadium astro', 'rojak daily'],
  'Mix':             ['astro awani', 'stadium astro', 'rojak daily'],
  'Raaga':           ['astro awani', 'stadium astro', 'rojak daily'],
  'Hotspot':         ['stadium astro', 'astro awani'],
  'MY':              ['xuan', 'hotspot'],
  'Melody':          ['xuan', 'hotspot'],
  'Goxuan':          ['xuan', 'hotspot'],
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchTrendingArticles(): Promise<TrendingItem[]> {
  const webhookUrl = (import.meta.env.VITE_TRENDING_SPIKE_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('VITE_TRENDING_SPIKE_WEBHOOK_URL is not configured.')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'fetch-trending' }),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!text.trim()) throw new Error('Workflow returned an empty response.')
    const data = JSON.parse(text)
    if (!data.success || !Array.isArray(data.articles)) throw new Error('Unexpected response format.')
    return data.articles.map((a: Record<string, string>) => ({
      id: crypto.randomUUID(),
      url: a.url,
      source: a.source || a.category || 'Unknown',
      brand: a.brand || a.source || '',
      category: a.category || '',
      type: a.type || '',
      title: a.title || '',
      imageUrl: (a.image && !a.image.includes('sponsor-logos')) ? a.image : '',
      caption: a.caption || '',
      publishedAt: a.publishedAt || '',
      status: 'idle' as const,
    }))
  } finally {
    clearTimeout(timeout)
  }
}

function groupBySource(items: TrendingItem[]): Record<string, TrendingItem[]> {
  return items.reduce((acc: Record<string, TrendingItem[]>, item) => {
    const key = item.source || 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}

function toScheduledPost(result: GeneratedResult, brand: string): ScheduledPost {
  const imageUrl = result.imageUrl ?? ''
  const publicIdMatch = imageUrl.match(/\/([^/]+?)(?:\.[a-z]+)?$/)
  const photoPublicId = publicIdMatch?.[1] ?? ''
  return {
    id: result.item.id,
    date: result.item.publishedAt ?? new Date().toISOString().slice(0, 10),
    brand,
    origin: result.item.source,
    articleUrl: result.item.url,
    articleTitle: result.item.title ?? result.item.url,
    imageUrl,
    photoPublicId,
    title: result.title ?? result.item.title ?? '',
    caption: result.caption ?? '',
    status: 'pending',
    scheduled_time: null,
    scheduled_to: null,
    error_message: null,
  }
}

// ─── Article row ──────────────────────────────────────────────────────────────

interface ArticleRowProps {
  item: TrendingItem
  selected: boolean
  onToggle: (id: string) => void
}

function ArticleRow({ item, selected, onToggle }: ArticleRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClamped, setIsClamped] = useState(false)
  const titleRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = titleRef.current
    if (el) setIsClamped(el.scrollHeight > el.clientHeight)
  }, [])

  return (
    <div
      onClick={() => onToggle(item.id)}
      className={`p-3 cursor-pointer transition-colors ${selected ? 'bg-blue-50/50' : 'hover:bg-neutral-50/70'}`}
    >
      <div className="flex gap-2.5">
        {/* Thumbnail — 16:9, non-clickable, with custom checkbox overlay */}
        <div className="relative w-24 shrink-0 pointer-events-none">
          <ImageThumb url={item.imageUrl} alt={item.title || item.url} aspectRatio="video" />
          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${
            selected ? 'bg-neutral-950 border-neutral-950' : 'bg-white/90 border-neutral-300'
          }`}>
            {selected && (
              <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1">
            <div className="flex-1 min-w-0">
              <p
                ref={titleRef}
                className={`text-neutral-800 font-medium text-xs leading-snug ${isExpanded ? '' : 'line-clamp-2'}`}
              >
                {item.title || item.url}
              </p>
              {isClamped && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(v => !v) }}
                  className="text-[10px] text-neutral-400 hover:text-neutral-600 mt-0.5 transition-colors"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-neutral-300 hover:text-neutral-600 transition mt-0.5"
              title="Open article"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <div className="mt-1.5">
            <span className="text-[10px] text-neutral-400 font-medium capitalize block truncate">{item.source}</span>
            {item.publishedAt && (
              <span className="text-[10px] text-neutral-300 block truncate">{item.publishedAt}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Source group ─────────────────────────────────────────────────────────────

interface SourceGroupProps {
  source: string
  items: TrendingItem[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}

function SourceGroup({ source, items, selectedIds, onToggle }: SourceGroupProps) {
  const allSelected = items.every(i => selectedIds.has(i.id))

  const handleToggleAll = () => {
    if (allSelected) {
      items.forEach(i => onToggle(i.id))
    } else {
      items.filter(i => !selectedIds.has(i.id)).forEach(i => onToggle(i.id))
    }
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleAll}
            className="h-3.5 w-3.5 rounded border-neutral-300 accent-neutral-950 cursor-pointer"
          />
          <h2 className="text-sm font-semibold text-neutral-700 capitalize">{source}</h2>
        </div>
        <span className="text-xs text-neutral-400">{items.length}</span>
      </div>
      <div className="divide-y divide-neutral-50">
        {items.map(item => (
          <ArticleRow
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Bulk item placeholder (generating / error states) ────────────────────────

function BulkItemPlaceholder({ result }: { result: GeneratedResult }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
      <div className="w-full bg-neutral-100 flex flex-col items-center justify-center gap-2" style={{ aspectRatio: '4/5' }}>
        {result.status === 'generating' && (
          <>
            <Spinner />
            <p className="text-xs text-neutral-400">Generating…</p>
          </>
        )}
        {result.status === 'error' && (
          <>
            <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-xs text-neutral-400 text-center px-4">{result.errorMessage || 'Failed to generate'}</p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ScheduledPostsPage({ brand }: { brand: string }) {
  const navigate = useNavigate()

  const rawBrand = brand
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const displayBrand = rawBrand === 'My' ? 'MY' : rawBrand

  const [articles, setArticles] = useState<TrendingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<'browse' | 'bulk'>('browse')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkResults, setBulkResults] = useState<GeneratedResult[]>([])

  // Track if bulk generation has already been triggered for the current results
  const bulkTriggeredRef = useRef(false)

  const loadArticles = useCallback(async (force = false) => {
    setIsLoading(true)
    setError(null)
    try {
      // Simple same-day cache keyed per brand
      const cacheKey = `ready_to_post_${displayBrand}`
      if (!force) {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const { items, timestamp } = JSON.parse(cached)
          const isSameDay = new Date(timestamp).toDateString() === new Date().toDateString()
          if (isSameDay) {
            setArticles(items)
            setIsLoading(false)
            return
          }
        }
      }
      const items = await fetchTrendingArticles()
      localStorage.setItem(cacheKey, JSON.stringify({ items, timestamp: Date.now() }))
      setArticles(items)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load articles.'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }, [displayBrand])

  useEffect(() => { loadArticles() }, [loadArticles])

  const toggleId = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleBulkGenerate = useCallback(() => {
    const selected = articles.filter(a => selectedIds.has(a.id))
    const initial: GeneratedResult[] = selected.map(item => ({
      item,
      status: 'generating',
    }))
    setBulkResults(initial)
    bulkTriggeredRef.current = false
    setView('bulk')
  }, [articles, selectedIds])

  // Trigger generation after bulk results initialised
  useEffect(() => {
    if (view !== 'bulk' || bulkResults.length === 0 || bulkTriggeredRef.current) return
    bulkTriggeredRef.current = true

    bulkResults.forEach((r, idx) => {
      callGenerateWebhook({
        url: r.item.url,
        brand: displayBrand,
        titleMode: 'original',
        captionTitleMode: 'original',
      }).then(data => {
        const result = Array.isArray(data) ? data[0] : data
        setBulkResults(prev => prev.map((p, i) =>
          i === idx
            ? { ...p, status: 'done', imageUrl: result.imageUrl, caption: result.caption, title: result.title }
            : p
        ))
      }).catch(err => {
        const msg = err instanceof Error ? err.message : 'Generation failed.'
        setBulkResults(prev => prev.map((p, i) =>
          i === idx ? { ...p, status: 'error', errorMessage: msg } : p
        ))
      })
    })
  }, [view, bulkResults.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = useCallback(() => {
    setView('browse')
    setBulkResults([])
    bulkTriggeredRef.current = false
    setSelectedIds(new Set())
  }, [])

  // Split articles into recommended sources and other
  const recommended = RECOMMENDED_SOURCES[displayBrand] ?? []
  const relevantArticles = articles.filter(a =>
    recommended.some(s => a.source.toLowerCase() === s.toLowerCase())
  )
  const otherArticles = articles.filter(a =>
    !recommended.some(s => a.source.toLowerCase() === s.toLowerCase())
  )

  const relevantGroups = groupBySource(relevantArticles)
  const otherGroups = groupBySource(otherArticles)

  const allRelevantSelected = relevantArticles.length > 0 && relevantArticles.every(a => selectedIds.has(a.id))
  const relevantSelectedCount = relevantArticles.filter(a => selectedIds.has(a.id)).length

  const handleToggleAllRelevant = () => {
    if (allRelevantSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        relevantArticles.forEach(a => next.delete(a.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        relevantArticles.forEach(a => next.add(a.id))
        return next
      })
    }
  }

  const doneCount = bulkResults.filter(r => r.status === 'done').length
  const totalBulk = bulkResults.length

  return (
    <main className={`pt-20 md:pt-10 px-4 md:px-8 transition-all ${view === 'browse' && selectedIds.size > 0 ? 'pb-32' : 'pb-12'}`}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={view !== 'browse' ? handleBack : () => navigate('/scheduled-posts')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                  {view === 'bulk'
                    ? `Generated Posts (${doneCount}/${totalBulk})`
                    : displayBrand}
                </h1>
                {view === 'browse' && !isLoading && articles.length > 0 && (
                  <p className="text-xs text-neutral-400 mt-0.5">{articles.length} articles available</p>
                )}
              </div>
              {view === 'browse' && (
                <button
                  onClick={() => loadArticles(true)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-50 transition"
                >
                  <IconRefresh size={14} className={isLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              )}
            </div>
          </div>
          <div
            className="h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* ── Bulk generated view ── */}
        {view === 'bulk' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {bulkResults.map((result, idx) => (
              result.status === 'done' && result.imageUrl
                ? <PostCard key={idx} post={toScheduledPost(result, displayBrand)} onSchedule={() => Promise.resolve(false)} />
                : <BulkItemPlaceholder key={idx} result={result} />
            ))}
          </div>
        )}

        {/* ── Browse view ── */}
        {view === 'browse' && (
          <>
            {/* Loading */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Spinner />
                <p className="text-sm text-neutral-500">Loading today's articles…</p>
              </div>
            )}

            {/* Error */}
            {!isLoading && error && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-neutral-700">Failed to load articles</p>
                  <p className="text-xs text-neutral-400 mt-1">{error}</p>
                </div>
                <button
                  onClick={() => loadArticles()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty */}
            {!isLoading && !error && articles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-neutral-700">No articles today yet</p>
                  <p className="text-xs text-neutral-400 mt-1">Trending articles refresh daily at 10:00 AM.</p>
                </div>
              </div>
            )}

            {/* Article sections */}
            {!isLoading && !error && articles.length > 0 && (
              <div className="space-y-10">

                {/* Section 1 — Your Sources */}
                {relevantArticles.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-sm font-semibold text-neutral-900">Recommended Sources</h2>
                        <p className="text-xs text-neutral-400 mt-0.5">Trending articles from {displayBrand}'s recommended sources</p>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allRelevantSelected}
                          onChange={handleToggleAllRelevant}
                          className="h-3.5 w-3.5 rounded border-neutral-300 accent-neutral-950 cursor-pointer"
                        />
                        <span className="text-xs text-neutral-500">
                          {relevantSelectedCount > 0 ? `${relevantSelectedCount} selected` : 'Select all'}
                        </span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                      {Object.entries(relevantGroups).map(([source, items]) => (
                        <SourceGroup
                          key={source}
                          source={source}
                          items={items}
                          selectedIds={selectedIds}
                          onToggle={toggleId}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 2 — Other Sources */}
                {otherArticles.length > 0 && (
                  <div>
                    <div className="mb-3">
                      <h2 className="text-sm font-semibold text-neutral-500">Other Sources</h2>
                      <p className="text-xs text-neutral-400 mt-0.5">Articles from other brands you can optionally use</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                      {Object.entries(otherGroups).map(([source, items]) => (
                        <SourceGroup
                          key={source}
                          source={source}
                          items={items}
                          selectedIds={selectedIds}
                          onToggle={toggleId}
                        />
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </>
        )}

      </div>

      {/* Sticky action bar */}
      {view === 'browse' && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-6 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-neutral-950 text-white rounded-2xl px-5 py-3 shadow-2xl">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="w-px h-4 bg-white/20" />
            <button
              onClick={handleBulkGenerate}
              className="text-sm font-semibold bg-white text-neutral-950 hover:bg-neutral-100 transition px-4 py-1.5 rounded-xl active:scale-[0.97]"
            >
              Generate {selectedIds.size} {selectedIds.size === 1 ? 'post' : 'posts'}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-white/50 hover:text-white transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
