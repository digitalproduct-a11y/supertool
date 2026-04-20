import { useNavigate } from 'react-router-dom'
import { RECOMMENDED_SOURCES } from './ScheduledPostsPage'
import { BRAND_LOGO_IDS } from '../constants/brands'
import type { BrandName } from '../constants/brands'

const BRANDS = [
  'Astro Ulagam',
  'Era',
  'Era Sabah',
  'Era Sarawak',
  'Gegar',
  'Goxuan',
  'Hitz',
  'Hotspot',
  'Lite',
  'Media Hiburan',
  'Melody',
  'Mingguan Wanita',
  'Mix',
  'MY',
  'Raaga',
  'Rojak Daily',
  'Sinar',
  'Zayan',
].sort()

export function ScheduledPostsLanding({ onSelectBrand }: { onSelectBrand: (brand: string) => void }) {
  const navigate = useNavigate()

  const DISABLED_BRANDS = new Set(['Raaga', 'Mix', 'Rojak Daily'])

  const handleBrandClick = (brand: string) => {
    if (DISABLED_BRANDS.has(brand)) return

    onSelectBrand(brand)
    navigate(`/scheduled-posts/${brand.toLowerCase().replace(/\s+/g, '-')}`)
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-5xl mx-auto">

        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
          Trending News
          </h1>
          <p className="text-neutral-500 mt-3 text-sm max-w-xs">
            View trending news from the last 24 hours. Refreshed daily at 10:00 AM
          </p>
          <div
            className="mt-6 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Brands grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BRANDS.map((brand) => {
            const isDisabled = DISABLED_BRANDS.has(brand)
            return (
              <button
                key={brand}
                onClick={() => handleBrandClick(brand)}
                disabled={isDisabled}
                className={`glass-card rounded-xl px-4 py-3 transition-all duration-200 text-left group flex items-center gap-3 ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015]'
                }`}
              >
                {/* Brand logo */}
                {BRAND_LOGO_IDS[brand as BrandName] && (
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center overflow-hidden">
                    <img
                      src={`https://res.cloudinary.com/dymmqtqyg/image/upload/w_80,h_80,c_contain,f_auto/${BRAND_LOGO_IDS[brand as BrandName]}`}
                      alt={brand}
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-sm font-semibold text-neutral-950">{brand}</h2>
                  {isDisabled ? (
                    <p className="text-xs text-neutral-400 mt-0.5">Templates coming soon</p>
                  ) : (RECOMMENDED_SOURCES[brand]?.length ?? 0) > 0 ? (
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {RECOMMENDED_SOURCES[brand].length} recommended news
                    </p>
                  ) : null}
                </div>
                {!isDisabled && (
                  <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
