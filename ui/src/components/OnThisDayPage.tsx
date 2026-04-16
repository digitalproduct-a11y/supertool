import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft, IconCalendar, IconUser, IconExternalLink } from '@tabler/icons-react'
import { Spinner } from './ds/Spinner'

interface FeaturedEvent {
  type: 'featured'
  title: string
  description: string | null
  date: string | null
  image: string | null
  imageCaption: string | null
  relatedPerson: string | null
  relatedPersonRole: string | null
}

interface ListEvent {
  type: 'event'
  title: string
  date: string | null
  relatedPersons: string[] | null
  sourceArticleTitle: string | null
}

type AnyEvent = FeaturedEvent | ListEvent

interface TavilyResult {
  summarized_title: string
  facebook_caption: string
  url: string
  date: string | null
  image: string
}

interface OnThisDayResponse {
  success: boolean
  status: 'found' | 'not_found' | 'error'
  message?: string | null
  featured: FeaturedEvent[]
  events: ListEvent[]
  monthEvents?: AnyEvent[]
  malaysia_events?: TavilyResult[]
  tavily_error?: boolean
  error?: string
}

function yearFromDate(date: string | null): string | null {
  return date ? date.split('-')[0] : null
}

function dayMonthFromDate(date: string | null): string | null {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'long' })
}


// ─── Featured Event Row (inside glass-card list) ──────────────────────────────

function FeaturedEventRow({ item }: { item: FeaturedEvent }) {
  const year = yearFromDate(item.date)
  const dayMonth = dayMonthFromDate(item.date)

  return (
    <div className="p-4 hover:bg-neutral-50/50 transition-colors">
      <div className="flex gap-4">
        {/* Image thumbnail */}
        {item.image && (
          <div className="shrink-0">
            <img
              src={item.image}
              alt={item.imageCaption ?? item.title}
              className="w-20 h-20 object-contain rounded-lg bg-neutral-50 opacity-80"
            />
          </div>
        )}

        {/* Text content */}
        <div className="flex-1 min-w-0">
          {/* Featured badge */}
          <span
            className="inline-flex items-center text-[10px] font-semibold text-white px-2 py-0.5 rounded-full mb-1.5"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #0055EE)' }}
          >
            Featured
          </span>

          {/* Year */}
          {year && (
            <p className="font-display text-3xl font-semibold text-neutral-950 tabular-nums leading-none mb-1">
              {year}
            </p>
          )}

          {/* Date label */}
          {dayMonth && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">
              {dayMonth}
            </p>
          )}

          <p className="text-sm font-semibold text-neutral-900 leading-snug">{item.title}</p>

          {item.description && (
            <p className="text-xs text-neutral-500 leading-relaxed mt-1">{item.description}</p>
          )}

          {!item.image && item.imageCaption && (
            <p className="text-[10px] text-neutral-400 italic mt-1">{item.imageCaption}</p>
          )}

          {item.relatedPerson && (
            <div className="flex items-center gap-1.5 mt-2">
              <IconUser className="w-3 h-3 text-neutral-400 shrink-0" />
              <p className="text-[10px] text-neutral-500 truncate">
                {item.relatedPerson}
                {item.relatedPersonRole ? ` · ${item.relatedPersonRole}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Regular Event Row (inside glass-card list) ───────────────────────────────

function EventRow({ item }: { item: ListEvent }) {
  const year = yearFromDate(item.date)
  const dayMonth = dayMonthFromDate(item.date)

  return (
    <div className="p-3 hover:bg-neutral-50/50 transition-colors flex gap-4">
      {/* Date column */}
      <div className="w-16 shrink-0 pt-0.5">
        <p className="text-xs font-bold text-neutral-400 tabular-nums leading-tight">{year ?? '—'}</p>
        {dayMonth && (
          <p className="text-[10px] text-neutral-300 leading-tight mt-0.5">{dayMonth}</p>
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-800 leading-snug">{item.title}</p>
        {item.relatedPersons && item.relatedPersons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.relatedPersons.map((person, pi) => (
              <span
                key={pi}
                className="text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded px-1.5 py-0.5"
              >
                {person}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tavily Result Row (Section 3) ───────────────────────────────────────────

function TavilyResultRow({ item }: { item: TavilyResult }) {
  return (
    <div className="p-3 hover:bg-neutral-50/50 transition-colors">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-1.5 group mb-1"
      >
        <p className="text-sm font-medium text-neutral-800 leading-snug group-hover:text-neutral-950 transition-colors flex-1 min-w-0">
          {item.summarized_title}
        </p>
        <IconExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0 mt-0.5" />
      </a>
      {item.date && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1">
          {item.date}
        </p>
      )}
      {item.facebook_caption && (
        <p className="text-xs text-neutral-500 leading-relaxed">{item.facebook_caption}</p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function OnThisDayPage() {
  const navigate = useNavigate()
  const webhookUrl = import.meta.env.VITE_ONTHISDAY_URL as string | undefined

  const [featured, setFeatured] = useState<FeaturedEvent[]>([])
  const [events, setEvents] = useState<ListEvent[]>([])
  const [monthEvents, setMonthEvents] = useState<AnyEvent[]>([])
  const [malaysiaEvents, setMalaysiaEvents] = useState<TavilyResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!webhookUrl) {
      setError('Webhook URL not configured.')
      setIsLoading(false)
      return
    }

    const fetchEvents = async () => {
      try {
        const res = await fetch(webhookUrl)
        const json: OnThisDayResponse = await res.json()

        if (!json.success) {
          setError(json.error || 'Failed to load events.')
        } else if (json.status === 'not_found') {
          setFeatured([])
          setEvents([])
          setMonthEvents(json.monthEvents ?? [])
          setMalaysiaEvents(!json.tavily_error ? (json.malaysia_events ?? []) : [])
        } else {
          setFeatured(json.featured ?? [])
          setEvents(json.events ?? [])
          setMonthEvents(json.monthEvents ?? [])
          setMalaysiaEvents(!json.tavily_error ? (json.malaysia_events ?? []) : [])
        }
      } catch {
        setError('Unable to reach the OnThisDay service. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvents()
  }, [webhookUrl])

  const now = new Date()
  const today = now.toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const monthName = now.toLocaleDateString('en-MY', { month: 'long' })

  const hasTodayEvents = featured.length > 0 || events.length > 0
  const isEmpty = !isLoading && !error && !hasTodayEvents

  const todayAllEvents: AnyEvent[] = [...featured, ...events]

  const sortedMonthEvents = [...monthEvents].sort((a, b) => {
    const dayA = parseInt(a.date?.slice(8, 10) ?? '0', 10)
    const dayB = parseInt(b.date?.slice(8, 10) ?? '0', 10)
    if (dayA !== dayB) return dayA - dayB
    return (a.date ?? '').localeCompare(b.date ?? '')
  })

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-28">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate('/engagement-photos')}
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

              {/* Empty state */}
              {isEmpty && (
                <div className="p-12 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                    <IconCalendar className="w-6 h-6 text-neutral-300" />
                  </div>
                  <p className="text-sm font-medium text-neutral-600">No events recorded for today.</p>
                  <p className="text-xs text-neutral-400">Check back tomorrow or try refreshing.</p>
                </div>
              )}

              {/* Event rows */}
              {hasTodayEvents && (
                <div className="divide-y divide-neutral-50">
                  {todayAllEvents.map((item, idx) =>
                    item.type === 'featured' ? (
                      <FeaturedEventRow key={idx} item={item as FeaturedEvent} />
                    ) : (
                      <EventRow key={idx} item={item as ListEvent} />
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Section 2: This Month ── */}
          {!isLoading && !error && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neutral-300" />
                  <h2 className="text-sm font-semibold text-neutral-700">In {monthName} — across the years</h2>
                </div>
                {sortedMonthEvents.length > 0 && (
                  <span className="text-xs text-neutral-400">{sortedMonthEvents.length}</span>
                )}
              </div>

              {sortedMonthEvents.length === 0 ? (
                <div className="p-8 flex items-center gap-3 text-neutral-400">
                  <IconCalendar className="w-5 h-5 shrink-0" />
                  <p className="text-sm">No other historical events recorded for {monthName}.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {sortedMonthEvents.map((item, idx) => {
                    const year = yearFromDate(item.date)
                    const dayMonth = dayMonthFromDate(item.date)
                    return (
                      <div key={idx} className="p-3 hover:bg-neutral-50/50 transition-colors flex gap-4">
                        {/* Date column */}
                        <div className="w-20 shrink-0 pt-0.5">
                          <p className="text-xs font-bold text-neutral-400 tabular-nums leading-tight">{year ?? '—'}</p>
                          {dayMonth && (
                            <p className="text-[10px] text-neutral-300 leading-tight mt-0.5">{dayMonth}</p>
                          )}
                        </div>
                        {/* Content column */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-800 leading-snug">{item.title}</p>
                          {item.type === 'event' && (item as ListEvent).relatedPersons && (item as ListEvent).relatedPersons!.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(item as ListEvent).relatedPersons!.map((person, pi) => (
                                <span
                                  key={pi}
                                  className="text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded px-1.5 py-0.5"
                                >
                                  {person}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.type === 'featured' && (item as FeaturedEvent).relatedPerson && (
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              {(item as FeaturedEvent).relatedPerson}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Section 3: From Around the Web (Tavily) ── */}
          {!isLoading && !error && malaysiaEvents.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #00E5D4, #0055EE)' }}
                  />
                  <h2 className="text-sm font-semibold text-neutral-700">From Around the Web</h2>
                </div>
                <span className="text-xs text-neutral-400">{malaysiaEvents.length} sources</span>
              </div>
              <div className="divide-y divide-neutral-50">
                {malaysiaEvents.map((item, idx) => (
                  <TavilyResultRow key={idx} item={item} />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
