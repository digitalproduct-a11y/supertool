import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { trackPostScheduled } from './utils/analytics'
import './index.css'
import { HomePage } from './pages/HomePage'
import { AffiliateLinksPage } from './pages/AffiliateLinksPage'
import { ArticleGeneratorPage } from './pages/ArticleGeneratorPage'
import { LatestNewsPage } from './pages/LatestNewsPage'
import { TrendingSpikePage } from './pages/TrendingSpikePage'
import { EngagementPhotosPage } from './pages/EngagementPhotosPage'
import { EngagementPostsLanding } from './pages/EngagementPostsLanding'
import { LatestCurrencyRatePage } from './pages/LatestCurrencyRatePage'
import { LatestFuelPricePage } from './pages/LatestFuelPricePage'
import { KLCIIndexPage } from './pages/KLCIIndexPage'
import { BrandLayout } from './components/BrandLayout'
import { RouteTracker } from './components/RouteTracker'
import { PageTitle } from './components/PageTitle'
import { ShopeeTopProductsPage } from './pages/ShopeeTopProductsPage'
import { ZernioScheduledPostsPage } from './pages/ZernioScheduledPostsPage'
import { SpikeNewsPage } from './pages/SpikeNewsPage'
import { SocialAffiliatePostingPage } from './pages/SocialAffiliatePostingPage'
import { QuickFactPage } from './pages/QuickFactPage'
import { PrimeTalkPage } from './pages/PrimeTalkPage'
import { DidYouKnowPage } from './pages/DidYouKnowPage'
import { DashboardPage } from './pages/DashboardPage'
import { YouTubeDashboardPage } from './pages/YouTubeDashboardPage'
import { WeeklyReportPage } from './pages/WeeklyReportPage'
import { ArticleToSocialPage } from './pages/ArticleToSocialPage'
const OnThisDayPage = lazy(() =>
  import('./pages/OnThisDayPage').then((m) => ({
    default: m.OnThisDayPage,
  })),
)
const WeatherMalaysiaPage = lazy(() =>
  import('./pages/WeatherMalaysiaPage').then((m) => ({
    default: m.WeatherMalaysiaPage,
  })),
)
const QuotePage = lazy(() =>
  import('./pages/QuotePage').then((m) => ({
    default: m.QuotePage,
  })),
)
import { InputForm } from './features/article/InputForm'
import { PreviewPanel } from './features/article/PreviewPanel'
import { CarouselPreviewPanel } from './features/carousel/CarouselPreviewPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { BrandSelectionPage } from './pages/BrandSelectionPage'
import { GetStartedPage } from './pages/GetStartedPage'
import { GuideModal } from './components/ds/GuideModal'
import { Spinner } from './components/ds/Spinner'
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

type ToolId = 'home' | 'article-to-social' | 'fb-post' | 'latest-news' | 'trending-news' | 'spike-news' | 'affiliate-links' | 'article-generator' | 'engagement-posts' | 'engagement-photos' | 'scheduled-posts' | 'shopee-top-products' | 'post-queue' | 'photo-carousel' | 'social-affiliate-posting' | 'quick-fact' | 'prime-talk' | 'on-this-day' | 'weather-malaysia' | 'quote' | 'dashboard' | 'youtube-dashboard'

const pathToTool: Record<string, ToolId> = {
  '/home': 'home',
  '/article-to-social': 'article-to-social',
  '/article-to-fb': 'fb-post',
  '/article-to-carousel': 'photo-carousel',
  '/news-feed': 'latest-news',
  '/trending-news': 'trending-news',
  '/spike-news': 'spike-news',
  '/affiliate-links': 'affiliate-links',
  '/affiliate-article-editor': 'article-generator',
  '/engagement-posts': 'engagement-posts',
  '/engagement-posts/epl': 'engagement-photos',
  '/engagement-posts/malay-entertainment': 'engagement-photos',
  '/engagement-posts/badminton': 'engagement-photos',
  '/engagement-posts/motogp': 'engagement-photos',
  '/shopee-top-products': 'shopee-top-products',
  '/post-queue': 'post-queue',
  '/social-affiliate-posting': 'social-affiliate-posting',
  '/quick-fact': 'quick-fact',
  '/engagement-photos/prime-talk': 'engagement-posts',
  '/engagement-posts/on-this-day-malaysia': 'on-this-day',
  '/engagement-posts/weather-malaysia': 'weather-malaysia',
  '/engagement-posts/quote': 'quote',
  '/dashboard': 'dashboard',
  '/youtube-dashboard': 'youtube-dashboard',
}

// Map trending-news and news-bank subpages to scheduled-posts tool
function getActiveTool(pathname: string): ToolId {
  if (pathname.startsWith('/news-feed')) {
    return 'latest-news'
  }
  if (pathname.startsWith('/trending-news')) {
    return 'trending-news'
  }
  if (pathname.startsWith('/youtube-dashboard')) {
    return 'youtube-dashboard'
  }
  if (pathname.startsWith('/dashboard')) {
    return 'dashboard'
  }
  return pathToTool[pathname] ?? 'home'
}

const toolToPath: Record<ToolId, string> = {
  'home': '/home',
  'article-to-social': '/article-to-social',
  'fb-post': '/article-to-fb',
  'photo-carousel': '/article-to-carousel',
  'latest-news': '/news-feed',
  'trending-news': '/trending-news',
  'spike-news': '/spike-news',
  'affiliate-links': '/affiliate-links',
  'article-generator': '/affiliate-article-editor',
  'engagement-posts': '/engagement-posts',
  'engagement-photos': '/engagement-posts/epl',
  'scheduled-posts': '/news-feed',
  'shopee-top-products': '/shopee-top-products',
  'post-queue': '/post-queue',
  'social-affiliate-posting': '/social-affiliate-posting',
  'quick-fact': '/quick-fact',
  'prime-talk': '/engagement-photos/prime-talk',
  'on-this-day': '/engagement-posts/on-this-day-malaysia',
  'weather-malaysia': '/engagement-posts/weather-malaysia',
  'quote': '/engagement-posts/quote',
  'dashboard': '/dashboard',
  'youtube-dashboard': '/youtube-dashboard',
}


// ─── Spike inbox badge helpers ────────────────────────────────────────────────

const SPIKE_SEEN_KEY = 'spike_seen_urls'

function saveSpikeSeenUrls(urls: string[]): void {
  localStorage.setItem(SPIKE_SEEN_KEY, JSON.stringify(urls))
}

// ─── Kult colours ─────────────────────────────────────────────────────────────





function FbPostPage() {
  const [state, setState] = useState<AppState>('idle')
  const [result, setResult] = useState<WorkflowResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [history, setHistory] = useState<HistoryItem[]>([])

  const [url, setUrl] = useState('')
  const [brand, setBrand] = useState('')
  const [titleMode, setTitleMode] = useState<TitleMode>('original')
  const [captionTitleMode, setCaptionTitleMode] = useState<CaptionTitleMode>('original')

  const stagingWebhookUrl = (import.meta.env.VITE_GENERATE_WEBHOOK_URL_STAGING as string | undefined)?.trim()
  const { run, isRunning } = useWorkflow(stagingWebhookUrl)

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
        const [, brandSlug, ...toolParts] = window.location.pathname.split('/')
        trackPostScheduled(toolParts.join('/') || 'unknown', brandSlug ?? 'unknown')
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  function markSpikeRead(urls: string[]) {
    saveSpikeSeenUrls(urls)
  }

  return (
    <>
    <PageTitle />
    <ToastContainer />
    <Routes>
      <Route path="/" element={<BrandSelectionPage />} />
      <Route path="/start" element={<GetStartedPage />} />

      <Route path="/:brandSlug" element={
        <>
          <RouteTracker />
          <BrandLayout
            isSidebarCollapsed={isSidebarCollapsed}
            onCollapsedChange={setIsSidebarCollapsed}
            toolToPath={toolToPath}
            getActiveTool={getActiveTool}
          />
        </>
      }>
        <Route path="home" element={<HomePage onToolSelect={() => {}} />} />
        <Route path="article-to-social" element={<ArticleToSocialPage />} />
        <Route path="article-to-fb" element={<FbPostPage />} />
        <Route path="article-to-carousel" element={<CarouselPage />} />
        <Route path="news-feed" element={<LatestNewsPage />} />
        <Route path="trending-news" element={<TrendingSpikePage />} />
        <Route path="spike-news" element={<SpikeNewsPage onMarkRead={markSpikeRead} />} />
        <Route path="affiliate-links" element={<AffiliateLinksPage />} />
        <Route path="affiliate-article-editor" element={<ArticleGeneratorPage isSidebarCollapsed={isSidebarCollapsed} />} />
        <Route path="engagement-posts" element={<EngagementPostsLanding onSelectTopic={() => {}} />} />
        <Route path="engagement-posts/epl" element={<EngagementPhotosPage topic="epl" />} />
        <Route path="engagement-posts/ucl" element={<EngagementPhotosPage topic="ucl" />} />
        <Route path="engagement-posts/malay-entertainment" element={<EngagementPhotosPage topic="gempak-entertainment" />} />
        <Route path="engagement-posts/badminton" element={<EngagementPhotosPage topic="badminton" />} />
        <Route path="engagement-posts/motogp" element={<EngagementPhotosPage topic="motogp" />} />
        <Route path="engagement-posts/worldcup" element={<EngagementPhotosPage topic="worldcup" />} />
        <Route path="engagement-posts/latest-currency-rate" element={<LatestCurrencyRatePage />} />
        <Route path="engagement-posts/latest-fuel-price" element={<LatestFuelPricePage />} />
        <Route path="engagement-posts/klci-index" element={<KLCIIndexPage />} />
        <Route path="engagement-posts/on-this-day-malaysia" element={
          <Suspense fallback={<div className="flex-1 pt-20 md:pt-10 flex items-center justify-center"><Spinner size="lg" /></div>}>
            <OnThisDayPage />
          </Suspense>
        } />
        <Route path="engagement-posts/weather-malaysia" element={
          <Suspense fallback={<div className="flex-1 pt-20 md:pt-10 flex items-center justify-center"><Spinner size="lg" /></div>}>
            <WeatherMalaysiaPage />
          </Suspense>
        } />
        <Route path="engagement-posts/quote" element={
          <Suspense fallback={<div className="flex-1 pt-20 md:pt-10 flex items-center justify-center"><Spinner size="lg" /></div>}>
            <QuotePage />
          </Suspense>
        } />
        <Route path="engagement-posts/didyouknow" element={<DidYouKnowPage />} />
        <Route path="engagement-photos/prime-talk" element={<PrimeTalkPage />} />
        <Route path="shopee-top-products" element={<ShopeeTopProductsPage />} />
        <Route path="post-queue" element={<ZernioScheduledPostsPage />} />
        <Route path="social-affiliate-posting" element={<SocialAffiliatePostingPage />} />
        <Route path="quick-fact" element={<QuickFactPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="weekly-report" element={<WeeklyReportPage />} />
        <Route path="youtube-dashboard" element={<YouTubeDashboardPage />} />
      </Route>

      {/* Catch-all: old bookmarks or invalid paths → brand picker */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default App
