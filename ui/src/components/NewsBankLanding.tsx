import { useNavigate } from 'react-router-dom'

const BRANDS = [
  'Astro Awani',
  'Astro Ulagam',
  'Era',
  'Era Sabah',
  'Era Sarawak',
  'Gegar',
  'Gempak',
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
  'Stadium Astro',
  'XUAN',
  'Zayan',
].sort()

export function brandToSlug(brand: string): string {
  return brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function slugToBrand(slug: string): string {
  return BRANDS.find(b => brandToSlug(b) === slug) ?? slug
}

export function NewsBankLanding() {
  const navigate = useNavigate()

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto">

        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
            News Bank
          </h1>
          <p className="text-neutral-500 mt-3 text-sm max-w-xs">
            Select a brand to browse latest breaking news and trending articles
          </p>
          <div
            className="mt-6 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Brands grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BRANDS.map((brand) => (
            <button
              key={brand}
              onClick={() => navigate(`/news-bank/${brandToSlug(brand)}`)}
              className="glass-card rounded-xl px-4 py-6 transition-all duration-200 text-left group flex items-center gap-3 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015]"
            >
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-sm font-semibold text-neutral-950">{brand}</h2>
              </div>
              <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
