import { useState, useCallback, useEffect, useMemo } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import './index.css'
import { Sidebar } from './components/Sidebar'
import { HomePage } from './components/HomePage'
import { AffiliateLinksPage } from './components/AffiliateLinksPage'
import { ArticleGeneratorPage } from './components/ArticleGeneratorPage'
import { TrendingSpikePage } from './components/TrendingSpikePage'
import { InputForm } from './components/InputForm'
import { PreviewPanel } from './components/PreviewPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { GuideModal } from './components/ds/GuideModal'
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

type ToolId = 'home' | 'fb-post' | 'trending-news' | 'affiliate-links' | 'article-generator'

const pathToTool: Record<string, ToolId> = {
  '/': 'home',
  '/article-to-fb': 'fb-post',
  '/trending-news-to-fb': 'trending-news',
  '/affiliate-links': 'affiliate-links',
  '/affiliate-article-editor': 'article-generator',
}

const toolToPath: Record<ToolId, string> = {
  'home': '/',
  'fb-post': '/article-to-fb',
  'trending-news': '/trending-news-to-fb',
  'affiliate-links': '/affiliate-links',
  'article-generator': '/affiliate-article-editor',
}

const KULT_COLOURS = ['#FF3FBF', '#00E5D4', '#0055EE', '#F05A35']

function ConfettiBurst({ children }: { children: React.ReactNode }) {
  const pieces = useMemo(() =>
    Array.from({ length: 36 }, (_, i) => ({
      id: i,
      color: KULT_COLOURS[i % KULT_COLOURS.length],
      x: (Math.random() - 0.5) * 340,
      y: -(Math.random() * 220 + 60),
      rot: Math.random() * 720 - 360,
      w: Math.random() * 7 + 4,
      h: Math.random() * 5 + 3,
      delay: Math.random() * 0.5,
      duration: Math.random() * 0.4 + 0.9,
    }))
  , [])

  return (
    <div className="relative" style={{ overflow: 'visible' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
        {pieces.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: '50%',
              top: '40%',
              width: p.w,
              height: p.h,
              backgroundColor: p.color,
              borderRadius: 2,
              animation: `confetti-piece ${p.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s both`,
              '--tx': `${p.x}px`,
              '--ty': `${p.y}px`,
              '--rot': `${p.rot}deg`,
            } as React.CSSProperties}
          />
        ))}
      </div>
      {children}
    </div>
  )
}

function SuggestButton() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [idea, setIdea] = useState('')

  const [submitted, setSubmitted] = useState(false)

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const emailError = emailTouched && email.trim() && !isValidEmail

  const handleOpen = () => {
    setIsExpanded(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)))
  }

  const handleClose = () => {
    setMounted(false)
    setTimeout(() => {
      setIsExpanded(false)
      setSubmitted(false)
      setName('')
      setEmail('')
      setEmailTouched(false)
      setIdea('')
    }, 300)
  }

  const handleSubmit = async () => {
    const webhookUrl = import.meta.env.VITE_SUGGEST_TOOL_WEBHOOK_URL as string | undefined
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, idea }),
        })
      } catch {
        // fail silently — still show success to user
      }
    }
    setSubmitted(true)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-end justify-end">
      {/* Expanded card */}
      {isExpanded && (
        <div
          className="absolute bottom-0 right-0 origin-bottom-right transition-all duration-300 ease-out"
          style={{
            transform: mounted ? 'scale(1)' : 'scale(0.6)',
            opacity: mounted ? 1 : 0,
          }}
        >
          {/* Gradient border wrapper */}
          <div
            className="animate-gradient-border rounded-2xl p-[2px] shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #FF3FBF, #00E5D4, #0055EE, #F05A35, #FF3FBF, #00E5D4)',
              backgroundSize: '300% 300%',
            }}
          >
            <div className="bg-white rounded-[14px] w-80 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950">
                    {submitted ? 'Idea received!' : 'Suggest a New Tool'}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {submitted ? 'Thanks for sharing — we\'ll review it soon.' : 'What would help your workflow?'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors -mt-0.5 -mr-0.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {submitted ? (
                <ConfettiBurst>
                  <div className="animate-fade-slide-up flex flex-col items-center py-6 gap-3">
                    <div className="w-12 h-12 rounded-full bg-neutral-950 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                          style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'draw-check 0.4s cubic-bezier(0.25,1,0.5,1) 0.15s forwards' }}
                        />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-neutral-950">We got it!</p>
                      <p className="text-xs text-neutral-500 mt-0.5">We'll be in touch soon.</p>
                    </div>
                  </div>
                </ConfettiBurst>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent placeholder:text-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Work Email</label>
                    <input
                      type="email"
                      placeholder="you@astro.com.my"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setEmailTouched(true)}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-neutral-400 ${
                        emailError
                          ? 'border-red-300 focus:ring-red-400'
                          : 'border-neutral-200 focus:ring-neutral-900'
                      }`}
                    />
                    {emailError && (
                      <p className="mt-1 text-xs text-red-500">Please enter a valid email address</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Tool Idea</label>
                    <textarea
                      placeholder="What's the task? What would you automate or speed up? Any tools involved?"
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent placeholder:text-neutral-400 resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!name.trim() || !isValidEmail || !idea.trim()}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-neutral-950 hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Send Idea
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pill button — hidden when card is open */}
      {!isExpanded && (
        <div className="suggest-pill-wrapper rounded-full">
          <button
            onClick={handleOpen}
            className="suggest-pill-btn flex items-center gap-2 px-4 py-2.5 bg-neutral-950 text-white text-[13px] font-medium rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Suggest New Tools
          </button>
        </div>
      )}
    </div>
  )
}

function Layout({ children, showSuggest = true, isSidebarCollapsed, onCollapsedChange }: {
  children: React.ReactNode
  showSuggest?: boolean
  isSidebarCollapsed: boolean
  onCollapsedChange: (v: boolean) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const activeTool = pathToTool[location.pathname] ?? 'home'

  return (
    <div className={`min-h-screen bg-[#f7f7f6] transition-[padding] duration-300 ${isSidebarCollapsed ? 'md:pl-0' : 'md:pl-60'}`}>
      <Sidebar
        activeTool={activeTool}
        onToolChange={(id) => navigate(toolToPath[id])}
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={onCollapsedChange}
      />
      {children}
      {showSuggest && <SuggestButton />}
    </div>
  )
}

function FbPostPage() {
  const [state, setState] = useState<AppState>('idle')
  const [result, setResult] = useState<WorkflowResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [history, setHistory] = useState<HistoryItem[]>([])

  const [url, setUrl] = useState('')
  const [brand, setBrand] = useState('')
  const [titleMode, setTitleMode] = useState<TitleMode>('original')
  const [customTitle, setCustomTitle] = useState('')
  const [captionTitleMode, setCaptionTitleMode] = useState<CaptionTitleMode>('original')

  const { run, isRunning } = useWorkflow()

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
      brand,
      mode: 'own_brand',
      title_mode: titleMode,
      custom_title: titleMode === 'custom' ? customTitle : undefined,
      caption_title_mode: captionTitleMode,
    }

    const response = await run(request)

    if (response.success) {
      setResult(response)
      setState('result')
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

  const handleRegenerate = useCallback(() => { handleSubmit() }, [handleSubmit])

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
      brand,
      mode: 'own_brand',
      operation: op,
      title_mode: localTitleMode,
      custom_title: localTitleMode === 'custom' ? localCustomTitle : undefined,
      caption_title_mode: localCaptionTitleMode,
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

  const handlePostDraft = useCallback(async (articleUrl: string, brandName: string) => {
    const webhookUrl = import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined
    if (!webhookUrl) {
      return { success: false, message: 'Post draft webhook not configured' }
    }
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: articleUrl, brand: brandName }),
      })
      const data = await response.json()
      return { success: data.success ?? false, message: data.message ?? 'Unknown error' }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Request failed' }
    }
  }, [])

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-neutral-950 tracking-tight">Article to FB Post</h1>
          <p className="text-neutral-500 mt-1 text-sm">Turn any article into a Facebook image &amp; caption</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
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
            {history.length > 0 && (
              <div className="mt-6">
                <HistoryPanel items={history} />
              </div>
            )}
          </div>

          <div id="preview-panel">
            <PreviewPanel
              state={state === 'approved' ? 'idle' : state}
              result={result}
              errorMessage={errorMessage}
              articleUrl={url}
              onApprove={handleApprove}
              onRegenerate={handleRegenerate}
              onReset={handleReset}
              onPartialRegenerate={handlePartialRegenerate}
              onPostDraft={handlePostDraft}
              titleMode={titleMode}
              customTitle={customTitle}
              captionTitleMode={captionTitleMode}
              isRunning={isRunning}
            />
          </div>
        </div>

        {state === 'approved' && (
          <div className="mt-8">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto animate-fade-slide-up">
                  <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <p className="text-sm text-gray-500 mt-1">Image downloaded &amp; caption copied to clipboard</p>
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
  )
}

function App() {
  const navigate = useNavigate()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const layoutProps = {
    isSidebarCollapsed,
    onCollapsedChange: setIsSidebarCollapsed,
  }

  return (
    <Routes>
      <Route path="/" element={
        <Layout {...layoutProps}>
          <HomePage onToolSelect={(id) => navigate(toolToPath[id])} />
        </Layout>
      } />
      <Route path="/article-to-fb" element={
        <Layout {...layoutProps}>
          <FbPostPage />
        </Layout>
      } />
      <Route path="/trending-news-to-fb" element={
        <Layout {...layoutProps}>
          <TrendingSpikePage />
        </Layout>
      } />
      <Route path="/affiliate-links" element={
        <Layout {...layoutProps}>
          <AffiliateLinksPage />
        </Layout>
      } />
      <Route path="/affiliate-article-editor" element={
        <Layout {...layoutProps} showSuggest={false}>
          <ArticleGeneratorPage isSidebarCollapsed={isSidebarCollapsed} />
        </Layout>
      } />
    </Routes>
  )
}

export default App
