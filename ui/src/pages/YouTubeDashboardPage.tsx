import { BackButton } from '../components/ds'

export function YouTubeDashboardPage() {
  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <BackButton />
              <div>
                <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                  YouTube Performance & Revenue Dashboard
                </h1>
                <p className="text-neutral-500 mt-1 text-sm">
                  Track watch hours, videos published and revenue across all brand channels
                </p>
              </div>
            </div>
          </div>
          <div
            className="mt-3 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF0000, #FF3FBF, #00E5D4, #0055EE)' }}
          />
        </div>

        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-950 mb-2">Coming Soon</h2>
          <p className="text-neutral-500 text-sm max-w-md">
            The YouTube Performance & Revenue Dashboard is currently being built. Check back soon for analytics across all brand channels.
          </p>
        </div>
      </div>
    </main>
  )
}
