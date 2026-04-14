import { useState } from 'react'
import type { EngagementIdea } from '../types'

export interface TrendingTopic {
  id: string
  title: string
  content: string
}

export function useEngagementPhotos() {
  const [ideas, setIdeas] = useState<EngagementIdea[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photosByPlayerClub, setPhotosByPlayerClub] = useState<Record<string, any[]>>({})
  const [topics, setTopics] = useState<TrendingTopic[]>([])
  const [isFetchingTopics, setIsFetchingTopics] = useState(false)

  const fetchTrendingTopics = async (brand: string, webhookUrl: string) => {
    setIsFetchingTopics(true)
    setError(null)
    setTopics([])

    try {
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured')
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120 * 1000)

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand }),
        signal: controller.signal,
        mode: 'cors',
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      let data = (await response.json()) as any
      // Handle array wrapper from webhook response
      if (Array.isArray(data) && data.length > 0) {
        data = data[0]
      }
      if (data?.success && data?.topics && Array.isArray(data.topics)) {
        setTopics(data.topics)
      } else {
        console.error('Invalid response structure:', data)
        throw new Error(`Invalid response: ${JSON.stringify(data).slice(0, 100)}`)
      }
    } catch (err) {
      setError(err instanceof Error ? (err.name === 'AbortError' ? 'Request timed out' : err.message) : 'Unknown error')
    } finally {
      setIsFetchingTopics(false)
    }
  }

  const bulkSearchPhotos = async (keywords: Array<{ player: string; club: string }>) => {
    try {
      const webhookUrl = import.meta.env.VITE_CLOUDINARY_SEARCH_WEBHOOK_URL
      if (!webhookUrl) {
        throw new Error('Photo search webhook URL not configured')
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
        signal: new AbortController().signal,
        mode: 'cors',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as any
      if (data?.success && data?.photos) {
        setPhotosByPlayerClub(data.photos)
      }
    } catch (err) {
      console.error('Failed to bulk search photos:', err)
      // Don't throw - non-blocking operation
    }
  }

  const generate = async (
    brand: string,
    language: string,
    selectedTopics: Array<TrendingTopic & { post_type: string }>,
    webhookUrl?: string
  ) => {
    setIsLoading(true)
    setError(null)
    setIdeas([])

    try {
      const url = webhookUrl || import.meta.env.VITE_EPL_IDEA_GENERATION_WEBHOOK_URL
      if (!url) {
        throw new Error('Webhook URL not configured')
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000)

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, language, topics: selectedTopics }),
        signal: controller.signal,
        mode: 'cors',
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as any
      console.log('Response data:', data)

      if (data?.success && data?.ideas && Array.isArray(data.ideas)) {
        const limitedIdeas = data.ideas.map((idea: any) => ({
          ...idea,
          headline: idea.headline.slice(0, 35),
          subtitle: idea.subtitle.slice(0, 70),
          caption: idea.caption.slice(0, 600),
        }))
        setIdeas(limitedIdeas)

        // Extract unique player/club combos and fetch all photos at once
        console.log('Ideas for bulk search:', limitedIdeas)
        const uniqueKeywords = new Set(
          limitedIdeas.map((idea: any) => JSON.stringify({ player: idea.player, club: idea.club || '' }))
        )
        const keywords: Array<{ player: string; club: string }> = Array.from(uniqueKeywords).map(
          (str: unknown) => JSON.parse(str as string) as { player: string; club: string }
        )
        console.log('Keywords for bulk search:', keywords)

        await bulkSearchPhotos(keywords)
      } else {
        console.error('Invalid response structure:', data)
        throw new Error(`Invalid response: ${JSON.stringify(data).slice(0, 100)}`)
      }
    } catch (err) {
      setError(err instanceof Error ? (err.name === 'AbortError' ? 'Request timed out' : err.message) : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const refresh = async (
    brand: string,
    language: string,
    selectedTopics: Array<TrendingTopic & { post_type: string }>,
    webhookUrl?: string
  ) => {
    return generate(brand, language, selectedTopics, webhookUrl)
  }

  const render = async (selectedIdeas: EngagementIdea[], brandLogoUrl: string) => {
    setIsRendering(true)
    setError(null)

    try {
      const webhookUrl = import.meta.env.VITE_RENDER_POST_WEBHOOK_URL
      if (!webhookUrl) {
        throw new Error('Render webhook URL not configured')
      }

      // Render each idea sequentially
      const renderedIdeas = await Promise.all(
        selectedIdeas.map(async (idea) => {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              template_id: '19b9914f-3275-4bec-8cba-da941cdd66c4',
              headline: idea.headline,
              subtitle: idea.subtitle,
              photo_url: idea.photo_url,
              brand_logo_url: brandLogoUrl,
            }),
            signal: controller.signal,
            mode: 'no-cors',
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const data = (await response.json()) as { success: boolean; image_url: string }
          return { ...idea, image_url: data.image_url }
        })
      )

      setIdeas(renderedIdeas)
    } catch (err) {
      setError(err instanceof Error ? (err.name === 'AbortError' ? 'Request timed out' : err.message) : 'Unknown error')
    } finally {
      setIsRendering(false)
    }
  }

  return { ideas, setIdeas, isLoading, isRendering, error, generate, refresh, render, photosByPlayerClub, topics, isFetchingTopics, fetchTrendingTopics }
}
