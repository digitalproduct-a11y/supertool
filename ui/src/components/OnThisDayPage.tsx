import { useState, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft, IconCalendar, IconExternalLink } from '@tabler/icons-react'
import { Spinner } from './ds/Spinner'

interface OnThisDayEvent {
  onThisDayTitle: string
  url: string
  date: string | null
  image: string
}

interface OnThisDayResponse {
  success: boolean
  status: 'found' | 'not_found' | 'error'
  error?: string
  todayEvents: OnThisDayEvent[]
  monthEvents: OnThisDayEvent[]
}

/** Parses a DD/MM/YYYY string into a Date. Returns null if input is null, empty, or malformed. */
function parseDDMMYYYY(date: string | null): Date | null {
  if (!date) return null
  const parts = date.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts.map(Number)
  if (!dd || !mm || !yyyy || isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null
  const d = new Date(yyyy, mm - 1, dd)
  if (isNaN(d.getTime())) return null
  return d
}

// ─── Event Row (used in both sections) ───────────────────────────────────────

const OnThisDayEventRow = memo(function OnThisDayEventRow({ item }: { item: OnThisDayEvent }) {
  const parsedDate = parseDDMMYYYY(item.date)
  const formattedDate = parsedDate
    ? parsedDate.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })
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
      </div>
    </div>
  )
})

// Module-level cache — survives component remounts (navigation away and back)
let cachedResponse: OnThisDayResponse | null = null

// ─── Main Page ────────────────────────────────────────────────────────────────

export function OnThisDayPage() {
  const navigate = useNavigate()
  const webhookUrl = import.meta.env.VITE_ONTHISDAY_URL as string | undefined

  const [todayEvents, setTodayEvents] = useState<OnThisDayEvent[]>(cachedResponse?.todayEvents ?? [])
  const [monthEvents, setMonthEvents] = useState<OnThisDayEvent[]>(cachedResponse?.monthEvents ?? [])
  const [isLoading, setIsLoading] = useState(!cachedResponse)
  const [error, setError] = useState<string>('')

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

  const now = new Date()
  const today = now.toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const monthName = now.toLocaleDateString('en-MY', { month: 'long' })

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-28">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate('/engagement-posts')}
              className="mt-0.5 p-1.5 hover:bg-neutral-200/60 rounded-lg transition text-neutral-500 hover:text-neutral-950 shrink-0"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                On This Day — Malaysia
              </h1>
              <p className="text-neutral-500 mt-1 text-sm">
                Historical events that happened in Malaysia on this day in history
              </p>
            </div>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        <div className="space-y-6">

          {/* Loading */}
          {isLoading && (
            <div className="glass-card rounded-2xl p-10 flex flex-col items-center gap-4">
              <Spinner size="lg" />
              <p className="text-sm text-neutral-500">Fetching today's events…</p>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          {/* ── Section 1: On This Day ── */}
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
                    <OnThisDayEventRow key={idx} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Section 2: In [Month] — Across the Years ── */}
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
                    <OnThisDayEventRow key={idx} item={item} />
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
