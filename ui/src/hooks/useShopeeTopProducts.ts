import { useState, useCallback, useEffect } from 'react'

const READ_URL = import.meta.env.VITE_SHOPEE_TOP_PRODUCTS_READ_URL as string

export interface ShopeeTopProduct {
  tiktokKeyword: string      // TikTok product name (e.g. "Perfume")
  tiktokCategory: string     // Full category path (e.g. "Beauty & Personal Care/Makeup & Perfume")
  tiktokPopularity: string   // e.g. "3K"
  productName: string
  imageUrl: string
  price: number
  sales: number
  rating: number
  shopName: string
  shopType?: string
  productUrl: string         // shopee.com.my URL
  fetchedAt: string          // ISO timestamp
}

interface UseShopeeTopProductsResult {
  products: ShopeeTopProduct[]
  lastRefreshed: string | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useShopeeTopProducts(): UseShopeeTopProductsResult {
  const [products, setProducts] = useState<ShopeeTopProduct[]>([])
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!READ_URL) {
      setError('Shopee Top Products read URL is not configured.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(READ_URL, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`Failed to fetch products (${res.status})`)
      const data = await res.json()
      setProducts(Array.isArray(data.products) ? data.products : [])
      setLastRefreshed(data.lastRefreshed ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products.')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refetch() }, [refetch])

  return { products, lastRefreshed, loading, error, refetch }
}
