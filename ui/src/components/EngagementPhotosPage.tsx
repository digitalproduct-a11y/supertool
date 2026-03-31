import { useState, useEffect } from 'react'
import type { EngagementIdea, Brand } from '../types'
import { useEngagementPhotos } from '../hooks/useEngagementPhotos'
import { Button } from './ds/Button'
import { BRANDS } from '../constants/brands'
import IdeaCard from './IdeaCard'

const TEMPLATE_SAMPLE = 'https://res.cloudinary.com/dymmqtqyg/image/upload/v1774940173/07f3adde-12c6-4d01-b3c5-948f720e5d32_grc7ae.webp'

export function EngagementPhotosPage() {
  const { ideas, setIdeas, isLoading, isRendering, error, generate, refresh, render } = useEngagementPhotos()
  const [selectedBrand, setSelectedBrand] = useState<string>('Stadium Astro')
  const [selectedIdeas, setSelectedIdeas] = useState<Set<string>>(new Set())
  const [stage, setStage] = useState<'brand-select' | 'review' | 'rendered'>('brand-select')

  const handleGenerateIdeas = async () => {
    if (!selectedBrand) {
      alert('Please select a brand')
      return
    }
    setStage('review')
    // Language would come from data table in real implementation
    await generate(selectedBrand, 'en')
    setSelectedIdeas(new Set())
  }

  const handleRefreshIdeas = async () => {
    if (!selectedBrand) return
    await refresh(selectedBrand, 'en')
    setSelectedIdeas(new Set())
  }

  const handleSelectIdea = (ideaId: string) => {
    const newSelected = new Set(selectedIdeas)
    if (newSelected.has(ideaId)) {
      newSelected.delete(ideaId)
    } else {
      newSelected.add(ideaId)
    }
    setSelectedIdeas(newSelected)
  }

  const handleUpdateIdea = (ideaId: string, field: 'headline' | 'subtitle' | 'caption', value: string) => {
    setIdeas(
      ideas.map((idea) => (idea.id === ideaId ? { ...idea, [field]: value } : idea))
    )
  }

  const handlePhotoSelected = (ideaId: string, photoUrl: string) => {
    setIdeas(
      ideas.map((idea) => (idea.id === ideaId ? { ...idea, photo_url: photoUrl } : idea))
    )
  }

  const handleConfirmAndRender = async () => {
    if (!selectedBrand || selectedIdeas.size === 0) {
      alert('Please select at least one idea')
      return
    }

    const ideasToRender = ideas.filter((idea) => selectedIdeas.has(idea.id))

    // Validate all conditions
    const allValid = ideasToRender.every(
      (idea) =>
        idea.headline.trim() &&
        idea.subtitle.trim() &&
        idea.caption.trim() &&
        idea.photo_url
    )

    if (!allValid) {
      alert('Please fill in all fields (headline, subtitle, caption) and select a photo for each post.')
      return
    }

    // Mock brand logo URL — would come from data table
    const brandLogoUrl = 'https://via.placeholder.com/200x100?text=' + selectedBrand.replace(' ', '+')

    await render(ideasToRender, brandLogoUrl)
    setStage('rendered')
  }

  if (stage === 'brand-select') {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">EPL Engagement Posts</h1>
            <p className="text-sm text-neutral-600">Create engaging sports posts with AI-generated ideas</p>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-5">
            {/* Brand Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Brand</label>
              <div className="relative">
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition appearance-none cursor-pointer"
                >
                  {BRANDS.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            {/* Template Sample */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Template Sample</p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <img
                  src={TEMPLATE_SAMPLE}
                  alt="Template sample"
                  className="w-full rounded-lg bg-gray-200"
                />
                <p className="text-xs text-gray-500">
                  This is a sample poster format. Your fully rendered version will appear after you confirm all details.
                </p>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerateIdeas}
              disabled={!selectedBrand || isLoading}
              className="w-full"
            >
              {isLoading ? 'Generating Ideas...' : 'Generate Ideas'}
            </Button>

            {error && (
              <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'review') {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex justify-between items-start gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-950">Review Ideas</h1>
              <p className="text-sm text-neutral-600">Edit and select ideas to render</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefreshIdeas}
                disabled={isLoading}
                className="px-4 py-2 text-neutral-500 hover:text-neutral-900 underline text-xs font-medium transition disabled:text-gray-400"
              >
                ↺ Refresh Ideas
              </button>
              <Button
                onClick={handleConfirmAndRender}
                disabled={selectedIdeas.size === 0 || isRendering}
              >
                {isRendering ? 'Rendering...' : 'Confirm & Render Selected'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                isSelected={selectedIdeas.has(idea.id)}
                onSelect={() => handleSelectIdea(idea.id)}
                onUpdateField={handleUpdateIdea}
                onPhotoSelected={handlePhotoSelected}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // stage === 'rendered'
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">Rendered Posts</h1>
            <p className="text-sm text-neutral-600">Download, copy, or share your posts</p>
          </div>
          <button
            onClick={() => setStage('brand-select')}
            className="px-4 py-2 text-neutral-500 hover:text-neutral-900 underline text-xs font-medium transition"
          >
            ← Start Over
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ideas
            .filter((idea) => selectedIdeas.has(idea.id))
            .map((idea) => (
              <div key={idea.id} className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
                {/* Rendered Image */}
                <div className="aspect-[4/5] bg-gray-200 overflow-hidden">
                  {idea.image_url ? (
                    <img
                      src={idea.image_url}
                      alt={idea.headline}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border border-gray-200 border-t-neutral-900" />
                    </div>
                  )}
                </div>

                {/* Caption & Actions */}
                <div className="p-4 space-y-3">
                  <textarea
                    value={idea.caption}
                    className="w-full h-20 p-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 transition"
                    readOnly
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (idea.image_url) {
                          const link = document.createElement('a')
                          link.href = idea.image_url
                          link.download = `epl-post-${idea.type}.jpg`
                          link.click()
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium transition active:scale-[0.98]"
                    >
                      ↓ Download
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(idea.caption)
                      }}
                      className="flex-1 px-3 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-medium transition"
                    >
                      ⎘ Copy
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
