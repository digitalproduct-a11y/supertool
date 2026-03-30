import { useState } from 'react'
import type { EngagementPost, EngagementPhotosResult } from '../types'

export function useEngagementPhotos() {
  const [posts, setPosts] = useState<EngagementPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setIsLoading(true)
    setError(null)
    setPosts([])

    try {
      const webhookUrl = import.meta.env.VITE_ENGAGEMENT_PHOTOS_WEBHOOK_URL
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured')
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000) // 3 min timeout

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: controller.signal,
        mode: 'cors',
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as EngagementPhotosResult

      if ('success' in data && data.success) {
        setPosts(data.posts)
      } else if ('message' in data) {
        throw new Error(data.message)
      } else {
        throw new Error('Invalid response format')
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.name === 'AbortError' ? 'Request timed out' : err.message)
      } else {
        setError('Unknown error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return { posts, isLoading, error, generate }
}
