import { useState, useEffect } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { useEngagementPhotos } from '../hooks/useEngagementPhotos'
import { BRANDS } from '../constants/brands'
import IdeaCard from './IdeaCard'
import { IconChevronLeft } from '@tabler/icons-react'

const TEMPLATE_IMAGES = [
  'https://res.cloudinary.com/dymmqtqyg/image/upload/v1775189927/epl-post-challenge_1_byvuse.jpg',
  'https://res.cloudinary.com/dymmqtqyg/image/upload/v1775199810/epl-post-debate_sqjs6z.jpg',
  'https://res.cloudinary.com/dymmqtqyg/image/upload/v1775199812/epl-post-quiz_c1piip.jpg',
]


const LOADING_STEPS = [
  'Scanning latest EPL news',
  'Curating top stories',
  'Generating 5 post ideas',
]

const LOADING_QUOTES = [
  'VAR checking the vibes...',
  'Consulting the dugout...',
  'Asking the fans...',
  'Reading the match report...',
]

export function EngagementPhotosPage() {
  const navigate = useNavigate()
  const { ideas, setIdeas, isLoading, error, generate, refresh, photosByPlayerClub } = useEngagementPhotos()
  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [stage, setStage] = useState<'brand-select' | 'review'>('brand-select')
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState(LOADING_QUOTES[0])
  const [selectedIdeas, setSelectedIdeas] = useState<Set<string>>(new Set())

  // Block in-app navigation (sidebar clicks) when in review stage
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      stage === 'review' &&
      currentLocation.pathname !== nextLocation.pathname
  )

  // Loading animation: step advance (20s, 20s, then stay on step 3)
  useEffect(() => {
    if (!isLoading) return
    setCurrentLoadingStep(0)

    const timer1 = setTimeout(() => setCurrentLoadingStep(1), 20000)
    const timer2 = setTimeout(() => setCurrentLoadingStep(2), 40000)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [isLoading])

  // Loading animation: quote cycle every 4s
  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(() => {
      setLoadingMessage(LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)])
    }, 4000)
    return () => clearInterval(interval)
  }, [isLoading])

  // Prevent accidental navigation during review/loading
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

  const handleGenerateIdeas = async () => {
    if (!selectedBrand) {
      alert('Please select a brand')
      return
    }
    setStage('review')
    await generate(selectedBrand, 'en')
    setSelectedIdeas(new Set())
    setCurrentLoadingStep(0)
    setLoadingMessage(LOADING_QUOTES[0])
  }

  const handleUpdateIdea = (ideaId: string, field: 'headline' | 'subtitle' | 'caption', value: string) => {
    setIdeas(
      ideas.map((idea) => (idea.id === ideaId ? { ...idea, [field]: value } : idea))
    )
  }

  const handlePhotoSelected = (ideaId: string, photo: { url: string; publicId: string }) => {
    setIdeas(
      ideas.map((idea) => (idea.id === ideaId ? { ...idea, photo_url: photo.url, photo_public_id: photo.publicId } : idea))
    )
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
            <h1 className="text-2xl font-semibold text-neutral-950">Engagement Posts: EPL</h1>
          </div>
          <p className="text-sm text-neutral-600">Create engaging sports posts featuring Premier League players</p>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {stage === 'brand-select' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:items-start">
            {/* LEFT: Brand Selector (spans 2 columns) */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-6">
                  {/* Brand Selector */}
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

                  <button
                    onClick={handleGenerateIdeas}
                    disabled={!selectedBrand || isLoading}
                    className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
                  >
                    {isLoading ? 'Generating Ideas...' : 'Generate Ideas'}
                  </button>

                  {error && <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">{error}</div>}
              </div>
            </div>

            {/* RIGHT: Stacked Cards (1 column, 1080x1350 aspect ratio) */}
            <div>
              <div className="relative overflow-visible rounded-3xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] aspect-[1080/1350]">
                <div className="carousel-stack">
                  {TEMPLATE_IMAGES.map((img, idx) => (
                    <div key={idx} className="carousel-stack-item overflow-hidden">
                      <img src={img} alt={`Template ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === 'review' && isLoading && (
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 text-center space-y-6">
                <div className="text-4xl inline-block animate-bounce">⚽</div>
                <div className="flex justify-center gap-2">
                  {LOADING_STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2 rounded-full transition-all duration-700 ${
                        idx < currentLoadingStep
                          ? 'bg-green-500 w-4'
                          : idx === currentLoadingStep
                            ? 'w-4 animate-pulse'
                            : 'bg-neutral-200 w-2'
                      }`}
                      style={
                        idx === currentLoadingStep
                          ? { background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }
                          : undefined
                      }
                    />
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{LOADING_STEPS[currentLoadingStep]}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Step {currentLoadingStep + 1} of {LOADING_STEPS.length}
                  </p>
                </div>
                <p key={loadingMessage} className="text-sm text-neutral-500 italic animate-fade">
                  {loadingMessage}
                </p>
                <p className="text-xs text-neutral-400">Taking ~30 seconds to process</p>
              </div>
        )}

        {stage === 'review' && !isLoading && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-neutral-950">Review Ideas</h2>
              <p className="text-sm text-neutral-600">Edit ideas and download your posts</p>
            </div>

            {error && <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {ideas.map((idea, idx) => (
                <div key={idea.id} className="border rounded-2xl p-4 bg-white border-gray-200">
                  <IdeaCard
                    idea={idea}
                    onUpdateField={handleUpdateIdea}
                    onPhotoSelected={handlePhotoSelected}
                    selectedBrand={selectedBrand}
                    index={idx}
                    cachedPhotos={photosByPlayerClub}
                  />
                </div>
              ))}
            </div>

            {/* Spacer so content isn't hidden behind sticky bar */}
            <div className="h-24" />
          </div>
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
