import { useState, useEffect } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { IconChevronLeft } from '@tabler/icons-react'
import { useDidYouKnow } from '../hooks/useDidYouKnow'
import { BRANDS } from '../constants/brands'
import { DidYouKnowCard } from './DidYouKnowCard'
import { toast } from '../hooks/useToast'
import type { DidYouKnowIdea } from '../hooks/useDidYouKnow'

type Stage = 'input' | 'select' | 'review'

export function DidYouKnowPage() {
  const navigate = useNavigate()
  const { ideas, setIdeas, isLoading, error, fetchIdeas } = useDidYouKnow()
  const [stage, setStage] = useState<Stage>('input')
  const [selectedIdea, setSelectedIdea] = useState<DidYouKnowIdea | null>(null)
  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [context, setContext] = useState<string>('')

  const webhookUrl = import.meta.env.VITE_DIDYOUKNOW_WEBHOOK_URL as string | undefined

  // Block in-app navigation during review or loading
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (stage === 'review' || isLoading) && currentLocation.pathname !== nextLocation.pathname
  )

  // Prevent accidental page close
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
      toast.error('Please enter context')
      return
    }
    if (!webhookUrl) {
      toast.error('Webhook URL not configured')
      return
    }

    await fetchIdeas(selectedBrand, context, webhookUrl)
    setStage('select')
  }

  const handleSelectIdea = (idea: DidYouKnowIdea) => {
    setSelectedIdea(idea)
    setStage('review')
  }

  const handleUpdateField = (field: 'headline' | 'fact' | 'caption', value: string) => {
    if (selectedIdea) {
      const updated = { ...selectedIdea, [field]: value }
      setSelectedIdea(updated)
      setIdeas(ideas.map((i) => (i.id === selectedIdea.id ? updated : i)))
    }
  }

  const handleBackToIdeas = () => {
    setSelectedIdea(null)
    setStage('select')
  }

  const handleBackToInput = () => {
    setIdeas([])
    setStage('input')
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
          <p className="text-sm text-neutral-600">Generate fun facts and interesting moments</p>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Stage 1: Input */}
        {stage === 'input' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-950 mb-2">Select Brand</label>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-950 mb-2">Context</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="E.g., Best moments from FIFA World Cup 2002"
                rows={4}
                className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Describe what kind of facts you want to generate
              </p>
            </div>

            {error && <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <button
              onClick={handleFetchIdeas}
              disabled={isLoading || !selectedBrand || !context.trim()}
              className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
            >
              {isLoading ? 'Generating...' : 'Find Ideas'}
            </button>
          </div>
        )}

        {/* Stage 1: Loading */}
        {stage === 'input' && isLoading && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 text-center space-y-4">
            <div className="text-4xl inline-block animate-bounce">💡</div>
            <p className="text-sm font-semibold text-neutral-900">Finding Ideas</p>
            <p className="text-xs text-neutral-500">Searching for interesting facts...</p>
          </div>
        )}

        {/* Stage 2: Select Idea */}
        {stage === 'select' && !isLoading && (
          <div className="space-y-4">
            <button
              onClick={handleBackToInput}
              className="text-sm text-neutral-600 hover:text-neutral-950 transition flex items-center gap-1"
            >
              <IconChevronLeft className="w-4 h-4" />
              Back to input
            </button>

            <div className="grid gap-4 sm:grid-cols-2">
              {ideas.map((idea) => (
                <button
                  key={idea.id}
                  onClick={() => handleSelectIdea(idea)}
                  className="text-left p-4 border border-neutral-200 rounded-xl hover:border-neutral-900 hover:shadow-lg transition bg-white group"
                >
                  <h3 className="font-semibold text-neutral-950 group-hover:text-neutral-900 line-clamp-2">
                    {idea.headline}
                  </h3>
                  <p className="text-xs text-neutral-600 mt-2 line-clamp-2">{idea.fact}</p>
                  <p className="text-xs text-neutral-400 mt-2 line-clamp-3">{idea.caption}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stage 3: Review */}
        {stage === 'review' && selectedIdea && (
          <DidYouKnowCard
            idea={selectedIdea}
            brand={selectedBrand}
            onBack={handleBackToIdeas}
            onUpdateField={handleUpdateField}
          />
        )}
      </div>

      {/* Navigation blocker modal */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Leave this page?</h3>
              <p className="text-sm text-neutral-600 mt-1">Your progress will be lost if you navigate away now.</p>
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
