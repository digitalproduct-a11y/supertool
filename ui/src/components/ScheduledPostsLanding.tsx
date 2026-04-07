import { useNavigate } from 'react-router-dom'
import { BRANDS } from '../constants/brands'

interface ScheduledPostsLandingProps {
  onSelectBrand?: (brand: string) => void
}

export function ScheduledPostsLanding({ onSelectBrand }: ScheduledPostsLandingProps) {
  const navigate = useNavigate()

  const handleBrandSelect = (brand: string) => {
    onSelectBrand?.(brand)
    const slug = brand.toLowerCase().replace(/\s+/g, '-')
    navigate(`/scheduled-posts/${slug}`)
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
            Schedule Trending News
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            View trending news from the last 24 hours. Refreshed daily at 10:00 AM
          </p>
          {/* KULT gradient stripe — animated grow */}
          <div
            className="mt-6 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Brands Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {BRANDS.map((brand) => (
            <button
              key={brand}
              onClick={() => handleBrandSelect(brand)}
              className="glass-card rounded-xl overflow-hidden hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015] transition-all duration-200 text-left group p-5 min-h-[104px] flex flex-col justify-between"
            >
              <div>
                <h2 className="font-display text-base font-semibold text-neutral-950 mb-2">{brand}</h2>
              </div>
              <div className="flex justify-end text-neutral-300 group-hover:text-neutral-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
