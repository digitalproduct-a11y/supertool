import { useState, useEffect } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { useDidYouKnow } from '../hooks/useDidYouKnow'
import { BRANDS } from '../constants/brands'
import { DidYouKnowCard } from './DidYouKnowCard'
import { IconChevronLeft } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'
import type { DidYouKnowIdea } from '../hooks/useDidYouKnow'

export function DidYouKnowPage() {
  const navigate = useNavigate()
  const { ideas, isLoading, error, fetchIdeas } = useDidYouKnow()

  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [context, setContext] = useState<string>('')
  const [stage, setStage] = useState<'input' | 'select-idea' | 'review'>('input')
  const [selectedIdea, setSelectedIdea] = useState<DidYouKnowIdea | null>(null)

  const webhookUrl = import.meta.env.VITE_DIDYOUKNOW_WEBHOOK_URL as string | undefined

  // Block navigation during review
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      stage === 'review' && currentLocation.pathname !== nextLocation.pathname
  )

  // Prevent accidental page leave during review
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stage === 'review') {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [stage])

  const handleFetchIdeas = async () => {
    if (!selectedBrand) {
      toast.error('Please select a brand')
      return
    }
    if (!context.trim()) {
      toast.error('Please enter a context or topic')
      return
    }
    if (!webhookUrl) {
      toast.error('Webhook URL not configured')
      return
    }

    await fetchIdeas(selectedBrand, context, webhookUrl)
    setStage('select-idea')
  }

  const handleSelectIdea = (idea: DidYouKnowIdea) => {
    setSelectedIdea(idea)
    setStage('review')
  }

  const handleBackToIdeas = () => {
    setStage('select-idea')
  }

  const handleBackToInput = () => {
    setStage('input')
    setSelectedBrand('')
    setContext('')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/engagement-photos')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-neutral-950">Did You Know?</h1>
          </div>
          <p className="text-sm text-neutral-600">Generate engaging sports facts and moments</p>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {stage === 'input' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Select Brand</label>
                <div className="relative">
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full px-4 py-3 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition"
                  >
                    <option value="">Select a brand...</option>
                    {BRANDS.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Context or Topic</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="E.g. Best moments from FIFA World Cup 2002"
                  className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none h-24"
                />
              </div>

              {error && <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">{error}</div>}

              <button
                onClick={handleFetchIdeas}
                disabled={!selectedBrand || !context.trim() || isLoading}
                className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
              >
                {isLoading ? 'Finding Ideas...' : 'Find Ideas'}
              </button>
            </div>
          </div>
        )}

        {stage === 'select-idea' && isLoading && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 text-center space-y-4">
            <div className="text-4xl inline-block animate-bounce">💡</div>
            <p className="text-sm font-semibold text-neutral-900">Generating Ideas</p>
            <p className="text-xs text-neutral-500">Searching reliable sources and crafting ideas...</p>
          </div>
        )}

        {stage === 'select-idea' && !isLoading && ideas.length > 0 && (
          <div className="space-y-6">
            <button
              onClick={handleBackToInput}
              className="text-sm text-neutral-600 hover:text-neutral-950 transition flex items-center gap-1"
            >
              <IconChevronLeft className="w-4 h-4" />
              Back to input
            </button>

            <div>
              <h2 className="text-xl font-semibold text-neutral-950 mb-4">Select an Idea</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ideas.map((idea) => (
                  <button
                    key={idea.id}
                    onClick={() => handleSelectIdea(idea)}
                    className="text-left p-4 border border-neutral-200 rounded-xl hover:border-neutral-900 hover:bg-neutral-50 transition space-y-2"
                  >
                    <p className="font-semibold text-neutral-950 line-clamp-2">{idea.headline}</p>
                    <p className="text-sm text-neutral-600 line-clamp-2">{idea.fact}</p>
                    <p className="text-xs text-neutral-500 line-clamp-1">{idea.caption}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {stage === 'review' && selectedIdea && (
          <DidYouKnowCard
            idea={selectedIdea}
            selectedBrand={selectedBrand}
            onBack={handleBackToIdeas}
          />
        )}
      </div>

      {/* Navigation blocker modal */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Leave this page?</h3>
                <p className="text-sm text-neutral-600 mt-1">Your progress will be lost if you navigate away now.</p>
              </div>
              <button onClick={() => blocker.reset()} className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 transition text-sm"
              >
                Stay
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition text-sm"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
