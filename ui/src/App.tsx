import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import './index.css'
import { Sidebar } from './components/Sidebar'
import { HomePage } from './components/HomePage'
import { AffiliateLinksPage } from './components/AffiliateLinksPage'
import { ArticleGeneratorPage } from './components/ArticleGeneratorPage'
import { TrendingSpikePage } from './components/TrendingSpikePage'
import { EngagementPhotosPage } from './components/EngagementPhotosPage'
import { EngagementPostsLanding } from './components/EngagementPostsLanding'
import { ScheduledPostsPage } from './components/ScheduledPostsPage'
import { ScheduledPostsLanding } from './components/ScheduledPostsLanding'
import { ShopeeTopProductsPage } from './components/ShopeeTopProductsPage'
import { ZernioScheduledPostsPage } from './components/ZernioScheduledPostsPage'
import { SpikeNewsPage } from './components/SpikeNewsPage'
import { SocialAffiliatePostingPage } from './components/SocialAffiliatePostingPage'
import { QuickFactPage } from './components/QuickFactPage'
import { InputForm } from './components/InputForm'
import { PreviewPanel } from './components/PreviewPanel'
import { CarouselPreviewPanel } from './components/CarouselPreviewPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { GetStartedPage } from './components/GetStartedPage'
import { GuideModal } from './components/ds/GuideModal'
import { ToastContainer } from './components/ds/Toast'
import { useWorkflow } from './hooks/useWorkflow'
import { FBCredentialsModal } from './components/FBCredentialsModal'
import { getCredentials, saveCredentials, clearCredentials, type FBCredentials } from './utils/fbCredentials'
import { toast } from './hooks/useToast'
import type {
  AppState,
  WorkflowResult,
  HistoryItem,
  TitleMode,
  CaptionTitleMode,
  WorkflowRequest,
  WorkflowOperation,
  CarouselResult,
  CarouselResponse,
} from './types'

type ToolId = 'home' | 'fb-post' | 'trending-news' | 'spike-news' | 'affiliate-links' | 'article-generator' | 'engagement-posts' | 'engagement-photos' | 'scheduled-posts' | 'shopee-top-products' | 'post-queue' | 'photo-carousel' | 'social-affiliate-posting' | 'quick-fact'

const pathToTool: Record<string, ToolId> = {
  '/home': 'home',
  '/article-to-fb': 'fb-post',
  '/article-to-carousel': 'photo-carousel',
  '/trending-news-to-fb': 'trending-news',
  '/spike-news': 'spike-news',
  '/affiliate-links': 'affiliate-links',
  '/affiliate-article-editor': 'article-generator',
  '/engagement-photos': 'engagement-posts',
  '/engagement-photos/epl': 'engagement-photos',
  '/trending-news': 'scheduled-posts',
  '/shopee-top-products': 'shopee-top-products',
  '/post-queue': 'post-queue',
  '/social-affiliate-posting': 'social-affiliate-posting',
  '/quick-fact': 'quick-fact',
}

// Map trending-news subpages to scheduled-posts tool
function getActiveTool(pathname: string): ToolId {
  if (pathname.startsWith('/trending-news')) {
    return 'scheduled-posts'
  }
  return pathToTool[pathname] ?? 'home'
}

const toolToPath: Record<ToolId, string> = {
  'home': '/home',
  'fb-post': '/article-to-fb',
  'photo-carousel': '/article-to-carousel',
  'trending-news': '/trending-news-to-fb',
  'spike-news': '/spike-news',
  'affiliate-links': '/affiliate-links',
  'article-generator': '/affiliate-article-editor',
  'engagement-posts': '/engagement-photos',
  'engagement-photos': '/engagement-photos/epl',
  'scheduled-posts': '/trending-news',
  'shopee-top-products': '/shopee-top-products',
  'post-queue': '/post-queue',
  'social-affiliate-posting': '/social-affiliate-posting',
  'quick-fact': '/quick-fact',
}

const topicToPath: Record<string, string> = {
  'engagement-photos': '/engagement-photos/epl',
  'ucl': '/engagement-photos/ucl',
}

// ─── Spike inbox badge helpers ────────────────────────────────────────────────

const SPIKE_SEEN_KEY = 'spike_seen_urls'

function getSpikeSeenUrls(): Set<string> {
  try {
    const raw = localStorage.getItem(SPIKE_SEEN_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveSpikeSeenUrls(urls: string[]): void {
  localStorage.setItem(SPIKE_SEEN_KEY, JSON.stringify(urls))
}

// ─── Kult colours ─────────────────────────────────────────────────────────────

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

function ScheduledPostsBrandPage() {
  const { brandSlug } = useParams<{ brandSlug: string }>()
  return <ScheduledPostsPage brand={brandSlug || ''} />
}

function Layout({ children, showSuggest = true, isSidebarCollapsed, onCollapsedChange, spikeUnreadCount = 0 }: {
  children: React.ReactNode
  showSuggest?: boolean
  isSidebarCollapsed: boolean
  onCollapsedChange: (v: boolean) => void
  spikeUnreadCount?: number
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const activeTool = getActiveTool(location.pathname)

  return (
    <div className={`min-h-screen bg-[#f7f7f6] transition-[padding] duration-300 ${isSidebarCollapsed ? 'md:pl-0' : 'md:pl-60'}`}>
      <Sidebar
        activeTool={activeTool}
        onToolChange={(id) => navigate(toolToPath[id])}
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={onCollapsedChange}
        spikeUnreadCount={spikeUnreadCount}
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

      title_mode: titleMode,
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
  }, [url, brand, titleMode, captionTitleMode, run])

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

  const [showCredModal, setShowCredModal] = useState(false)
  type PendingArgs = { imageUrl: string; caption: string; brand: string; scheduledFor?: string; extraPhotos?: string[]; postMode?: string }
  const [pendingPostArgs, setPendingPostArgs] = useState<PendingArgs | null>(null)

  async function callZernioWebhook(
    args: PendingArgs,
    creds: FBCredentials,
  ): Promise<{success: boolean, message: string, postId?: string, status?: string}> {
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl) return { success: false, message: 'Webhook not configured.' }
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url: args.imageUrl,
          fb_ai_caption: args.caption,
          brand: args.brand.toLowerCase(),
          ...(args.scheduledFor ? { scheduled_for: args.scheduledFor } : {}),
          ...(args.extraPhotos?.length ? { uploaded_images: args.extraPhotos } : {}),
          passcode: creds.passcode,
        }),
      })
      const data = await res.json() as { success?: boolean; status?: string; message?: string; post_id?: string }
      if (data.status === 'AUTH_ERROR') {
        clearCredentials(args.brand.toLowerCase())
        setShowCredModal(true)
        return { success: false, message: data.message ?? 'Invalid passcode.' }
      }
      if (data.status === 'BRAND_ERROR') {
        return { success: false, message: data.message ?? 'Brand not permitted.' }
      }
      if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
        saveCredentials(args.brand.toLowerCase(), creds.passcode)
        return { success: true, message: data.message ?? 'Scheduled!', postId: data.post_id, status: data.status }
      }
      return { success: false, message: data.message ?? 'Something went wrong.' }
    } catch {
      return { success: false, message: 'Network error. Please try again.' }
    }
  }

  async function handlePostDraft(
    imageUrl: string,
    caption: string,
    brand: string,
    scheduledFor?: string,
    extraPhotos?: string[],
    postMode?: string,
    passcode?: string,
  ): Promise<{success: boolean, message: string, postId?: string, status?: string}> {
    const creds = passcode ? { passcode } : getCredentials(brand.toLowerCase())
    if (!creds) {
      setPendingPostArgs({ imageUrl, caption, brand, scheduledFor, extraPhotos, postMode })
      setShowCredModal(true)
      return { success: false, message: 'credentials_required' }
    }
    return callZernioWebhook({ imageUrl, caption, brand, scheduledFor, extraPhotos, postMode }, creds)
  }

  function onCredentialsSaved(creds: FBCredentials) {
    setShowCredModal(false)
    if (pendingPostArgs) {
      const args = pendingPostArgs
      setPendingPostArgs(null)
      void callZernioWebhook(args, creds).then(res => {
        if (!res.success) toast.error(res.message)
      })
    }
  }

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


  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Photo post</h1>
              <p className="text-neutral-500 mt-1 text-sm">Turn any article into a Facebook image &amp; caption</p>
            </div>
            <GuideModal title="How to use Article to FB Post">
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden bg-neutral-100 aspect-video">
                  <iframe
                    src="https://drive.google.com/file/d/1k6kXTcFNUjHofeKiL3W68n5-EkYaqViY/preview"
                    className="w-full h-full"
                    allow="autoplay"
                    title="Article to FB Photo walkthrough video"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-950 mb-3">Step-by-step guide</h3>
                  <ol className="space-y-3 list-decimal list-inside text-sm text-neutral-700">
                    <li><strong>Paste an article URL</strong> — Use "Check supported domains" to see which news sites are compatible before pasting a URL.</li>
                    <li><strong>Select a brand</strong> — Choose the brand the post is for.</li>
                    <li><strong>Choose Image Title mode</strong> — Choose whether to use the original article headline, an AI-rewritten title, or a custom title on the image.</li>
                    <li><strong>Choose Caption Title mode</strong> — Choose whether the caption uses the original article headline or an AI-rewritten version.</li>
                    <li><strong>Click 'Generate Facebook Post Asset'</strong> — The system will generate the image and caption, which will appear on the right.</li>
                    <li><strong>Download &amp; copy</strong> — Download the image and copy the caption.</li>
                  </ol>
                </div>
              </div>
            </GuideModal>
          </div>
          <div className="mt-3 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
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
            {showCredModal && (
              <FBCredentialsModal
                brand={pendingPostArgs?.brand ?? brand}
                onSave={onCredentialsSaved}
                onClose={() => setShowCredModal(false)}
              />
            )}
            <PreviewPanel
              state={state === 'approved' ? 'idle' : state}
              result={result}
              errorMessage={errorMessage}
              onApprove={handleApprove}
              onRegenerate={handleRegenerate}
              onReset={handleReset}
              onPartialRegenerate={handlePartialRegenerate}
              titleMode={titleMode}
              captionTitleMode={captionTitleMode}
              onPostDraft={handlePostDraft}
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

function CarouselPage() {
  const [state, setState] = useState<AppState>('idle')
  const [result, setResult] = useState<CarouselResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const [url, setUrl] = useState('')
  const [brand, setBrand] = useState('')
  const [titleMode, setTitleMode] = useState<TitleMode>('original')
  const [captionTitleMode, setCaptionTitleMode] = useState<CaptionTitleMode>('original')

  const carouselWebhookUrl = import.meta.env.VITE_CAROUSEL_WEBHOOK_URL as string | undefined
  const { run, isRunning } = useWorkflow(carouselWebhookUrl)

  useEffect(() => {
    if (state === 'result' && window.innerWidth < 768) {
      setTimeout(() => {
        document.getElementById('carousel-preview-panel')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [state])

  const handleSubmit = useCallback(async () => {
    if (!url.trim() || !brand) return

    setState('loading')
    setResult(null)
    setErrorMessage('')

    const request: WorkflowRequest = {
      url: url.trim(),
      brand,
      title_mode: titleMode,
      caption_title_mode: captionTitleMode,
    }

    const response = await run(request)
    const carouselResponse = response as unknown as CarouselResponse

    if (carouselResponse.success) {
      setResult(carouselResponse)
      setState('result')
    } else {
      setErrorMessage(carouselResponse.message)
      setState('error')
    }
  }, [url, brand, titleMode, captionTitleMode, run])

  const handleReset = useCallback(() => {
    setState('idle')
    setResult(null)
    setErrorMessage('')
  }, [])

  async function handleCarouselPostDraft(
    imageUrls: string[],
    caption: string,
    postBrand: string,
    scheduledFor?: string,
    passcode?: string,
  ): Promise<{success: boolean, message: string, status?: string}> {
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl) return { success: false, message: 'Webhook not configured.' }
    const creds = passcode ? { passcode } : getCredentials(postBrand.toLowerCase())
    if (!creds) return { success: false, message: 'credentials_required' }
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url: imageUrls[0],
          carousel_images: imageUrls,
          fb_ai_caption: caption,
          brand: postBrand.toLowerCase(),
          ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
          passcode: creds.passcode,
        }),
      })
      const data = await res.json() as { success?: boolean; status?: string; message?: string }
      if (data.status === 'AUTH_ERROR') return { success: false, message: data.message ?? 'Invalid passcode.', status: 'AUTH_ERROR' }
      if (data.status === 'BRAND_ERROR') return { success: false, message: data.message ?? 'Brand not permitted.' }
      if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') return { success: true, message: 'Scheduled!' }
      return { success: false, message: data.message ?? 'Something went wrong.' }
    } catch {
      return { success: false, message: 'Network error. Please try again.' }
    }
  }

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Photo carousel post</h1>
              <p className="text-neutral-500 mt-1 text-sm">Turn any article into a branded photo carousel — 1 main image + up to 6 supporting photos</p>
            </div>
          </div>
          <div className="mt-3 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
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
                captionTitleMode={captionTitleMode}
                onCaptionTitleModeChange={setCaptionTitleMode}
                onSubmit={handleSubmit}
                disabled={isRunning}
              />
            </div>
          </div>

          <div id="carousel-preview-panel">
            <CarouselPreviewPanel
              state={state as 'idle' | 'loading' | 'result' | 'error'}
              result={result}
              errorMessage={errorMessage}
              onReset={handleReset}
              onPostDraft={handleCarouselPostDraft}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

function App() {
  const navigate = useNavigate()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [spikeUnreadCount, setSpikeUnreadCount] = useState(0)
  const hasFetchedBadge = useRef(false)

  // Background fetch to check for unread spike items on app load
  useEffect(() => {
    if (hasFetchedBadge.current) return
    hasFetchedBadge.current = true
    const webhookUrl = (import.meta.env.VITE_TRENDING_SPIKE_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl) return
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'get-spike-inbox' }),
    })
      .then(r => r.json())
      .then((data: { success?: boolean; spikes?: Array<{ articleUrl?: string }> }) => {
        if (data.success && Array.isArray(data.spikes)) {
          const seenUrls = getSpikeSeenUrls()
          const todayStr = new Date().toDateString()
          const unread = data.spikes.filter((s: { articleUrl?: string; receivedAt?: string }) => {
            if (!s.articleUrl || seenUrls.has(s.articleUrl)) return false
            if (!s.receivedAt) return false
            return new Date(s.receivedAt).toDateString() === todayStr
          }).length
          setSpikeUnreadCount(unread)
        }
      })
      .catch(() => {})
  }, [])

  function markSpikeRead(urls: string[]) {
    saveSpikeSeenUrls(urls)
    setSpikeUnreadCount(0)
  }

  const layoutProps = {
    isSidebarCollapsed,
    onCollapsedChange: setIsSidebarCollapsed,
    spikeUnreadCount,
  }

  return (
    <>
    <ToastContainer />
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/start" element={<GetStartedPage />} />
      <Route path="/home" element={
        <Layout {...layoutProps}>
          <HomePage onToolSelect={(id) => navigate(toolToPath[id])} />
        </Layout>
      } />
      <Route path="/article-to-fb" element={
        <Layout {...layoutProps}>
          <FbPostPage />
        </Layout>
      } />
      <Route path="/article-to-carousel" element={
        <Layout {...layoutProps}>
          <CarouselPage />
        </Layout>
      } />
      <Route path="/trending-news-to-fb" element={
        <Layout {...layoutProps}>
          <TrendingSpikePage />
        </Layout>
      } />
      <Route path="/spike-news" element={
        <Layout {...layoutProps}>
          <SpikeNewsPage onMarkRead={markSpikeRead} />
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
      <Route path="/engagement-photos" element={
        <Layout {...layoutProps}>
          <EngagementPostsLanding onSelectTopic={(id) => navigate(topicToPath[id])} />
        </Layout>
      } />
      <Route path="/engagement-photos/epl" element={
        <Layout {...layoutProps}>
          <EngagementPhotosPage topic="epl" />
        </Layout>
      } />
      <Route path="/engagement-photos/ucl" element={
        <Layout {...layoutProps}>
          <EngagementPhotosPage topic="ucl" />
        </Layout>
      } />
      <Route path="/engagement-photos/worldcup" element={
        <Layout {...layoutProps}>
          <EngagementPhotosPage topic="worldcup" />
        </Layout>
      } />
      <Route path="/trending-news" element={
        <Layout {...layoutProps}>
          <ScheduledPostsLanding onSelectBrand={() => {}} />
        </Layout>
      } />
      <Route path="/trending-news/:brandSlug" element={
        <Layout {...layoutProps}>
          <ScheduledPostsBrandPage />
        </Layout>
      } />
      <Route path="/shopee-top-products" element={
        <Layout {...layoutProps}>
          <ShopeeTopProductsPage />
        </Layout>
      } />
      <Route path="/post-queue" element={
        <Layout {...layoutProps} showSuggest={false}>
          <ZernioScheduledPostsPage />
        </Layout>
      } />
      <Route path="/social-affiliate-posting" element={
        <Layout {...layoutProps}>
          <SocialAffiliatePostingPage />
        </Layout>
      } />
      <Route path="/quick-fact" element={
        <Layout {...layoutProps}>
          <QuickFactPage />
        </Layout>
      } />
    </Routes>
    </>
  )
}

export default App
