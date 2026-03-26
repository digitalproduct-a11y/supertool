import type React from 'react'
import {
  IconPhoto,
  IconTrendingUp,
  IconHeart,
  IconStack2,
  IconLink,
  IconFileText,
} from '@tabler/icons-react'

type ToolId = 'home' | 'fb-post' | 'trending-news' | 'affiliate-links' | 'article-generator'

interface Tool {
  id: ToolId
  label: string
  description: string
  color: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  comingSoon?: boolean
}

interface Section {
  label: string
  description: string
  tools: Tool[]
}

const sections: Section[] = [
  {
    label: 'Facebook Photo Templates',
    description: 'Turn articles and trends into ready-to-post Facebook visuals.',
    tools: [
      {
        id: 'fb-post',
        label: 'Article to FB Photos',
        description: 'Turn any article into a Facebook image and caption',
        color: '#0055EE',
        icon: IconPhoto,
      },
      {
        id: 'trending-news',
        label: 'Trending News to FB Photos',
        description: 'Turn trending news into Facebook-ready visuals',
        color: '#0055EE',
        icon: IconTrendingUp,
      },
      {
        id: 'fb-post',
        label: 'Engagement Photos Generator',
        description: 'Create engagement-driving photo posts',
        color: '#0055EE',
        icon: IconHeart,
        comingSoon: true,
      },
      {
        id: 'fb-post',
        label: 'Article to Photo Carousels',
        description: 'Transform articles into swipeable photo carousels',
        color: '#0055EE',
        icon: IconStack2,
        comingSoon: true,
      },
    ],
  },
  {
    label: 'Affiliate',
    description: 'Earn extra revenue by creating affiliate content faster.',
    tools: [
      {
        id: 'affiliate-links',
        label: 'Shopee Affiliate Links',
        description: 'Upload a file to generate Shopee affiliate links',
        color: '#F05A35',
        icon: IconLink,
      },
      {
        id: 'article-generator',
        label: 'Affiliate Article Generator',
        description: 'Write engaging Shopee product articles from links',
        color: '#F05A35',
        icon: IconFileText,
      },
    ],
  },
]

interface HomePageProps {
  onToolSelect: (id: ToolId) => void
}

export function HomePage({ onToolSelect }: HomePageProps) {
  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-5xl mx-auto">

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-neutral-950 tracking-tight leading-tight">
            Built to help you create faster.
          </h1>
          <p className="text-neutral-500 mt-3 text-sm max-w-md">
            Tools for content editors and social media managers. Generate posts, captions, and affiliate content in seconds.
          </p>
          {/* KULT gradient stripe */}
          <div
            className="mt-6 h-[3px] w-24 rounded-full"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section) => (
            <div key={section.label}>
              {/* Section header */}
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-600">
                  {section.label}
                </p>
                {section.description && (
                  <p className="text-sm text-neutral-500 mt-0.5">{section.description}</p>
                )}
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.tools.map((tool) => {
                  const Icon = tool.icon

                  if (tool.comingSoon) {
                    return (
                      <div
                        key={tool.label}
                        className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.06)] cursor-default"
                      >
                        {/* Icon */}
                        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                          <Icon className="w-8 h-8 opacity-25" style={{ color: tool.color }} />
                          <span className="text-[10px] font-semibold text-yellow-700 bg-yellow-100/80 rounded px-2 py-0.5">
                            Soon
                          </span>
                        </div>
                        {/* Body */}
                        <div className="p-5">
                          <h2 className="text-sm font-semibold text-neutral-400">{tool.label}</h2>
                          <p className="text-xs text-neutral-300 mt-1">{tool.description}</p>
                          <span className="inline-block mt-4 text-xs font-medium text-neutral-300">
                            Open →
                          </span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <button
                      key={tool.label}
                      onClick={() => onToolSelect(tool.id)}
                      className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.12)] hover:scale-[1.01] transition-all duration-200 text-left group"
                    >
                      {/* Icon */}
                      <div className="px-5 pt-5 pb-2">
                        <Icon className="w-9 h-9" style={{ color: tool.color }} />
                      </div>
                      {/* Body */}
                      <div className="p-5">
                        <h2 className="text-sm font-semibold text-neutral-950">{tool.label}</h2>
                        <p className="text-xs text-neutral-500 mt-1">{tool.description}</p>
                        <span className="inline-block mt-4 text-xs font-medium text-neutral-950 group-hover:translate-x-0.5 transition-transform">
                          Open →
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
