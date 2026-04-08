import { useState, useEffect, useCallback } from 'react'
import type {
  ScheduledPost,
  SchedulePostPayload,
} from '../types'

// ─── Cloudinary URL builder ───────────────────────────────────────────────────
// Modifies the webhook-provided URL by replacing only the headline text
// Preserves all brand-specific transformations (template, fonts, positioning, colors, etc.)
// This works across all brands because it respects the webhook's built transformation chain

export function buildCloudinaryUrl(_photoPublicId: string, title: string, imageUrl: string): string {
  const encodedTitle = encodeURIComponent(encodeURIComponent(title))

  // Find and replace the headline text layer within the existing URL
  // Pattern: l_text:fonts:{fontspec}:{oldHeadline},{rest of text layer}
  // This preserves font, size, color, positioning, and all other transformations
  const headlinePattern = /l_text:fonts:([^:]+):([^,]+),/

  if (headlinePattern.test(imageUrl)) {
    return imageUrl.replace(
      headlinePattern,
      `l_text:fonts:$1:${encodedTitle},`
    )
  }

  // Fallback: if pattern doesn't match, return the original URL
  // (shouldn't happen if webhook provides correct format)
  return imageUrl
}

// ─── Webhook helpers ──────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

function getFetchUrl(): string {
  const url = (import.meta.env.VITE_SCHEDULED_POSTS_FETCH_WEBHOOK_URL as string | undefined)?.trim()
  if (!url) throw new Error('VITE_SCHEDULED_POSTS_FETCH_WEBHOOK_URL is not configured.')
  return url
}

function getScheduleUrl(): string {
  const url = (import.meta.env.VITE_SCHEDULED_POSTS_SCHEDULE_WEBHOOK_URL as string | undefined)?.trim()
  if (!url) throw new Error('VITE_SCHEDULED_POSTS_SCHEDULE_WEBHOOK_URL is not configured.')
  return url
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useScheduledPosts(brand: string = 'Astro Ulagam') {
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const CACHE_KEY = `scheduled_posts_${brand}`

  const shouldRefetch = (cachedTimestamp: number): boolean => {
    const now = new Date()
    const cachedDate = new Date(cachedTimestamp)

    // Check if cached data is from today
    const isSameDay =
      now.getDate() === cachedDate.getDate() &&
      now.getMonth() === cachedDate.getMonth() &&
      now.getFullYear() === cachedDate.getFullYear()

    // Use cache only if from today, otherwise refetch
    return !isSameDay
  }

  const loadPosts = useCallback(async (skipCache = false) => {
    setIsLoading(true)
    setError(null)

    // Check cache if not skipping
    if (!skipCache) {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        try {
          const { posts: cachedPosts, timestamp } = JSON.parse(cached)
          if (!shouldRefetch(timestamp)) {
            setPosts(cachedPosts)
            setIsLoading(false)
            return
          }
        } catch {
          // Invalid cache, continue to fetch
        }
      }
    }

    try {
      const params = new URLSearchParams({ brand })
      const res = await fetchWithTimeout(`${getFetchUrl()}?${params}`)
      const data = await res.json()
      if (data.success) {
        setPosts(data.posts)
        // Store in cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          posts: data.posts,
          timestamp: Date.now(),
        }))
      } else {
        setError(data.error ?? 'Failed to load posts.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setIsLoading(false)
    }
  }, [brand])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  const schedulePost = useCallback(
    async (payload: SchedulePostPayload): Promise<boolean> => {
      try {
        const res = await fetchWithTimeout(getScheduleUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          // Update local state with new scheduled status
          setPosts(prev =>
            prev.map(p =>
              p.id === payload.postId
                ? {
                    ...p,
                    status: 'scheduled',
                    scheduled_time: payload.scheduledTime,
                    scheduled_to: payload.platform,
                  }
                : p
            )
          )
          return true
        }
        return false
      } catch {
        return false
      }
    },
    []
  )

  const refetchPosts = useCallback(() => {
    loadPosts(true) // skipCache = true
  }, [loadPosts])

  return { posts, isLoading, error, loadPosts, refetchPosts, schedulePost, buildCloudinaryUrl }
}
