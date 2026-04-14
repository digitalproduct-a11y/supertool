import type { WorkflowResult, TitleMode, CaptionTitleMode, WorkflowOperation } from '../types'
import { ResultPreview } from './ResultPreview'
import { ProgressSteps } from './ProgressSteps'

interface PreviewPanelProps {
  state: 'idle' | 'loading' | 'result' | 'error'
  result: WorkflowResult | null
  errorMessage: string
  onApprove: (caption: string) => void
  onRegenerate: () => void
  onReset: () => void
  onPartialRegenerate: (op: WorkflowOperation, titleMode: TitleMode, customTitle: string, captionTitleMode: CaptionTitleMode) => void
  titleMode: TitleMode
  captionTitleMode: CaptionTitleMode
  onPostDraft?: (imageUrl: string, caption: string, brand: string, scheduledFor?: string, extraPhotos?: string[], postMode?: string) => Promise<{success: boolean, message: string, postId?: string, status?: string}>
}

export function PreviewPanel({
  state,
  result,
  errorMessage,
  onApprove: _onApprove,
  onReset,
  onPartialRegenerate: _onPartialRegenerate,
  titleMode: _titleMode,
  captionTitleMode: _captionTitleMode,
  onPostDraft,
}: PreviewPanelProps) {
  return (
    <div className="glass-card rounded-2xl p-6 min-h-96 flex flex-col">
      {state === 'idle' && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-breathe"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-400 text-sm">Generated image will appear here</p>
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2 text-center">
              Generating your post
            </h3>
            <p className="text-xs text-gray-400 text-center">
              This usually takes 30–60 seconds
            </p>
          </div>
          <ProgressSteps isComplete={false} />
        </div>
      )}

      {state === 'result' && result && (
        <div className="animate-fade-slide-up">
          <ResultPreview result={result} isRunning={false} onPostDraft={onPostDraft} />
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
