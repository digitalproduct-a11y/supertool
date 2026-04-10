import { useState, useMemo, useEffect } from 'react'
import { IconShoppingCart, IconExternalLink, IconRefresh, IconStar } from '@tabler/icons-react'
import { BRANDS, type BrandName } from '../constants/brands'
import { GuideModal } from './ds/GuideModal'
import { Spinner } from './ds/Spinner'
import { useShopeeTopProducts, type ShopeeTopProduct } from '../hooks/useShopeeTopProducts'

function formatPrice(price: number): string {
  if (!price) return '—'
  return `RM ${price.toFixed(2)}`
}

function formatLastRefreshed(iso: string | null): string {
  if (!iso) return 'Not yet refreshed'
  const d = new Date(iso)
  return d.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })
}

function ShopTypeBadge({ label }: { label?: string }) {
  if (!label || label === 'Normal') return null
  const isMall = label === 'Mall'
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${isMall ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
      {label}
    </span>
  )
}

export function ShopeeTopProductsPage() {
  const { products, lastRefreshed, loading, error, refetch } = useShopeeTopProducts()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedBrand, setSelectedBrand] = useState<BrandName>(BRANDS[0])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showComingSoonModal, setShowComingSoonModal] = useState(false)

  useEffect(() => {
    if (!lightboxUrl) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxUrl])

  // Group products by tiktokKeyword
  const grouped = useMemo(() => {
    const map = new Map<string, ShopeeTopProduct[]>()
    for (const p of products) {
      const key = p.tiktokKeyword
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [products])

  function toggleProduct(url: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  function toggleGroup(keyword: string) {
    const groupUrls = (grouped.get(keyword) ?? []).map(p => p.productUrl)
    const allSelected = groupUrls.every(url => selected.has(url))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) groupUrls.forEach(url => next.delete(url))
      else groupUrls.forEach(url => next.add(url))
      return next
    })
  }


  return (
    <>
      {showComingSoonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-950 mb-1">Feature Coming Soon!</h3>
              <p className="text-sm text-neutral-500">Affiliate link generation will be available soon. Check back later.</p>
            </div>
            <button
              onClick={() => setShowComingSoonModal(false)}
              className="w-full py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-28">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Shopee Top Products</h1>
              <p className="text-neutral-500 mt-1 text-sm">
                Top-selling Shopee products sourced from TikTok trending keywords — refreshed daily at 8am.
                {lastRefreshed && (
                  <span className="ml-2 text-neutral-400">Last refreshed: {formatLastRefreshed(lastRefreshed)}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => refetch()}
                disabled={loading}
                className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-50"
                title="Refresh product list"
              >
                <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <GuideModal title="How to use Shopee Top Products">
                <ol className="space-y-3 list-decimal list-inside text-sm text-neutral-700">
                  <li><strong>Browse the table</strong> — Products are grouped by TikTok trending keyword. The table refreshes daily at 8am with the latest top-selling items from Shopee.</li>
                  <li><strong>Select products</strong> — Tick the checkbox next to products you want to generate affiliate links for. You can select individual products or check the keyword header to select the whole group.</li>
                  <li><strong>Pick a brand</strong> — Choose which brand's affiliate account to use for link generation.</li>
                  <li><strong>Custom image (optional)</strong> — Upload a custom image to include in the generated output.</li>
                  <li><strong>Click Generate</strong> — An Excel file with affiliate-tagged product data will download automatically.</li>
                </ol>
                <div className="mt-4 p-3 bg-neutral-100 border border-neutral-300 rounded-lg">
                  <p className="text-xs font-semibold text-neutral-800 mb-1">💡 Tip</p>
                  <p className="text-xs text-neutral-700">Keywords come from TikTok's top products category paths — e.g. "Makeup &amp; Perfume" from "Beauty &amp; Personal Care/Makeup &amp; Perfume". This gives more specific Shopee results than broad terms.</p>
                </div>
              </GuideModal>
            </div>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner />
            <p className="text-sm text-neutral-500">Loading today's top products…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-neutral-400">
            <IconShoppingCart size={40} strokeWidth={1.5} />
            <p className="text-sm">No products yet — check back after 8am or click Refresh.</p>
          </div>
        )}

        {/* Product table grouped by keyword */}
        {!loading && products.length > 0 && (
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([keyword, items]) => {
              const groupUrls = items.map(p => p.productUrl)
              const allSelected = groupUrls.every(url => selected.has(url))
              const someSelected = groupUrls.some(url => selected.has(url))
              return (
                <div key={keyword}>
                  {/* Group header */}
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                      onChange={() => toggleGroup(keyword)}
                      className="w-4 h-4 rounded accent-neutral-950 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-neutral-950 text-sm">{keyword}</span>
                      <span className="ml-2 text-xs text-neutral-400">{items[0].tiktokCategory}</span>
                    </div>
                    <span className="ml-auto text-xs text-neutral-400">{items.length} products</span>
                  </div>

                  {/* Table */}
                  <div className="rounded-xl border border-neutral-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 border-b border-neutral-200">
                        <tr>
                          <th className="w-10 px-4 py-3" />
                          <th className="w-14 px-4 py-3" />
                          <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Product</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide">Price</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide">Sales</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide">Rating</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide">Comm</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Shop</th>
                          <th className="w-10 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {items.map((product) => {
                          const isSelected = selected.has(product.productUrl)
                          return (
                            <tr
                              key={product.productUrl}
                              className={`transition-colors cursor-pointer ${isSelected ? 'bg-neutral-50' : 'hover:bg-neutral-50/60'}`}
                              onClick={() => toggleProduct(product.productUrl)}
                            >
                              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleProduct(product.productUrl)}
                                  className="w-4 h-4 rounded accent-neutral-950 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                <div
                                  className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 shrink-0 cursor-zoom-in"
                                  onClick={() => product.imageUrl && setLightboxUrl(product.imageUrl)}
                                >
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-3 max-w-[280px]">
                                <p className="font-medium text-neutral-900 leading-snug line-clamp-2">{product.productName}</p>
                              </td>
                              <td className="px-4 py-3 text-right text-neutral-700 whitespace-nowrap">{formatPrice(product.price)}</td>
                              <td className="px-4 py-3 text-right text-neutral-700 whitespace-nowrap">{product.sales.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-neutral-700">
                                  <IconStar size={12} className="text-yellow-400 fill-yellow-400" />
                                  {product.rating.toFixed(1)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {product.commissionRate != null ? (
                                  <span className="text-green-600 font-medium">{product.commissionRate.toFixed(1)}%</span>
                                ) : (
                                  <span className="text-neutral-300">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-neutral-700 truncate max-w-[140px]">{product.shopName}</p>
                                {product.shopTypeLabel && (
                                  <ShopTypeBadge label={product.shopTypeLabel} />
                                )}
                              </td>
                              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                <a
                                  href={product.productUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-neutral-400 hover:text-neutral-700 transition-colors"
                                  title="Open in Shopee"
                                >
                                  <IconExternalLink size={16} />
                                </a>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sticky generate bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center gap-4">
            <p className="text-sm text-neutral-600">
              <span className="font-semibold text-neutral-950">{selected.size}</span> product{selected.size > 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center gap-3 ml-auto flex-wrap justify-end">
              {/* Brand selector */}
              <div className="relative">
                <select
                  value={selectedBrand}
                  onChange={e => setSelectedBrand(e.target.value as BrandName)}
                  className="px-3 py-2 pr-8 border border-neutral-200 rounded-lg text-sm bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  {BRANDS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <button
                onClick={() => setShowComingSoonModal(true)}
                className="px-5 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-sm font-semibold transition active:scale-[0.98]"
              >
                Generate Affiliate Links
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </main>
    </>
  )
}
