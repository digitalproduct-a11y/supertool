import { IconFlame, IconTrophy, IconWorld, IconMusicStar } from '@tabler/icons-react'
import type React from 'react'

type ActiveTopicId = 'engagement-photos' | 'ucl'

interface EngagementPostsLandingProps {
  onSelectTopic: (id: ActiveTopicId) => void
}

interface Topic {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  comingSoon?: boolean
}

interface Section {
  label: string
  description: string
  topics: Topic[]
}

const sections: Section[] = [
  {
    label: 'Sports',
    description: 'Create engaging posts across different sports leagues and tournaments.',
    topics: [
      {
        id: 'engagement-photos',
        label: 'English Premier League',
        description: 'Create engaging football posts featuring Premier League players and debates',
        icon: IconFlame,
        color: '#FF3FBF',
      },
      {
        id: 'ucl',
        label: 'Champions League',
        description: 'European football highlights and player comparisons',
        icon: IconTrophy,
        color: '#0055EE',
      },
      {
        id: 'worldcup',
        label: 'International Football',
        description: 'World Cup and international tournament content',
        icon: IconWorld,
        color: '#00E5D4',
        comingSoon: true,
      },
      {
        id: 'coming-soon-3',
        label: 'Badminton',
        description: 'Badminton tournament highlights and player features',
        icon: IconFlame,
        color: '#F05A35',
        comingSoon: true,
      },
    ],
  },
  {
    label: 'Entertainment',
    description: 'Create engaging content for entertainment and lifestyle.',
    topics: [
      {
        id: 'coming-soon-4',
        label: 'Celebrity News',
        description: 'Entertainment industry updates and celebrity features',
        icon: IconMusicStar,
        color: '#FF3FBF',
        comingSoon: true,
      },
    ],
  },
]

export function EngagementPostsLanding({ onSelectTopic }: EngagementPostsLandingProps) {
  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto">

        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
            Engagement Posts
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Create captivating social media content across different topics and industries.
          </p>
          {/* KULT gradient stripe — animated grow */}
          <div
            className="mt-6 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section) => {
            return (
              <div key={section.label}>
                {/* Section header */}
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
                    {section.label}
                  </p>
                  {section.description && (
                    <p className="text-sm text-neutral-500 mt-0.5">{section.description}</p>
                  )}
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {section.topics.map((topic) => {
                    const Icon = topic.icon

                    if (topic.comingSoon) {
                      return (
                        <div
                          key={topic.label}
                          className="glass-card rounded-xl overflow-hidden cursor-default opacity-60"
                        >
                          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                            <Icon className="w-8 h-8 opacity-25" style={{ color: topic.color }} />
                            <span className="text-[10px] font-semibold text-yellow-700 bg-yellow-100/80 rounded px-2 py-0.5">
                              Soon
                            </span>
                          </div>
                          <div className="p-5">
                            <h2 className="font-display text-base font-semibold text-neutral-400">{topic.label}</h2>
                            <p className="text-xs text-neutral-300 mt-1">{topic.description}</p>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={topic.label}
                        onClick={() => onSelectTopic(topic.id as ActiveTopicId)}
                        className="glass-card rounded-xl overflow-hidden hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015] transition-all duration-200 text-left group"
                      >
                        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                          <Icon className="w-9 h-9" style={{ color: topic.color }} />
                          <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                        <div className="p-5">
                          <h2 className="font-display text-base font-semibold text-neutral-950">{topic.label}</h2>
                          <p className="text-xs text-neutral-500 mt-1">{topic.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
