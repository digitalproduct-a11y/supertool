import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '@tabler/icons-react'

interface ScheduledPostsPageProps {
  brand?: string
}

export function ScheduledPostsPage({ brand = '' }: ScheduledPostsPageProps) {
  const navigate = useNavigate()
  const brandName = brand ? decodeURIComponent(brand).replace(/-/g, ' ') : 'Unknown'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/scheduled-posts')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-neutral-950">Schedule Trending News: {brandName}</h1>
          </div>
          <p className="text-sm text-neutral-600">View and schedule trending news posts from {brandName}</p>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-neutral-500">Posts for {brandName} will appear here.</p>
          <p className="text-sm text-neutral-400 mt-2">Feature coming soon</p>
        </div>
      </div>
    </div>
  )
}
