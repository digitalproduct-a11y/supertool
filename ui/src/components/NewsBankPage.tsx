import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '@tabler/icons-react'
import { ScheduledPostsPage } from '../pages/ScheduledPostsPage'
import { LatestNewsTab } from './LatestNewsTab'
import { slugToBrand } from './NewsBankLanding'

type Tab = 'latest' | 'trending'

function NewsBankPage({ brand }: { brand: string }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('latest')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 md:px-8 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/news-bank')}
          className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
        >
          <IconChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-neutral-950">{brand}</h1>
          <p className="text-xs text-neutral-500">News Bank</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="bg-white border-b border-neutral-100 px-4 md:px-8">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('latest')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'latest'
                ? 'border-neutral-950 text-neutral-950'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            Latest News
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'trending'
                ? 'border-neutral-950 text-neutral-950'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            Trending
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'latest' ? (
          <LatestNewsTab brand={brand} />
        ) : (
          <ScheduledPostsPage brand={brand} embedded />
        )}
      </div>
    </div>
  )
}

export function NewsBankBrandPage() {
  const { brandSlug } = useParams<{ brandSlug: string }>()
  const brand = slugToBrand(brandSlug ?? '')
  return <NewsBankPage brand={brand} />
}
