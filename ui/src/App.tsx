import { useState, useCallback, useEffect } from 'react'
import './index.css'
import { Sidebar } from './components/Sidebar'
import { ArticlePage } from './components/ArticlePage'
import { InputForm } from './components/InputForm'
import { PreviewPanel } from './components/PreviewPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { useWorkflow } from './hooks/useWorkflow'
import { detectBrandFromUrl } from './constants/brands'
import type {
  AppState,
  WorkflowResult,
  HistoryItem,
  TitleMode,
  CaptionTitleMode,
  WorkflowRequest,
  WorkflowOperation,
} from './types'

function App() {
  // Tool selection
  const [activeTool, setActiveTool] = useState<'fb-post' | 'thumbnail'>('fb-post')

  // UI state
  const [state, setState] = useState<AppState>('idle')
  const [result, setResult] = useState<WorkflowResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [history, setHistory] = useState<HistoryItem[]>([])

  // Form state (persists across generations)
  const [url, setUrl] = useState('')
  const [brand, setBrand] = useState('')
  const [titleMode, setTitleMode] = useState<TitleMode>('original')
  const [customTitle, setCustomTitle] = useState('')
  const [captionTitleMode, setCaptionTitleMode] = useState<CaptionTitleMode>('original')

  const { run, isRunning } = useWorkflow()

  // Mobile scroll to preview panel after generation
  useEffect(() => {
    if (state === 'result' && window.innerWidth < 768) {
      setTimeout(() => {
        document.getElementById('preview-panel')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [state])

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) return
    if (!brand) return

    setState('loading')
    setResult(null)
    setErrorMessage('')

    const request: WorkflowRequest = {
      url: url.trim(),
      brand: brand,
      mode: 'own_brand',
      title_mode: titleMode,
      custom_title: titleMode === 'custom' ? customTitle : undefined,
      caption_title_mode: captionTitleMode,
    }

    const response = await run(request)

    if (response.success) {
      setResult(response)
      setState('result')
      // Add to history immediately
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        brand: response.brand,
        title: response.title,
        imageUrl: response.imageUrl,
        caption: response.caption,
      }
      setHistory((h) => [item, ...h])
    } else {
      setErrorMessage(response.message)
      setState('error')
    }
  }, [url, brand, titleMode, customTitle, captionTitleMode, run])

  const handleApprove = useCallback(
    (finalCaption: string) => {
      if (!result) return
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        brand: result.brand,
        title: result.title,
        imageUrl: result.imageUrl,
        caption: finalCaption,
      }
      setHistory((h) => [item, ...h])
      setState('approved')
    },
    [result],
  )

  const handleRegenerate = useCallback(() => {
    handleSubmit()
  }, [handleSubmit])

  const handleReset = useCallback(() => {
    setState('idle')
    setResult(null)
    setErrorMessage('')
  }, [])

  const handlePartialRegenerate = useCallback(async (
    op: 'image_only' | 'caption_only',
    localTitleMode: TitleMode,
    localCustomTitle: string,
    localCaptionTitleMode: CaptionTitleMode,
  ) => {
    setErrorMessage('')

    const request: WorkflowRequest = {
      url: url.trim(),
      brand: brand,
      mode: 'own_brand',
      operation: op,
      title_mode: localTitleMode,
      custom_title: localTitleMode === 'custom' ? localCustomTitle : undefined,
      caption_title_mode: localCaptionTitleMode,
      // Pass through existing values so n8n can return them unchanged
      imageUrl: result?.imageUrl,
      caption: result?.caption,
      title: result?.title,
    }

    const response = await run(request)

    if (response.success) {
      const updatedResult = (() => {
        if (op === 'image_only') return { ...result, imageUrl: response.imageUrl, title: response.title } as WorkflowResult
        if (op === 'caption_only') return { ...result, caption: response.caption } as WorkflowResult
        return response
      })()

      setResult(updatedResult)
      setState('result')

      // Add to history immediately
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        brand: updatedResult.brand,
        title: updatedResult.title,
        imageUrl: updatedResult.imageUrl,
        caption: updatedResult.caption,
      }
      setHistory((h) => [item, ...h])
    } else {
      setErrorMessage(response.message)
      setState('error')
    }
  }, [url, brand, result, run])

  // Render article page if selected
  if (activeTool === 'thumbnail') {
    return (
      <div className="min-h-screen bg-gray-50 flex md:gap-0">
        <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
        <ArticlePage />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex md:gap-0">
      {/* Sidebar */}
      <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />

      {/* Main content */}
      <main className="flex-1 pt-20 md:pt-0 px-4 md:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Article to FB Post Generator</h1>
            <p className="text-gray-500 mt-1">Turn any article into a Facebook image &amp; caption</p>
          </div>

          {/* Split pane: inputs on left, preview on right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
            {/* Left: Input form + history */}
            <div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <InputForm
                  url={url}
                  onUrlChange={setUrl}
                  brand={brand}
                  onBrandChange={setBrand}
                  titleMode={titleMode}
                  onTitleModeChange={setTitleMode}
                  customTitle={customTitle}
                  onCustomTitleChange={setCustomTitle}
                  captionTitleMode={captionTitleMode}
                  onCaptionTitleModeChange={setCaptionTitleMode}
                  onSubmit={handleSubmit}
                  disabled={isRunning}
                />
              </div>

              {/* Session history below form */}
              {history.length > 0 && (
                <div className="mt-6">
                  <HistoryPanel items={history} />
                </div>
              )}
            </div>

            {/* Right: Preview panel */}
            <div id="preview-panel">
              <PreviewPanel
                state={state === 'approved' ? 'idle' : state}
                result={result}
                errorMessage={errorMessage}
                onApprove={handleApprove}
                onRegenerate={handleRegenerate}
                onReset={handleReset}
                onPartialRegenerate={handlePartialRegenerate}
                titleMode={titleMode}
                customTitle={customTitle}
                captionTitleMode={captionTitleMode}
                isRunning={isRunning}
              />
            </div>
          </div>

          {/* Approval confirmation */}
          {state === 'approved' && (
            <div className="mt-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                    <svg
                      className="w-6 h-6 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Approved!</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Image downloaded &amp; caption copied to clipboard
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition"
                  >
                    Generate another post
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
