import type { CarouselResult } from '../types'
import { CarouselResultPreview } from './CarouselResultPreview'
import { CarouselProgressSteps } from './CarouselProgressSteps'
import { IconCarouselHorizontal } from '@tabler/icons-react'

interface CarouselPreviewPanelProps {
  state: 'idle' | 'loading' | 'result' | 'error'
  result: CarouselResult | null
  errorMessage: string
  onReset: () => void
  onPostDraft?: (imageUrl: string, caption: string, brand: string, scheduledFor?: string, passcode?: string) => Promise<{success: boolean, message: string, status?: string}>
}

export function CarouselPreviewPanel({
  state,
  result,
  errorMessage,
  onReset,
  onPostDraft,
}: CarouselPreviewPanelProps) {
  return (
    <div className="glass-card rounded-2xl p-6 min-h-96 flex flex-col">
      {state === 'idle' && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <IconCarouselHorizontal className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-breathe" strokeWidth={1.5} />
            <p className="text-gray-400 text-sm">Your photo carousel will appear here</p>
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2 text-center">
              Generating your carousel
            </h3>
            <p className="text-xs text-gray-400 text-center">
              This usually takes 60–90 seconds
            </p>
          </div>
          <CarouselProgressSteps isComplete={false} />
        </div>
      )}

      {state === 'result' && result && (
        <div className="animate-fade-slide-up">
          <CarouselResultPreview result={result} onPostDraft={onPostDraft} />
        </div>
      )}

      {state === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">Something went wrong</p>
            <p className="text-xs text-gray-500 mt-1">{errorMessage}</p>
          </div>
          <button
            onClick={onReset}
            className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
