import { useState, useCallback, useEffect } from 'react'
import { toast } from '../hooks/useToast'
import { detectBrandFromUrl } from '../constants/brands'
import { IconRefresh } from '@tabler/icons-react'
import { Spinner } from './ds/Spinner'
import { GenerateView } from './GeneratePostView'
import type { GenerateSource } from './GeneratePostView'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpikeInboxItem {
  id: string
  articleUrl: string
  brand: string
  articleTitle: string
  concurrents: string
  receivedAt: string
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function callWebhook(body: Record<string, unknown>) {
  const webhookUrl = (import.meta.env.VITE_TRENDING_SPIKE_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('VITE_TRENDING_SPIKE_WEBHOOK_URL is not configured.')
  try { new URL(webhookUrl) } catch { throw new Error(`Invalid webhook URL: "${webhookUrl}"`) }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!text.trim()) throw new Error('Workflow returned an empty response.')
    return JSON.parse(text)
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SpikeNewsPage() {
  const [view, setView] = useState<'list' | 'generate'>('list')
  const [selectedSpike, setSelectedSpike] = useState<SpikeInboxItem | null>(null)
  const [spikeInbox, setSpikeInbox] = useState<SpikeInboxItem[]>([])
  const [isLoadingInbox, setIsLoadingInbox] = useState(false)

  const handleLoadInbox = useCallback(async () => {
    setIsLoadingInbox(true)
    try {
      const data = await callWebhook({ type: 'get-spike-inbox' })
      if (data.success && Array.isArray(data.spikes)) {
        setSpikeInbox(data.spikes.map((s: SpikeInboxItem & { id?: string }) => ({
          id: s.id || crypto.randomUUID(),
          articleUrl: s.articleUrl || '',
          brand: s.brand || '',
          articleTitle: s.articleTitle || '',
          concurrents: s.concurrents || '',
          receivedAt: s.receivedAt || '',
        })))
      } else {
        toast.error(data.message || 'Failed to load spike inbox.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setIsLoadingInbox(false)
    }
  }, [])

  // Auto-load on mount
  useEffect(() => {
    handleLoadInbox()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGeneratePost(spike: SpikeInboxItem) {
    const detectedBrand = spike.brand || detectBrandFromUrl(spike.articleUrl) || ''
    setSelectedSpike({ ...spike, brand: detectedBrand })
    setView('generate')
  }

  function handleBackToList() {
    setView('list')
    setSelectedSpike(null)
  }

  const generateSource: GenerateSource | null = selectedSpike
    ? {
        articleUrl: selectedSpike.articleUrl,
        brand: selectedSpike.brand,
        articleTitle: selectedSpike.articleTitle,
        backLabel: 'Back to spike list',
      }
    : null

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-28">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Spike News</h1>
              <p className="text-neutral-500 mt-1 text-sm">Generate Facebook posts from real-time Chartbeat spike alerts</p>
            </div>
            <button
              onClick={handleLoadInbox}
              disabled={isLoadingInbox}
              className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-50 shrink-0"
              title="Refresh spike inbox"
            >
              <IconRefresh size={16} className={isLoadingInbox ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Generate view */}
        {view === 'generate' && generateSource && (
          <GenerateView source={generateSource} onBack={handleBackToList} />
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="space-y-6">

            {/* Loading skeleton */}
            {isLoadingInbox && spikeInbox.length === 0 && (
              <div className="glass-card rounded-2xl p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 skeleton-shimmer rounded w-1/4" />
                      <div className="h-3 skeleton-shimmer rounded w-3/4" />
                      <div className="h-3 skeleton-shimmer rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Loading inline indicator when refreshing with existing data */}
            {isLoadingInbox && spikeInbox.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Spinner size="sm" />
                Refreshing…
              </div>
            )}

            {/* Inbox table */}
            {spikeInbox.length > 0 && (
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-100">
                  <h2 className="text-sm font-semibold text-neutral-700">{spikeInbox.length} spike{spikeInbox.length > 1 ? 's' : ''} in inbox</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">
                        <th className="px-6 py-3 whitespace-nowrap">Received</th>
                        <th className="px-4 py-3">Article</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3 whitespace-nowrap">Concurrent viewers</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {spikeInbox.map(item => (
                        <tr key={item.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                          <td className="px-6 py-4 text-neutral-400 text-xs whitespace-nowrap">
                            {item.receivedAt
                              ? new Date(item.receivedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                          <td className="px-4 py-4 max-w-[280px]">
                            {item.articleTitle ? (
                              <a href={item.articleUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-800 hover:text-neutral-500 font-medium line-clamp-2 leading-snug transition block">
                                {item.articleTitle}
                              </a>
                            ) : (
                              <a href={item.articleUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600 text-xs line-clamp-2 break-all transition">
                                {item.articleUrl}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {item.brand ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-medium whitespace-nowrap">
                                {item.brand}
                              </span>
                            ) : (
                              <span className="text-neutral-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-neutral-600 text-sm font-medium">
                            {item.concurrents || '—'}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleGeneratePost(item)}
                              className="px-3.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition active:scale-[0.97] whitespace-nowrap"
                            >
                              Generate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state */}
            {spikeInbox.length === 0 && !isLoadingInbox && (
              <div className="glass-card rounded-2xl p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-600">No spike articles yet</p>
                <p className="text-xs text-neutral-400 mt-1">No spike alerts at the moment — check back when articles are trending</p>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  )
}
