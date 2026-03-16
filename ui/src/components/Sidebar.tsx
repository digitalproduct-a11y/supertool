import { useState } from 'react'

interface SidebarProps {
  activeTool?: 'fb-post' | 'thumbnail'
  onToolChange?: (id: 'fb-post' | 'thumbnail') => void
}

export function Sidebar({ activeTool = 'fb-post', onToolChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const tools = [
    { id: 'fb-post' as const, label: 'Article to FB Post' },
    { id: 'thumbnail' as const, label: 'Shopee Article' },
  ]

  const handleToolClick = (toolId: 'fb-post' | 'thumbnail') => {
    onToolChange?.(toolId)
    setIsOpen(false)
  }

  const handleFeedback = () => {
    const toolName = activeTool === 'fb-post' ? 'Article to FB Post' : 'Shopee Article'
    const subject = encodeURIComponent(`Feedback: ${toolName}`)
    const body = encodeURIComponent(`Hi team, I have some feedback about the tool ${toolName}.\n\n[Insert your feedback here]`)
    window.location.href = `mailto:digitalproduct@astro.com.my?subject=${subject}&body=${body}`
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg hover:bg-gray-100"
      >
        <svg
          className="w-6 h-6 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Sidebar overlay (mobile) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:sticky left-0 top-0 h-screen md:h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-200 z-40 md:z-0 flex flex-col`}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Astro Tools</h1>
        </div>

        {/* Tools list */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
                activeTool === tool.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tool.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          <button
            onClick={handleFeedback}
            className="w-full text-left px-4 py-3 rounded-lg bg-green-50 hover:bg-green-100 text-green-900 font-medium transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">Have feedback?</span>
              </div>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-xs text-green-700 mt-1 ml-6">Get in touch with Digital Product Team →</p>
          </button>
          <p className="text-xs text-gray-400 px-4">More tools coming soon</p>
        </div>
      </aside>
    </>
  )
}
