import { useState, useRef, useEffect } from 'react'
import { IconTrendingUp } from '@tabler/icons-react'

interface Post {
  post_type: string
  customer_profile_id: string
  profile_guid: string
  text: string
  perma_link: string
  metrics: {
    'lifetime.likes': number
    'lifetime.comments_count': number
    'lifetime.impressions': number
    'lifetime.post_link_clicks': number
    'lifetime.impressions_unique': number
    'lifetime.shares_count': number
    'lifetime.reactions': number
  }
  created_time: string
}

interface TopPostsChartProps {
  brand: string
  profileId: number
}

const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()
const toInput = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const MIN_DATA_DATE = new Date(2026, 0, 16, 0, 0, 0, 0)

interface CalendarMonthProps {
  date: Date
  onSelect: (date: Date) => void
  isStart: boolean
  minDate?: Date
  maxDate?: Date
}

function CalendarMonth({ date, onSelect, isStart, minDate, maxDate }: CalendarMonthProps) {
  const [displayMonth, setDisplayMonth] = useState(new Date(date.getFullYear(), date.getMonth(), 1))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysInMonth = getDaysInMonth(displayMonth)
  const firstDay = getFirstDayOfMonth(displayMonth)
  const days: (number | null)[] = Array(firstDay).fill(null)

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const handleDayClick = (day: number) => {
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day, 0, 0, 0, 0)
    onSelect(newDate)
    if (!isStart) setDisplayMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1))
  }

  const monthName = displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="w-64">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
          className="text-neutral-500 hover:text-neutral-700"
        >
          ←
        </button>
        <p className="text-sm font-medium text-neutral-700">{monthName}</p>
        <button
          onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
          className="text-neutral-500 hover:text-neutral-700"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <p key={d} className="text-xs text-neutral-400 text-center py-1 font-medium">{d}</p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const cellDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day, 0, 0, 0, 0)
          const isFuture = cellDate > today
          const isDisabled = isFuture || (minDate && cellDate < minDate) || (maxDate && cellDate > maxDate)
          const isSelected = date.toDateString() === cellDate.toDateString()

          return (
            <button
              key={day}
              onClick={() => !isDisabled && handleDayClick(day)}
              disabled={isDisabled}
              className={`w-7 h-7 text-xs text-center rounded transition ${
                isSelected
                  ? 'bg-neutral-950 text-white font-medium'
                  : isDisabled
                  ? 'text-neutral-300 cursor-not-allowed'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TopPostsChart({ brand, profileId }: TopPostsChartProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queryStartDate, setQueryStartDate] = useState<Date | null>(null)
  const [queryEndDate, setQueryEndDate] = useState<Date | null>(null)
  const [tempStart, setTempStart] = useState<Date | null>(null)
  const [tempEnd, setTempEnd] = useState<Date | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [hasQueried, setHasQueried] = useState(false)
  const [lastFetchedStart, setLastFetchedStart] = useState<Date | null>(null)
  const [lastFetchedEnd, setLastFetchedEnd] = useState<Date | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPosts([])
    setError(null)
  }, [brand, profileId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [pickerOpen])

  useEffect(() => {
    // Load Facebook SDK for embeds
    if (posts.length > 0) {
      // Initialize Facebook SDK
      if (window.FB) {
        setTimeout(() => {
          window.FB.XFBML.parse()
        }, 100)
      } else {
        const script = document.createElement('script')
        script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v20.0'
        script.async = true
        script.defer = true
        script.onload = () => {
          if (window.FB) {
            setTimeout(() => {
              window.FB.XFBML.parse()
            }, 100)
          }
        }
        document.body.appendChild(script)
      }
    }
  }, [posts])

  const handleOpenPicker = () => {
    setTempStart(queryStartDate || new Date())
    setTempEnd(queryEndDate || new Date())
    setPickerOpen(true)
  }

  const handleApplyDates = () => {
    if (tempStart && tempEnd && tempStart <= tempEnd) {
      setQueryStartDate(tempStart)
      setQueryEndDate(tempEnd)
      setPickerOpen(false)
    }
  }

  const handleConfirm = async () => {
    if (!queryStartDate || !queryEndDate) return

    setLoading(true)
    setError(null)
    setHasQueried(true)
    try {
      const startStr = toInput(queryStartDate)
      const endStr = toInput(queryEndDate)

      const response = await fetch(`https://astroproduct.app.n8n.cloud/webhook/analyze-trending-posts?startDate=${startStr}&endDate=${endStr}&profileId=${profileId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) throw new Error('Failed to fetch posts')

      const data = await response.json()
      console.log('TopPosts response:', data)

      // Handle array format: [{ data: [...] }]
      let posts = []
      if (Array.isArray(data) && data[0]?.data) {
        posts = data[0].data
      } else if (data.posts) {
        posts = data.posts
      }
      setPosts(posts)
      setLastFetchedStart(queryStartDate)
      setLastFetchedEnd(queryEndDate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const dateRangeLabel = queryStartDate && queryEndDate
    ? `${toInput(queryStartDate)} to ${toInput(queryEndDate)}`
    : 'Select dates'

  const areDatesSameAsFetched =
    lastFetchedStart && lastFetchedEnd &&
    toInput(queryStartDate || new Date()) === toInput(lastFetchedStart) &&
    toInput(queryEndDate || new Date()) === toInput(lastFetchedEnd)

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-950">Top Posts for {brand}</h2>

        <div className="flex gap-4 items-end mt-4">
          <div className="flex gap-2 items-end relative" ref={pickerRef}>
            <button
              onClick={handleOpenPicker}
              className="px-3 py-2 border border-neutral-200 rounded-lg text-sm hover:bg-neutral-50 transition"
            >
              {dateRangeLabel}
            </button>

            {pickerOpen && (
              <div className="absolute left-0 top-full mt-2 z-50 bg-white border border-neutral-200 rounded-lg shadow-xl p-4" style={{ width: '550px' }}>
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div>
                    <p className="text-xs font-medium text-neutral-600 mb-3">Start Date</p>
                    <CalendarMonth
                      date={tempStart || new Date()}
                      onSelect={setTempStart}
                      isStart
                      maxDate={tempEnd}
                      minDate={MIN_DATA_DATE}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-600 mb-3">End Date</p>
                    <CalendarMonth
                      date={tempEnd || new Date()}
                      onSelect={setTempEnd}
                      isStart={false}
                      minDate={tempStart}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyDates}
                    className="px-3 py-1 bg-neutral-950 text-white rounded text-sm font-medium hover:bg-neutral-800 transition"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={loading || !queryStartDate || !queryEndDate || (posts.length > 0 && areDatesSameAsFetched)}
            className="px-4 py-2 bg-neutral-950 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Get Top Posts'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <p className="text-neutral-500">Loading posts...</p>
        </div>
      )}

      {!loading && posts.length === 0 && !error && hasQueried && (
        <div className="text-center py-12">
          <p className="text-neutral-500">No posts found for this date range</p>
        </div>
      )}

      {!loading && posts.length === 0 && !error && !hasQueried && (
        <div className="flex flex-col items-center justify-center py-24">
          <IconTrendingUp className="w-12 h-12 text-neutral-950 mb-4" stroke={1.5} />
          <p className="text-xs text-neutral-500">Find the top ten posts for your selected date range.</p>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div>
          <div className="flex flex-col gap-3">
            <div
              id="fb-posts-carousel"
              className="flex flex-col gap-3 overflow-y-auto"
              style={{ height: '600px', scrollbarWidth: 'thin', msOverflowStyle: 'auto' }}
            >
              {posts.map((post: any, idx) => {
                const metrics = post.metrics || {}
                const interactions = (metrics['lifetime.reactions'] || 0) + (metrics['lifetime.comments_count'] || 0) + (metrics['lifetime.shares_count'] || 0)
                const createdTime = post.created_time ? new Date(post.created_time).toLocaleString() : 'N/A'

                return (
                  <div
                    key={`${post.perma_link}-${idx}`}
                    className="flex-shrink-0 mx-auto"
                    style={{ maxWidth: '600px', width: '100%' }}
                  >
                    <p className="text-lg font-bold text-neutral-950 uppercase mb-3">Top Post {idx + 1}</p>
                    <p className="text-sm font-medium text-neutral-950 line-clamp-2 mb-2">{post.text || 'Untitled'}</p>
                    <div className="mb-4">
                      <div className="flex gap-4 text-xs text-neutral-600 flex-wrap">
                        <span>Interactions: <span className="font-semibold text-neutral-950">{interactions.toLocaleString()}</span></span>
                        <span>Posted: <span className="font-semibold text-neutral-950">{createdTime}</span></span>
                        <a href={post.perma_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-semibold">
                          Original Link
                        </a>
                      </div>
                    </div>
                    <div className="pb-4 border-b border-neutral-200">
                      <div
                        className="fb-post"
                        data-href={post.perma_link}
                        data-width="590"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
