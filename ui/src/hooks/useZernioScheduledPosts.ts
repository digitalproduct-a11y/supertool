import { useState, useEffect, useCallback } from 'react'
import type { ZernioPost, ZernioPostsResponse } from '../types'

// Fetch all scheduled posts in one go so filtering + pagination happens
// client-side. The Zernio API paginates across all brands, so we can't paginate
// server-side and filter by brand client-side without ending up with sparse
// pages where a brand's posts are spread across multiple pages.
const FETCH_LIMIT = 200
const API_BASE = '/api/zernio'

export function useZernioScheduledPosts() {
  const [posts, setPosts] = useState<ZernioPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)

    try {
      const params = new URLSearchParams({
        status: 'scheduled',
        sortBy: 'scheduled-asc',
        page: '1',
        limit: String(FETCH_LIMIT),
      })
      const res = await fetch(`${API_BASE}/posts?${params}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`API error ${res.status}: ${text}`)
      }

      const data = (await res.json()) as ZernioPostsResponse
      setPosts(data.posts)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. Check your connection and try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load scheduled posts.')
      }
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPosts()
  }, [fetchPosts])

  const deletePost = useCallback(async (postId: string): Promise<boolean> => {
    setDeletingId(postId)
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}`, {
        method: 'DELETE',
      })
      if (!res.ok) return false
      setPosts(prev => prev.filter(p => p._id !== postId))
      return true
    } catch {
      return false
    } finally {
      setDeletingId(null)
    }
  }, [])

  return {
    posts,
    isLoading,
    error,
    refetch: fetchPosts,
    deletePost,
    deletingId,
  }
}
