import { useState } from 'react'
import type {
  ArticleIntakeResponse,
  ArticleGenerateResponse,
  ThumbnailPromptResponse,
  ThumbnailGenerateResponse,
} from '../types'

const INTAKE_WEBHOOK_URL = import.meta.env.VITE_ARTICLE_INTAKE_WEBHOOK_URL as string
const GENERATE_WEBHOOK_URL = import.meta.env.VITE_ARTICLE_GENERATE_WEBHOOK_URL as string
const THUMBNAIL_PROMPT_WEBHOOK_URL = import.meta.env.VITE_ARTICLE_THUMBNAIL_PROMPT_WEBHOOK_URL as string
const THUMBNAIL_GENERATE_WEBHOOK_URL = import.meta.env.VITE_ARTICLE_THUMBNAIL_GENERATE_WEBHOOK_URL as string

export function useArticleGenerator() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callWebhook = async <T>(
    url: string,
    body: Record<string, unknown>,
    timeout = 180000,
  ): Promise<T | null> => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      })

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`)
      }

      const data = await response.json()
      // n8n Respond to Webhook returns an array — unwrap first item
      return (Array.isArray(data) ? data[0] : data) as T
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      return null
    }
  }

  const intake = async (brand: string, links: string[]): Promise<ArticleIntakeResponse | null> => {
    setIsLoading(true)
    setError(null)
    try {
      return await callWebhook<ArticleIntakeResponse>(INTAKE_WEBHOOK_URL, { brand, links })
    } finally {
      setIsLoading(false)
    }
  }

  const generate = async (body: Record<string, unknown>): Promise<ArticleGenerateResponse | null> => {
    setIsLoading(true)
    setError(null)
    try {
      return await callWebhook<ArticleGenerateResponse>(GENERATE_WEBHOOK_URL, body)
    } finally {
      setIsLoading(false)
    }
  }

  const thumbnailPrompt = async (
    body: Record<string, unknown>,
  ): Promise<ThumbnailPromptResponse | null> => {
    setIsLoading(true)
    setError(null)
    try {
      return await callWebhook<ThumbnailPromptResponse>(THUMBNAIL_PROMPT_WEBHOOK_URL, body)
    } finally {
      setIsLoading(false)
    }
  }

  const thumbnailGenerate = async (
    body: Record<string, unknown>,
  ): Promise<ThumbnailGenerateResponse | null> => {
    setIsLoading(true)
    setError(null)
    try {
      return await callWebhook<ThumbnailGenerateResponse>(THUMBNAIL_GENERATE_WEBHOOK_URL, body)
    } finally {
      setIsLoading(false)
    }
  }

  return { intake, generate, thumbnailPrompt, thumbnailGenerate, isLoading, error }
}
