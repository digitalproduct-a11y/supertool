import { useState } from 'react'

export interface DidYouKnowIdea {
  id: string
  headline: string
  fact: string
  caption: string
}

export function useDidYouKnow() {
  const [ideas, setIdeas] = useState<DidYouKnowIdea[]>([])
  const [brandLogoPublicId, setBrandLogoPublicId] = useState<string | null>(null)
  const [language, setLanguage] = useState<string>('en')
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
      const timeoutId = setTimeout(() => controller.abort(), 180 * 1000)

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
          id: idea.id || `idea-${Math.random()}`,
          headline: (idea.headline || '').slice(0, 80),
          fact: (idea.fact || '').slice(0, 400),
          caption: (idea.caption || '').slice(0, 300),
        }))
        setIdeas(limitedIdeas)
        setBrandLogoPublicId(data.brandLogoPublicId || null)
        setLanguage(data.language || 'en')
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

  return { ideas, setIdeas, brandLogoPublicId, language, isLoading, error, fetchIdeas }
}
