import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrand } from '../context/BrandContext'
import {
  IconChevronLeft,
  IconCalendar,
  IconExternalLink,
  IconDownload,
  IconSparkles,
  IconX,
} from '@tabler/icons-react'
import { Spinner } from '../components/ds/Spinner'
import { ScheduleModal } from '../components/ScheduleModal'
import { BRANDS } from '../constants/brands'
import { uploadToCloudinary } from '../utils/cloudinary'
import { getCredentials } from '../utils/fbCredentials'
import { toast } from '../hooks/useToast'
import {
  OnThisDayCanvas,
  type OnThisDayCanvasHandle,
} from '../features/onthisday/OnThisDayCanvas'
import { parseEventDate } from '../features/onthisday/onThisDayTitle'
import type {
  OnThisDayEvent,
  OnThisDayResponse,
} from '../config/onThisDayCanvasConfig'
import {
  DEFAULT_ONTHISDAY_THEME,
  BRAND_ONTHISDAY_THEMES,
} from '../config/onThisDayBrandThemes'

// ─── Event Row (used in both sections) ───────────────────────────────────────

interface EventRowProps {
  item: OnThisDayEvent
  onSelect: (item: OnThisDayEvent) => void
}

const OnThisDayEventRow = memo(function OnThisDayEventRow({
  item,
  onSelect,
}: EventRowProps) {
  const parsedDate = parseEventDate(item.date)
  const formattedDate = parsedDate
    ? new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day)
        .toLocaleDateString('en-MY', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
    : null

  return (
    <div className="p-3 hover:bg-neutral-50/50 transition-colors">
      <div className="flex items-start gap-3">
        {item.image && (
          <div className="shrink-0">
            <img
              src={item.image}
              alt=""
              loading="lazy"
              decoding="async"
              width={64}
              height={64}
              className="w-16 h-16 object-cover rounded-lg bg-neutral-50"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-1.5 group mb-1"
          >
            <p className="text-sm font-medium text-neutral-800 leading-snug group-hover:text-neutral-950 transition-colors flex-1 min-w-0">
              {item.onThisDayTitle}
            </p>
            <IconExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0 mt-0.5" />
          </a>
          {formattedDate && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              {formattedDate}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition active:scale-[0.98]"
        >
          <IconSparkles className="w-3.5 h-3.5" />
          Generate post
        </button>
      </div>
    </div>
  )
})

// Module-level cache — survives component remounts (navigation away and back)
let cachedResponse: OnThisDayResponse | null = null

type Stage = 'list' | 'generate'

// ─── Main Page ────────────────────────────────────────────────────────────────

export function OnThisDayPage() {
  const navigate = useNavigate()
  const { selectedBrand: globalBrand, isAdmin } = useBrand()
  const webhookUrl = import.meta.env.VITE_ONTHISDAY_URL as string | undefined

  const [todayEvents, setTodayEvents] = useState<OnThisDayEvent[]>(
    cachedResponse?.todayEvents ?? [],
  )
  const [monthEvents, setMonthEvents] = useState<OnThisDayEvent[]>(
    cachedResponse?.monthEvents ?? [],
  )
  const [isLoading, setIsLoading] = useState(!cachedResponse)
  const [error, setError] = useState<string>('')

  // Generator stage state
  const [stage, setStage] = useState<Stage>('list')
  const [selectedEvent, setSelectedEvent] = useState<OnThisDayEvent | null>(null)
  const [editedTitle, setEditedTitle] = useState('')
  const [brand, setBrand] = useState((!isAdmin && globalBrand) ? globalBrand : '')
  const canvasRef = useRef<OnThisDayCanvasHandle>(null)

  // Highlight terms fetched on-demand from the same n8n webhook (POST mode).
  // Server returns either an LLM phrase or its own deterministic fallback —
  // the canvas trusts whatever's here and renders no highlight when empty.
  const [fetchedHighlightTerms, setFetchedHighlightTerms] = useState<
    string[] | undefined
  >(undefined)
  // Brand-specific accent overrides the canvas's electric blue when the
  // Brand Tone & Voice data table has a `brand_hex` for the chosen brand.
  const [fetchedBrandHex, setFetchedBrandHex] = useState<string | null>(null)

  // Click-to-expand lightbox for the canvas preview (mirrors QuotePage).
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const closeLightbox = useCallback(() => setLightboxUrl(null), [])

  useEffect(() => {
    if (!lightboxUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxUrl, closeLightbox])

  // Schedule state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<'idle' | 'done' | 'error'>('idle')

  useEffect(() => {
    if (cachedResponse) return

    if (!webhookUrl) {
      setError('Webhook URL not configured.')
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    const fetchEvents = async () => {
      try {
        const res = await fetch(webhookUrl, { signal: controller.signal })
        const json: OnThisDayResponse = await res.json()

        if (json.success) {
          cachedResponse = json
          setTodayEvents(json.todayEvents ?? [])
          setMonthEvents(json.monthEvents ?? [])
        } else {
          setError(json.error || 'Failed to load events.')
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError('Unable to reach the OnThisDay service. Please try again.')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    fetchEvents()
    return () => controller.abort()
  }, [webhookUrl])

  // Translate the title + extract highlight terms in one server call. Fires
  // when brand changes (drives target language) — re-fires automatically when
  // the user picks a different brand. Title edits don't re-fire (cache-friendly).
  useEffect(() => {
    const highlightsUrl = import.meta.env.VITE_ONTHISDAY_HIGHLIGHTS_URL as
      | string
      | undefined
    if (stage !== 'generate' || !selectedEvent || !brand) return
    if (!highlightsUrl) {
      toast.error('On This Day highlights URL not configured.')
      setFetchedHighlightTerms([])
      setFetchedBrandHex(null)
      return
    }
    const controller = new AbortController()
    setFetchedHighlightTerms(undefined)
    setFetchedBrandHex(null)

    const run = async () => {
      try {
        const res = await fetch(highlightsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: selectedEvent.onThisDayTitle,
            brand,
          }),
          signal: controller.signal,
        })
        const json = (await res.json()) as {
          success?: boolean
          highlightTerms?: string[]
          translatedTitle?: string
          brandHex?: string
        }
        if (controller.signal.aborted) return
        if (typeof json.translatedTitle === 'string' && json.translatedTitle.length > 0) {
          // Swap the editor's content to the brand-language title so the canvas
          // and the editor stay in sync. The original English remains accessible
          // via selectedEvent.onThisDayTitle if needed for re-translate.
          setEditedTitle(json.translatedTitle)
        }
        if (typeof json.brandHex === 'string' && /^#[0-9a-f]{6}$/i.test(json.brandHex)) {
          setFetchedBrandHex(json.brandHex)
        }
        setFetchedHighlightTerms(
          Array.isArray(json.highlightTerms) ? json.highlightTerms : [],
        )
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Network failure — leave terms undefined; canvas renders without highlight.
        setFetchedHighlightTerms([])
      }
    }
    run()
    return () => controller.abort()
  }, [stage, selectedEvent, brand])

  const handleSelectEvent = useCallback((item: OnThisDayEvent) => {
    setSelectedEvent(item)
    setEditedTitle(item.onThisDayTitle)
    setScheduleStatus('idle')
    setStage('generate')
  }, [])

  function handleBack() {
    if (stage === 'generate') {
      setStage('list')
      setSelectedEvent(null)
      setEditedTitle('')
      setBrand('')
    } else {
      navigate('/engagement-posts')
    }
  }

  async function handleSchedule(scheduledFor: string, passcode?: string) {
    if (!brand) {
      toast.error('Pick a brand first.')
      return
    }
    const draftWebhook = (
      import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined
    )?.trim()
    if (!draftWebhook) {
      toast.error('Webhook not configured.')
      return
    }

    const dataUrl = canvasRef.current?.getDataUrl()
    if (!dataUrl) {
      toast.error('Image not ready.')
      return
    }

    const creds = passcode
      ? { passcode }
      : getCredentials(brand.toLowerCase())
    if (!creds) {
      toast.error('Passcode required.')
      return
    }

    setIsScheduling(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File(
        [blob],
        `onthisday-${brand.toLowerCase()}-${Date.now()}.png`,
        { type: 'image/png' },
      )
      const publicId = await uploadToCloudinary(file)
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string
      const fb_ai_image_url = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`

      const res = await fetch(draftWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url,
          fb_ai_caption: editedTitle,
          brand: brand.toLowerCase(),
          scheduled_for: scheduledFor,
          passcode: creds.passcode,
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        status?: string
        message?: string
      }

      if (data.status === 'AUTH_ERROR') {
        toast.error(data.message ?? 'Invalid passcode.')
        setScheduleStatus('error')
      } else if (
        data.success === true ||
        data.status === 'SUCCESS' ||
        data.status === 'DRAFT_SAVED'
      ) {
        toast.success('On This Day post scheduled!')
        setScheduleStatus('done')
      } else {
        toast.error(data.message ?? 'Something went wrong.')
        setScheduleStatus('error')
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message.startsWith('Upload failed')
          ? 'Image upload failed. Please try again.'
          : 'Network error. Please try again.'
      toast.error(msg)
      setScheduleStatus('error')
    } finally {
      setIsScheduling(false)
      setShowScheduleModal(false)
    }
  }

  const now = new Date()
  const today = now.toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const monthName = now.toLocaleDateString('en-MY', { month: 'long' })

  // ─── Generator Stage ────────────────────────────────────────────────────
  if (stage === 'generate' && selectedEvent) {
    return (
      <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
              >
                <IconChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                On This Day — Generator
              </h1>
            </div>
            <p className="text-neutral-500 text-sm">
              Pick a brand and tweak the headline. The canvas updates live.
            </p>
            <div
              className="mt-4 h-[3px] rounded-full animate-stripe-grow"
              style={{
                background:
                  'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)',
              }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
            {/* Left — controls */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-6">
              {/* Brand */}
              {(isAdmin || !globalBrand) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand To Generate For
                  </label>
                  <div className="relative">
                    <select
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      required
                      className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white transition appearance-none cursor-pointer"
                    >
                      <option value="">Select a brand...</option>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}

              {!brand && (
                <p className="text-xs text-neutral-500">
                  Pick a brand to unlock the headline editor and image options.
                </p>
              )}

              {/* Editable title — hidden until brand is picked */}
              {brand && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">
                    Headline (OnThisDayTitle)
                  </label>
                  <span className="text-xs text-gray-400">
                    {editedTitle.length}
                  </span>
                </div>
                <textarea
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-relaxed transition"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The "On This Day —" prefix is stripped automatically on the canvas.
                </p>
              </div>
              )}

            </div>

            {/* Right — placeholder until brand is picked, then canvas + actions */}
            <div className="space-y-4">
              {!brand ? (
                <div className="glass-card rounded-2xl p-12 min-h-[420px] flex flex-col items-center justify-center text-center">
                  <IconSparkles className="w-12 h-12 text-neutral-200 mb-3" />
                  <p className="text-sm font-medium text-neutral-500">
                    Pick a brand to preview your post
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    The Bold Modernist canvas will render once a brand is selected.
                  </p>
                </div>
              ) : fetchedHighlightTerms === undefined ? (
                <div className="glass-card rounded-2xl p-12 min-h-[420px] flex flex-col items-center justify-center text-center">
                  <Spinner size="lg" />
                  <p className="text-sm font-medium text-neutral-500 mt-4">
                    Extracting highlight phrase…
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Asking the LLM for the most prominent subject in this story.
                  </p>
                </div>
              ) : (
                <>
                  {(() => {
                    // If a brand is listed in BRAND_ONTHISDAY_THEMES, that
                    // file is the single source of truth — n8n's brandHex is
                    // intentionally ignored so brands stay standardized to
                    // the default theme unless explicitly overridden here.
                    // Brands NOT listed fall back to brandHex for accent.
                    const brandTheme = BRAND_ONTHISDAY_THEMES[brand]
                    const theme = brandTheme
                      ? { ...DEFAULT_ONTHISDAY_THEME, ...brandTheme }
                      : {
                          ...DEFAULT_ONTHISDAY_THEME,
                          accentColor:
                            fetchedBrandHex ??
                            DEFAULT_ONTHISDAY_THEME.accentColor,
                        }
                    return (
                      <OnThisDayCanvas
                        ref={canvasRef}
                        title={editedTitle}
                        date={selectedEvent.date}
                        brand={brand}
                        eventUrl={selectedEvent.url}
                        highlightTerms={fetchedHighlightTerms}
                        {...theme}
                        onClick={() => {
                          const dataUrl = canvasRef.current?.getDataUrl()
                          if (dataUrl) setLightboxUrl(dataUrl)
                        }}
                      />
                    )
                  })()}

                  <div className="flex gap-2">
                    <button
                      onClick={() => canvasRef.current?.downloadAsPng()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-gray-400 bg-white hover:bg-gray-50 transition"
                    >
                      <IconDownload className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      disabled={isScheduling || scheduleStatus === 'done'}
                      className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {isScheduling
                        ? 'Scheduling...'
                        : scheduleStatus === 'done'
                          ? 'Scheduled!'
                          : 'Schedule on FB'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {showScheduleModal && (
            <ScheduleModal
              brand={brand}
              hasCredentials={!!getCredentials(brand.toLowerCase())}
              isPosting={isScheduling}
              onConfirm={handleSchedule}
              onClose={() => setShowScheduleModal(false)}
            />
          )}

          {lightboxUrl && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
              onClick={closeLightbox}
            >
              <button
                onClick={closeLightbox}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
              >
                <IconX className="w-5 h-5" />
              </button>
              <img
                src={lightboxUrl}
                alt="On This Day preview"
                className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </main>
    )
  }

  // ─── List Stage (default) ───────────────────────────────────────────────
  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-28">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start gap-3">
            <button
              onClick={handleBack}
              className="mt-0.5 p-1.5 hover:bg-neutral-200/60 rounded-lg transition text-neutral-500 hover:text-neutral-950 shrink-0"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                On This Day — Malaysia
              </h1>
              <p className="text-neutral-500 mt-1 text-sm">
                Historical events that happened in Malaysia on this day in history. Pick one to generate a post.
              </p>
            </div>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        <div className="space-y-6">
          {isLoading && (
            <div className="glass-card rounded-2xl p-10 flex flex-col items-center gap-4">
              <Spinner size="lg" />
              <p className="text-sm text-neutral-500">Fetching today's events…</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          {!isLoading && !error && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #FF3FBF, #0055EE)' }}
                  />
                  <h2 className="text-sm font-semibold text-neutral-700">On This Day</h2>
                </div>
                <span className="text-xs text-neutral-400">{today}</span>
              </div>

              {todayEvents.length === 0 ? (
                <div className="p-12 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                    <IconCalendar className="w-6 h-6 text-neutral-300" />
                  </div>
                  <p className="text-sm font-medium text-neutral-600">No events recorded for today.</p>
                  <p className="text-xs text-neutral-400">Check back tomorrow or try refreshing.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {todayEvents.map((item, idx) => (
                    <OnThisDayEventRow key={idx} item={item} onSelect={handleSelectEvent} />
                  ))}
                </div>
              )}
            </div>
          )}

          {!isLoading && !error && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neutral-300" />
                  <h2 className="text-sm font-semibold text-neutral-700">In {monthName} — Across the Years</h2>
                </div>
                {monthEvents.length > 0 && (
                  <span className="text-xs text-neutral-400">{monthEvents.length}</span>
                )}
              </div>

              {monthEvents.length === 0 ? (
                <div className="p-8 flex items-center gap-3 text-neutral-400">
                  <IconCalendar className="w-5 h-5 shrink-0" />
                  <p className="text-sm">No other historical events found for this date.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {monthEvents.map((item, idx) => (
                    <OnThisDayEventRow key={idx} item={item} onSelect={handleSelectEvent} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
