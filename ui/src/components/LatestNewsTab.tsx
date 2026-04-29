import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconRefresh, IconExternalLink, IconChevronRight, IconChevronLeft } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'

interface RssArticle {
  title: string
  url: string
  publishedAt: string
  description: string
  imageUrl?: string
}

interface GeneratedPost {
  imageUrl: string
  caption: string
}

type TabState = 'loading' | 'loaded' | 'error'
type GenerateState = 'idle' | 'generating' | 'done' | 'error'
type ScheduleState = 'idle' | 'posting' | 'done' | 'error'

// 15-minute sessionStorage cache — bucket key changes every 15 min
function getCacheKey(brand: string): string {
  const bucket = Math.floor(Date.now() / 900_000)
  return `rss_latest_${brand}_${bucket}`
}

function readCache(brand: string): RssArticle[] | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(brand))
    if (!raw) return null
    return JSON.parse(raw) as RssArticle[]
  } catch {
    return null
  }
}

function writeCache(brand: string, articles: RssArticle[]): void {
  try {
    sessionStorage.setItem(getCacheKey(brand), JSON.stringify(articles))
  } catch { /* storage quota — skip */ }
}

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

async function fetchRssArticles(brand: string): Promise<RssArticle[]> {
  const webhookUrl = (import.meta.env.VITE_RSS_LATEST_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('RSS webhook not configured.')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { articles?: RssArticle[]; error?: string }
  if (data.error) throw new Error(data.error)
  return data.articles ?? []
}

async function generatePost(
  articleUrl: string,
  brand: string,
): Promise<GeneratedPost> {
  const webhookUrl = (import.meta.env.VITE_GENERATE_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('Generate webhook not configured.')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: articleUrl, brand }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { imageUrl?: string; caption?: string; error?: string }
  if (data.error) throw new Error(data.error)
  if (!data.imageUrl) throw new Error('No image in response')
  return { imageUrl: data.imageUrl, caption: data.caption ?? '' }
}

async function callScheduleWebhook(
  imageUrl: string,
  caption: string,
  brand: string,
  scheduledFor: string | undefined,
  passcode: string,
): Promise<{ success: boolean; message: string; status?: string }> {
  const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) return { success: false, message: 'Webhook not configured.' }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fb_ai_image_url: imageUrl,
        fb_ai_caption: caption,
        brand: brand.toLowerCase(),
        ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        passcode,
      }),
    })
    const data = await res.json() as { success?: boolean; status?: string; message?: string }
    if (data.status === 'AUTH_ERROR') {
      clearCredentials(brand.toLowerCase())
      return { success: false, message: data.message ?? 'Invalid passcode.', status: 'AUTH_ERROR' }
    }
    if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
      saveCredentials(brand.toLowerCase(), passcode)
      return { success: true, message: data.message ?? 'Scheduled!' }
    }
    return { success: false, message: data.message ?? 'Something went wrong.' }
  } catch {
    return { success: false, message: 'Network error. Please try again.' }
  }
}

// Inline Generate View shown after clicking "Generate Post →"
function GenerateView({
  article,
  brand,
  onBack,
}: {
  article: RssArticle
  brand: string
  onBack: () => void
}) {
  const [generateState, setGenerateState] = useState<GenerateState>('idle')
  const [generated, setGenerated] = useState<GeneratedPost | null>(null)
  const [caption, setCaption] = useState('')
  const [scheduleState, setScheduleState] = useState<ScheduleState>('idle')
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  const handleGenerate = async () => {
    setGenerateState('generating')
    try {
      const result = await generatePost(article.url, brand)
      setGenerated(result)
      setCaption(result.caption)
      setGenerateState('done')
    } catch (err) {
      setGenerateState('error')
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  const handleSchedule = async (scheduledFor: string, passcode: string) => {
    if (!generated) return
    setScheduleState('posting')
    const finalPasscode = passcode || getCredentials(brand.toLowerCase())?.passcode || ''
    const response = await callScheduleWebhook(generated.imageUrl, caption, brand, scheduledFor, finalPasscode)
    if (response.status === 'AUTH_ERROR') {
      setShowScheduleModal(true)
      setScheduleState('idle')
      toast.error('Invalid passcode. Please try again.')
    } else if (response.success) {
      setScheduleState('done')
      setShowScheduleModal(false)
      toast.success('Scheduled on Facebook!')
    } else {
      setScheduleState('error')
      toast.error(response.message || "Couldn't schedule. Please try again.")
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-8 space-y-4 max-w-4xl mx-auto w-full">
      {/* Back + article info */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950 transition mb-3"
        >
          <IconChevronLeft className="w-4 h-4" />
          Back to Latest News
        </button>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-neutral-500 mb-1">{domainOf(article.url)} · {relativeTime(article.publishedAt)}</p>
          <p className="text-sm font-medium text-neutral-950 leading-snug">{article.title}</p>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
          >
            Open article <IconExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Generate button */}
      {generateState === 'idle' && (
        <button
          onClick={handleGenerate}
          className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          Generate Post
        </button>
      )}

      {generateState === 'generating' && (
        <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] min-h-64 flex flex-col items-center justify-center text-center space-y-3 p-6">
          <h3 className="text-sm font-semibold text-neutral-800">Generating your post</h3>
          <p className="text-xs text-neutral-400">This usually takes around 30 seconds</p>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      )}

      {generateState === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-red-500 text-center">Generation failed. Try again.</p>
          <button
            onClick={handleGenerate}
            className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {generateState === 'done' && generated && (
        <div className="space-y-4">
          {/* Image preview */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
            <img src={generated.imageUrl} alt="Generated post" className="w-full h-auto" />
          </div>

          {/* Caption */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-4 space-y-3">
            <label className="block text-sm font-medium text-neutral-950">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={() => window.open(generated.imageUrl, '_blank')}
                className="flex-1 px-4 py-2.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-950 rounded-xl text-sm font-semibold transition-colors"
              >
                Open Image
              </button>
              <button
                onClick={() => setShowScheduleModal(true)}
                disabled={scheduleState === 'posting'}
                className="flex-1 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {scheduleState === 'posting' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Scheduling…
                  </>
                ) : 'Schedule on FB'}
              </button>
            </div>
            {scheduleState === 'done' && <p className="text-xs text-green-600 text-center">✓ Scheduled on Facebook!</p>}
            {scheduleState === 'error' && <p className="text-xs text-red-500 text-center">✗ Failed to schedule. Try again.</p>}
          </div>
        </div>
      )}

      {showScheduleModal && generated && createPortal(
        <ScheduleModal
          brand={brand}
          hasCredentials={!!getCredentials(brand.toLowerCase())}
          isPosting={scheduleState === 'posting'}
          onConfirm={(sf, passcode) => void handleSchedule(sf ?? '', passcode ?? '')}
          onClose={() => setShowScheduleModal(false)}
        />,
        document.body
      )}
    </div>
  )
}

// Main LatestNewsTab component
export function LatestNewsTab({ brand }: { brand: string }) {
  const [tabState, setTabState] = useState<TabState>('loading')
  const [articles, setArticles] = useState<RssArticle[]>([])
  const [selectedArticle, setSelectedArticle] = useState<RssArticle | null>(null)

  useEffect(() => {
    setSelectedArticle(null)
    const cached = readCache(brand)
    if (cached) {
      setArticles(cached)
      setTabState('loaded')
      return
    }

    setTabState('loading')
    fetchRssArticles(brand)
      .then(items => {
        writeCache(brand, items)
        setArticles(items)
        setTabState('loaded')
      })
      .catch(() => setTabState('error'))
  }, [brand])

  const handleRefresh = () => {
    // Clear current bucket cache and re-fetch
    try { sessionStorage.removeItem(getCacheKey(brand)) } catch { /* ignore */ }
    setTabState('loading')
    setSelectedArticle(null)
    fetchRssArticles(brand)
      .then(items => {
        writeCache(brand, items)
        setArticles(items)
        setTabState('loaded')
      })
      .catch(() => setTabState('error'))
  }

  if (selectedArticle) {
    return (
      <GenerateView
        article={selectedArticle}
        brand={brand}
        onBack={() => setSelectedArticle(null)}
      />
    )
  }

  if (tabState === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 p-8">
        <h3 className="text-sm font-semibold text-neutral-800">Fetching latest news</h3>
        <p className="text-xs text-neutral-400">Loading articles from the last 3 hours</p>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    )
  }

  if (tabState === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-8">
        <p className="text-sm text-neutral-500">Failed to load latest news.</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-4">

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-neutral-400">
            {articles.length === 0
              ? 'No articles in the last 3 hours'
              : `${articles.length} article${articles.length !== 1 ? 's' : ''} from the last 3 hours`}
          </p>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-950 transition px-2 py-1 rounded-lg hover:bg-neutral-100"
          >
            <IconRefresh className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-neutral-400">No new articles in the last 3 hours.</p>
            <p className="text-xs text-neutral-300 mt-1">Check back later or browse Trending articles.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article, idx) => (
              <div
                key={`${article.url}-${idx}`}
                className="bg-white rounded-xl border border-neutral-100 hover:border-neutral-200 hover:shadow-sm transition-all overflow-hidden"
              >
                <div className="flex gap-3 p-4">
                  {article.imageUrl && (
                    <img
                      src={article.imageUrl}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg shrink-0 bg-neutral-100"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-neutral-400 mb-1">
                      {domainOf(article.url)} · {relativeTime(article.publishedAt)}
                    </p>
                    <h3 className="text-sm font-semibold text-neutral-950 leading-snug line-clamp-2 mb-1">
                      {article.title}
                    </h3>
                    {article.description && (
                      <p className="text-xs text-neutral-500 line-clamp-2">{article.description}</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-neutral-100 px-4 py-2.5 flex items-center justify-between">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition"
                  >
                    Read article <IconExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={() => setSelectedArticle(article)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-950 hover:text-neutral-600 transition"
                  >
                    Generate Post <IconChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
