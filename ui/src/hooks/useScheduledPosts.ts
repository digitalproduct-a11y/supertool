import { useState, useEffect, useCallback } from 'react'
import type {
  ScheduledPost,
  UpdatePostPayload,
  SchedulePostPayload,
} from '../types'

// ─── Cloudinary URL builder ───────────────────────────────────────────────────
// Builds a real-time Cloudinary preview URL with editable title
// Pattern: standard Astro Ulagam template with text layers
// Adjust this if the actual n8n Code node uses a different structure

export function buildCloudinaryUrl(photoPublicId: string, title: string): string {
  const encodedTitle = encodeURIComponent(encodeURIComponent(title))

  // Cloudinary transformation template for Astro Ulagam
  // Structure: base transformations + text layer for title + base image
  return [
    'https://res.cloudinary.com/dymmqtqyg/image/upload',
    'c_fill,g_auto,w_1080,h_1350',
    'c_pad,w_1080,h_1350,g_north',
    'l_astro_ulagam_template_xx9gmo,c_fill,w_1080,h_1350/fl_layer_apply,g_south,y_0',
    `l_text:fonts:leaguespartan.ttf_56_bold_center:${encodedTitle},co_rgb:ffffff,c_fit,w_610/fl_layer_apply,g_north,x_0,y_960`,
    photoPublicId,
  ].join('/')
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

  const loadPosts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ brand })
      const res = await fetchWithTimeout(`${getFetchUrl()}?${params}`)
      const data = await res.json()
      if (data.success) {
        setPosts(data.posts)
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

  return { posts, isLoading, error, loadPosts, schedulePost, buildCloudinaryUrl }
}
