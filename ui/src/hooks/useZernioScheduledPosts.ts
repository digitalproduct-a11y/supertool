import { useState, useEffect, useCallback } from 'react'
import type { ZernioPost, ZernioPostsResponse } from '../types'

const PAGE_SIZE = 20

function getApiBase(): string {
  return ((import.meta.env.VITE_ZERNIO_API_BASE_URL as string | undefined) ?? '').trim()
}

function getApiKey(): string {
  return ((import.meta.env.VITE_ZERNIO_API_KEY as string | undefined) ?? '').trim()
}

function authHeaders(includeContentType = false): HeadersInit {
  const headers: HeadersInit = {
    'Authorization': `Bearer ${getApiKey()}`,
  }
  if (includeContentType) headers['Content-Type'] = 'application/json'
  return headers
}

export function useZernioScheduledPosts() {
  const [posts, setPosts] = useState<ZernioPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchPosts = useCallback(async (pageNum: number) => {
    const base = getApiBase()
    const key = getApiKey()
    if (!base || !key) {
      setError('Zernio API is not configured. Add VITE_ZERNIO_API_BASE_URL and VITE_ZERNIO_API_KEY to .env.local.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)

    try {
      const params = new URLSearchParams({
        status: 'scheduled',
        sortBy: 'scheduled-asc',
        page: String(pageNum),
        limit: String(PAGE_SIZE),
      })
      const res = await fetch(`${base}/v1/posts?${params}`, {
        headers: authHeaders(false),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`API error ${res.status}: ${text}`)
      }

      const data = (await res.json()) as ZernioPostsResponse
      setPosts(data.posts)
      setTotalPages(data.pagination.pages)
      setTotal(data.pagination.total)
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
    void fetchPosts(page)
  }, [fetchPosts, page])

  const refetch = useCallback(() => {
    void fetchPosts(page)
  }, [fetchPosts, page])

  const deletePost = useCallback(async (postId: string): Promise<boolean> => {
    const base = getApiBase()
    const key = getApiKey()
    if (!base || !key) return false

    setDeletingId(postId)
    try {
      const res = await fetch(`${base}/v1/posts/${postId}`, {
        method: 'DELETE',
        headers: authHeaders(false),
      })
      if (!res.ok) return false
      setPosts(prev => prev.filter(p => p._id !== postId))
      setTotal(prev => prev - 1)
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
    page,
    totalPages,
    total,
    setPage,
    refetch,
    deletePost,
    deletingId,
  }
}
