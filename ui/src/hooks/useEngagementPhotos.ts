import { useState } from 'react'
import type { EngagementIdea } from '../types'
import { TOPIC_CONFIGS } from '../constants/topics'

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

  const bulkSearchPhotos = async (keywords: Array<{ player: string; club: string }>, webhookUrlOverride?: string) => {
    try {
      const webhookUrl = webhookUrlOverride || import.meta.env.VITE_CLOUDINARY_SEARCH_WEBHOOK_URL
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
    webhookUrl?: string,
    topic?: string
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

      let data = (await response.json()) as any
      // Some webhooks wrap the response in an array (e.g. n8n Respond node).
      if (Array.isArray(data) && data.length > 0) {
        data = data[0]
      }

      // Handle both "ideas" format (EPL/UCL) and "posts" format (Badminton/MotoGP)
      const itemsArray = data?.ideas || data?.posts
      if (data?.success && itemsArray && Array.isArray(itemsArray)) {
        const limitedIdeas = itemsArray.map((item: any) => ({
          id: item.id,
          type: item.type || 'news',
          post_type: item.post_type,
          headline: (item.headline || '').slice(0, 50),
          subtitle: (item.subtitle || item.content || '').slice(0, 200),
          caption: (item.caption || '').slice(0, 550),
          player: item.player || '',
          club: item.club || undefined,
          photo_url: item.photo_url || null,
          photo_public_id: item.photo_public_id || null,
          status: item.status || 'draft' as const,
          context: item.context,
        }))
        setIdeas(limitedIdeas)

        // Fetch photos based on topic config
        const topicConfig = topic ? TOPIC_CONFIGS[topic] : null
        if (topicConfig?.photosWebhookEnvVar && topicConfig?.photosCacheKey) {
          // For badminton/motogp: fetch from topic-specific photos webhook
          const photosWebhookUrl = import.meta.env[topicConfig.photosWebhookEnvVar] as string | undefined
          await bulkSearchPhotos([{ player: topicConfig.photosCacheKey, club: '' }], photosWebhookUrl)
        } else {
          // For EPL/UCL: extract unique player/club combos and fetch all photos at once
          const uniqueKeywords = new Set(
            limitedIdeas.map((idea: any) => JSON.stringify({ player: idea.player || '', club: idea.club || '' }))
          )
          const keywords: Array<{ player: string; club: string }> = Array.from(uniqueKeywords).map(
            (str: unknown) => JSON.parse(str as string) as { player: string; club: string }
          )
          await bulkSearchPhotos(keywords)
        }
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
