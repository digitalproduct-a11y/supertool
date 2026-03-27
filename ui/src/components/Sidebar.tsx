import { useState } from 'react'
import type React from 'react'
import {
  IconHome,
  IconPhoto,
  IconTrendingUp,
  IconLink,
  IconFileText,
  IconLayoutSidebar,
  IconHeart,
  IconStack2,
  IconActivity,
  IconBrain,
} from '@tabler/icons-react'

type ToolId = 'home' | 'fb-post' | 'trending-news' | 'affiliate-links' | 'article-generator'

interface NavItem {
  id: ToolId | string
  label: string
  icon: React.ComponentType<{ className?: string }>
  comingSoon?: boolean
}

interface SidebarProps {
  activeTool?: ToolId
  onToolChange?: (id: ToolId) => void
  isCollapsed: boolean
  onCollapsedChange: (v: boolean) => void
}

const navSections: { section: string | null; items: NavItem[] }[] = [
  {
    section: null,
    items: [{ id: 'home', label: 'Home', icon: IconHome }],
  },
  {
    section: 'FB Photo Templates',
    items: [
      { id: 'fb-post', label: 'Article to FB Photos', icon: IconPhoto },
      { id: 'trending-news', label: 'Trending News to FB Photos', icon: IconTrendingUp },
      { id: 'engagement-photos', label: 'Engagement Photos Generator', icon: IconHeart, comingSoon: true },
      { id: 'photo-carousels', label: 'Article to Photo Carousels', icon: IconStack2, comingSoon: true },
    ],
  },
  {
    section: 'Affiliate',
    items: [
      { id: 'affiliate-links', label: 'Shopee Affiliate Links', icon: IconLink },
      { id: 'article-generator', label: 'Affiliate Article Editor', icon: IconFileText },
    ],
  },
  {
    section: 'Brand Intelligence',
    items: [
      { id: 'brand-health', label: 'Brand Health Check', icon: IconActivity, comingSoon: true },
      { id: 'idea-agent', label: 'Idea Agent', icon: IconBrain, comingSoon: true },
    ],
  },
]

const floatingBtnClass = 'fixed top-4 left-4 z-50 p-2 rounded-lg bg-zinc-900 text-neutral-500 hover:text-neutral-200 hover:bg-white/8 transition-all duration-300'

export function Sidebar({ activeTool = 'home', onToolChange, isCollapsed, onCollapsedChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = () => { setIsOpen(true); onCollapsedChange(false) }
  const handleClose = () => { setIsOpen(false); onCollapsedChange(true) }

  const handleToolClick = (toolId: ToolId) => {
    onToolChange?.(toolId)
    setIsOpen(false)
  }


  const handleFeedback = () => {
    const toolNames: Record<ToolId, string> = {
      home: 'KULT Digital Kit',
      'fb-post': 'Article to FB Photos',
      'trending-news': 'Trending News to FB Photos',
      'affiliate-links': 'Shopee Affiliate Links',
      'article-generator': 'Affiliate Article Editor',
    }
    const toolName = toolNames[activeTool ?? 'home']
    const subject = encodeURIComponent(`Feedback: ${toolName}`)
    const body = encodeURIComponent(`Hi team, I have some feedback about the tool ${toolName}.\n\n[Insert your feedback here]`)
    window.location.href = `mailto:digitalproduct@astro.com.my?subject=${subject}&body=${body}`
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating reopen button — mobile: shows when sidebar is closed */}
      <button
        onClick={handleOpen}
        aria-label="Open navigation"
        className={`md:hidden ${floatingBtnClass} ${!isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <IconLayoutSidebar className="w-5 h-5" />
      </button>

      {/* Floating reopen button — desktop: shows when collapsed */}
      <button
        onClick={handleOpen}
        aria-label="Open navigation"
        className={`hidden md:flex ${floatingBtnClass} ${isCollapsed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <IconLayoutSidebar className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <aside
        aria-label="Main navigation"
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed left-0 top-0 h-screen bg-zinc-900 z-40 flex flex-col overflow-hidden
        transition-transform duration-300 md:transition-[width] md:duration-300 w-60 ${isCollapsed ? 'md:w-0' : 'md:w-60'}`}
      >
        {/* Inner wrapper — fixed width so content doesn't reflow during transition */}
        <div className="w-60 flex flex-col h-full">
          {/* Header */}
          <div className="px-5 py-6 flex items-center justify-between">
            <button
              onClick={() => handleToolClick('home')}
              className="text-[15px] font-semibold text-white tracking-tight hover:text-white/80 transition-colors"
            >
              KULT Digital Kit
            </button>
            <button
              onClick={handleClose}
              aria-label="Collapse sidebar"
              className="flex items-center justify-center w-7 h-7 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/8 transition-colors"
            >
              <IconLayoutSidebar className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {navSections.map((group, i) => (
              <div key={i} className={i > 0 ? 'mt-4' : ''}>
                {group.section && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                    {group.section}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((tool) => {
                    const Icon = tool.icon
                    if (tool.comingSoon) {
                      return (
                        <div
                          key={tool.label}
                          className="px-3 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2.5 text-neutral-500 cursor-default"
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">{tool.label}</span>
                          <span className="text-[10px] font-semibold text-yellow-600/80 bg-yellow-500/10 rounded px-1.5 py-0.5">Soon</span>
                        </div>
                      )
                    }
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleToolClick(tool.id as ToolId)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2.5 ${
                          activeTool === tool.id
                            ? 'bg-white/15 text-white'
                            : 'text-neutral-300 hover:bg-white/8 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {tool.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-3 pb-4 pt-3 space-y-0.5">
            <button
              onClick={handleFeedback}
              className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium text-neutral-300 hover:bg-white/8 hover:text-white transition-colors flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send feedback
            </button>
          <p className="px-3 pt-2 text-[11px] text-neutral-400">
            Made with ♥ by Digital team
          </p>
          </div>
        </div>
      </aside>
    </>
  )
}
