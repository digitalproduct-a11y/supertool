import { useState } from 'react'

type ToolId = 'home' | 'fb-post' | 'affiliate-links' | 'article-generator' | 'trending-spike'

interface SidebarProps {
  activeTool?: ToolId
  onToolChange?: (id: ToolId) => void
}

export function Sidebar({ activeTool = 'home', onToolChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const tools = [
    { id: 'home' as const, label: 'Home' },
    { id: 'fb-post' as const, label: 'Article to FB Post' },
    { id: 'affiliate-links' as const, label: 'Shopee Affiliate Links' },
    { id: 'article-generator' as const, label: 'Article Generator' },
    { id: 'trending-spike' as const, label: 'Trending Spike to FB Post' },
  ]

  const handleToolClick = (toolId: ToolId) => {
    onToolChange?.(toolId)
    setIsOpen(false)
  }

  const handleFeedback = () => {
    const toolNames: Record<ToolId, string> = {
      home: 'Astro Tools',
      'fb-post': 'Article to FB Post',
      'affiliate-links': 'Shopee Affiliate Links',
      'article-generator': 'Shopee Article Generator',
      'trending-spike': 'Trending Spike to FB Post',
    }
    const toolName = toolNames[activeTool ?? 'home']
    const subject = encodeURIComponent(`Feedback: ${toolName}`)
    const body = encodeURIComponent(`Hi team, I have some feedback about the tool ${toolName}.\n\n[Insert your feedback here]`)
    window.location.href = `mailto:digitalproduct@astro.com.my?subject=${subject}&body=${body}`
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isOpen}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Main navigation"
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:sticky left-0 top-0 h-screen md:h-screen w-60 bg-neutral-950 transition-transform duration-200 z-40 md:z-0 flex flex-col`}
      >
        {/* Header */}
        <div className="px-5 py-6 border-b border-white/8">
          <button
            onClick={() => handleToolClick('home')}
            className="text-[15px] font-semibold text-white tracking-tight hover:text-white/80 transition-colors"
          >
            Astro Tools
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                activeTool === tool.id
                  ? 'bg-white/12 text-white'
                  : 'text-white/50 hover:bg-white/6 hover:text-white/80'
              }`}
            >
              {tool.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 space-y-1 border-t border-white/8 pt-3">
          <button
            onClick={handleFeedback}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/6 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-3.5 h-3.5 text-white/40 group-hover:text-white/60 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-[13px] text-white/50 group-hover:text-white/70 transition-colors">Send feedback</span>
            </div>
          </button>
          <p className="text-[11px] text-white/20 px-3">More tools coming soon</p>
        </div>
      </aside>
    </>
  )
}
