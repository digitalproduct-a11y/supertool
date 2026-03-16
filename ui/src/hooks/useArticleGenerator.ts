import { useState } from 'react'
import type {
  ArticleState,
  ArticleGeneratorState,
  ArticleContext,
  ContentAngle,
  ProductSummary,
  ArticleResponse,
  ArticleError,
} from '../types'

export function useArticleGenerator() {
  const [state, setState] = useState<ArticleState>('idle')
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [angles, setAngles] = useState<ContentAngle[]>([])
  const [context, setContext] = useState<ArticleContext | null>(null)
  const [articleHtml, setArticleHtml] = useState('')
  const [articleTitle, setArticleTitle] = useState('')
  const [thumbnailPrompt, setThumbnailPrompt] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const webhookUrl = import.meta.env.VITE_ARTICLE_WEBHOOK_URL

  const handleError = (message: string) => {
    setErrorMessage(message)
    setState('error')
  }

  const makeRequest = async (step: string, payload: any) => {
    if (!webhookUrl) {
      handleError('VITE_ARTICLE_WEBHOOK_URL is not configured.')
      return null
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 180_000) // 3 min

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, ...payload }),
        signal: controller.signal,
      })

      const data: ArticleResponse = await response.json()
      return data
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        handleError('Request timed out. The workflow may still be running — please try again.')
      } else {
        handleError('Network error. Please check your connection and try again.')
      }
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  const processProducts = async (brand: string, shopeeLinks: string[]) => {
    if (!brand.trim() || shopeeLinks.length === 0) {
      handleError('Please provide a brand and at least one Shopee link.')
      return
    }

    setState('processing_products')
    setErrorMessage('')

    const data = await makeRequest('process_products', {
      brand: brand.trim(),
      shopee_links: shopeeLinks.map((l) => l.trim()).filter(Boolean),
    })

    if (!data || !data.success) {
      handleError((data as ArticleError)?.message || 'Failed to process products.')
      return
    }

    const result = data as any
    setProducts(result.products)
    setAngles(result.angles)
    setContext(result.context)
    setState('angle_selection')
  }

  const generateArticle = async (selectedAngle: string) => {
    if (!context) {
      handleError('Missing context. Please start over.')
      return
    }

    setState('generating_article')
    setErrorMessage('')

    const data = await makeRequest('generate_article', {
      context,
      selected_angle: selectedAngle,
    })

    if (!data || !data.success) {
      handleError((data as ArticleError)?.message || 'Failed to generate article.')
      return
    }

    const result = data as any
    setArticleHtml(result.article_html)
    setArticleTitle(result.article_title)
    setContext(result.context)
    setState('review_draft')
  }

  const reviseArticle = async (feedback: string) => {
    if (!context) {
      handleError('Missing context.')
      return
    }

    setState('revising_article')
    setErrorMessage('')

    const data = await makeRequest('revise_article', {
      context,
      article_html: articleHtml,
      article_title: articleTitle,
      feedback: feedback.trim(),
    })

    if (!data || !data.success) {
      handleError((data as ArticleError)?.message || 'Failed to revise article.')
      return
    }

    const result = data as any
    setArticleHtml(result.article_html)
    setArticleTitle(result.article_title)
    setState('review_draft')
  }

  const prepareThumbnail = async () => {
    if (!context) {
      handleError('Missing context.')
      return
    }

    setState('thumbnail_prompt')
    setErrorMessage('')

    const data = await makeRequest('prepare_thumbnail', { context })

    if (!data || !data.success) {
      handleError((data as ArticleError)?.message || 'Failed to prepare thumbnail.')
      return
    }

    const result = data as any
    setThumbnailPrompt(result.prompt)
    setContext(result.context)
  }

  const generateThumbnail = async (prompt: string) => {
    setState('generating_thumbnail')
    setErrorMessage('')

    const data = await makeRequest('generate_thumbnail', { prompt: prompt.trim() })

    if (!data || !data.success) {
      handleError((data as ArticleError)?.message || 'Failed to generate thumbnail.')
      return
    }

    const result = data as any
    setThumbnailUrl(result.thumbnail_url)
    setState('thumbnail_result')
  }

  const reviseThumbnail = async (feedback: string) => {
    if (!context) {
      handleError('Missing context.')
      return
    }

    setState('revising_thumbnail')
    setErrorMessage('')

    const data = await makeRequest('revise_thumbnail', {
      context,
      feedback: feedback.trim(),
    })

    if (!data || !data.success) {
      handleError((data as ArticleError)?.message || 'Failed to revise thumbnail.')
      return
    }

    const result = data as any
    setThumbnailUrl(result.thumbnail_url)
    setThumbnailPrompt(result.prompt)
    setState('thumbnail_result')
  }

  const skipThumbnail = () => {
    setState('done')
  }

  const finish = () => {
    setState('done')
  }

  const reset = () => {
    setState('idle')
    setProducts([])
    setAngles([])
    setContext(null)
    setArticleHtml('')
    setArticleTitle('')
    setThumbnailPrompt('')
    setThumbnailUrl('')
    setErrorMessage('')
  }

  const isLoading =
    state === 'processing_products' ||
    state === 'generating_article' ||
    state === 'revising_article' ||
    state === 'generating_thumbnail' ||
    state === 'revising_thumbnail'

  return {
    state,
    products,
    angles,
    context,
    articleHtml,
    articleTitle,
    thumbnailPrompt,
    thumbnailUrl,
    errorMessage,
    processProducts,
    generateArticle,
    reviseArticle,
    prepareThumbnail,
    generateThumbnail,
    reviseThumbnail,
    skipThumbnail,
    finish,
    reset,
    isLoading,
  }
}
