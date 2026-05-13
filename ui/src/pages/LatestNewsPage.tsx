import { useBrand } from '../context/BrandContext'
import { LatestNewsTab } from '../components/LatestNewsTab'

export function LatestNewsPage() {
  const { selectedBrand } = useBrand()

  return (
    <main className="flex-1 pt-20 md:pt-10 flex flex-col min-h-0 overflow-hidden">

      {/* Header */}
      <div className="px-4 md:px-8 pb-4 shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Latest News</h1>
              <p className="text-neutral-500 mt-1 text-sm">Browse and generate posts from articles published in the last 24 hours</p>
            </div>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-t border-neutral-100">
        <LatestNewsTab brand={selectedBrand ?? ''} />
      </div>

    </main>
  )
}
