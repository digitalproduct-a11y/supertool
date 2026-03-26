import { useState, useCallback, useEffect } from 'react'
import './index.css'
import { Sidebar } from './components/Sidebar'
import { HomePage } from './components/HomePage'
import { AffiliateLinksPage } from './components/AffiliateLinksPage'
import { ArticleGeneratorPage } from './components/ArticleGeneratorPage'
import { ArticlePage } from './components/ArticlePage'
import { TrendingSpikePage } from './components/TrendingSpikePage'
import { InputForm } from './components/InputForm'
import { PreviewPanel } from './components/PreviewPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { useWorkflow } from './hooks/useWorkflow'
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
  const [activeTool, setActiveTool] = useState<'home' | 'fb-post' | 'affiliate-links' | 'article-generator' | 'trending-spike'>('home')

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
    op: WorkflowOperation,
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

  // Render tool pages
  if (activeTool === 'home') {
    return (
      <div className="min-h-screen bg-[#f7f7f6] flex md:gap-0">
        <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
        <HomePage onToolSelect={setActiveTool} />
      </div>
    )
  }

  if (activeTool === 'affiliate-links') {
    return (
      <div className="min-h-screen bg-[#f7f7f6] flex md:gap-0">
        <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
        <AffiliateLinksPage />
      </div>
    )
  }

  if (activeTool === 'article-generator') {
    return (
      <div className="min-h-screen bg-[#f7f7f6] flex md:gap-0">
        <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
        <ArticleGeneratorPage />
      </div>
    )
  }

  if (activeTool === 'trending-spike') {
    return (
      <div className="min-h-screen bg-[#f7f7f6] flex md:gap-0">
        <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />
        <TrendingSpikePage />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f7f6] flex md:gap-0">
      {/* Sidebar */}
      <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />

      {/* Main content */}
      <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-neutral-950 tracking-tight">Article to FB Post</h1>
            <p className="text-neutral-500 mt-1 text-sm">Turn any article into a Facebook image &amp; caption</p>
          </div>

          {/* Split pane: inputs on left, preview on right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
            {/* Left: Input form + history */}
            <div>
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
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
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto animate-fade-slide-up">
                    <svg
                      className="w-7 h-7 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                        style={{
                          strokeDasharray: 30,
                          strokeDashoffset: 30,
                          animation: 'draw-check 0.45s cubic-bezier(0.25, 1, 0.5, 1) 0.2s forwards',
                        }}
                      />
                    </svg>
                  </div>
                  <div className="animate-fade-slide-up" style={{ animationDelay: '0.3s' }}>
                    <p className="font-semibold text-gray-800">Done! Post is ready.</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Image downloaded &amp; caption copied to clipboard
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-6 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition active:scale-[0.97]"
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
