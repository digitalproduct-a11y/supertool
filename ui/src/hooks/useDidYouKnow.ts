import { useState } from 'react'

export interface DidYouKnowIdea {
  id: string
  headline: string
  fact: string
  caption: string
}

export function useDidYouKnow() {
  const [ideas, setIdeas] = useState<DidYouKnowIdea[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIdeas = async (brand: string, context: string, webhookUrl: string) => {
    setIsLoading(true)
    setError(null)
    setIdeas([])

    try {
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured')
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120 * 1000)

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, context }),
        signal: controller.signal,
        mode: 'cors',
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as any
      if (data?.success && data?.ideas && Array.isArray(data.ideas)) {
        const limitedIdeas = data.ideas.map((idea: any) => ({
          id: idea.id,
          headline: (idea.headline || '').slice(0, 35),
          fact: (idea.fact || '').slice(0, 70),
          caption: (idea.caption || '').slice(0, 300),
        }))
        setIdeas(limitedIdeas)
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

  return { ideas, isLoading, error, fetchIdeas }
}
