import { useState, useEffect, useRef } from 'react'
import { trackToolSubmit } from '../utils/analytics'
import { useBlocker } from 'react-router-dom'
import { usePrimeTalk } from '../hooks/usePrimeTalk'
import IdeaCard from '../components/IdeaCard'
import PrimeTalkAngleSelector from '../features/prime-talk/PrimeTalkAngleSelector'
import { IconChevronLeft, IconUpload } from '@tabler/icons-react'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'
import { toast } from '../hooks/useToast'
import type { TopicAngleSelection } from '../types'

const LOADING_STEPS: [string, string, string] = [
  '读取脚本内容',
  '提取关键话题',
  '筛选互动角度',
]

const LOADING_QUOTES = [
  '解读新闻脉络中……',
  '寻找最佳切入角度……',
  '筛选高互动内容……',
  '分析受众共鸣点……',
]

const BRAND = 'Hotspot'
const DOWNLOAD_PREFIX = 'prime-talk-post'

function renderValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => renderValue(v)).join(', ')
  if (value !== null && typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value ?? '')
}

function ScriptAnalysisPanel({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(data)
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-50 transition"
      >
        <div>
          <p className="text-sm font-semibold text-neutral-950">Episode Analysis</p>
          <p className="text-xs text-neutral-500 mt-0.5">{entries.length} fields extracted by AI</p>
        </div>
        <svg
          className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-neutral-100 px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
          {entries.map(([key, value]) => (
            <div key={key}>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-0.5">
                {key.replace(/_/g, ' ')}
              </p>
              <p className="text-sm text-neutral-800 whitespace-pre-wrap">{renderValue(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PrimeTalkPage() {
  const analyzeWebhookUrl = (import.meta.env.VITE_PRIME_TALK_ANALYZE_WEBHOOK_URL as string | undefined)?.trim()
  const generateWebhookUrl = (import.meta.env.VITE_PRIME_TALK_GENERATE_WEBHOOK_URL as string | undefined)?.trim()
  const uploadPreset = (import.meta.env.VITE_CLOUDINARY_PRIME_TALK_UPLOAD_PRESET as string | undefined)?.trim()

  const {
    topics,
    scriptAnalysis,
    ideas,
    setIdeas,
    isAnalyzing,
    isGenerating,
    error,
    uploadAndAnalyze,
    generate,
    reset,
  } = usePrimeTalk()

  const [stage, setStage] = useState<'upload' | 'analyzing' | 'select-angles' | 'review'>('upload')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState(LOADING_QUOTES[0])

  // Navigation blocker during review or generation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (stage === 'review' || isGenerating) &&
      currentLocation.pathname !== nextLocation.pathname
  )

  // Prevent accidental page close during review
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

  // Loading step animation
  useEffect(() => {
    if (!isAnalyzing) return
    setCurrentLoadingStep(0)
    const t1 = setTimeout(() => setCurrentLoadingStep(1), 8000)
    const t2 = setTimeout(() => setCurrentLoadingStep(2), 16000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isAnalyzing])

  // Loading quote cycle
  useEffect(() => {
    if (!isAnalyzing && !isGenerating) return
    const interval = setInterval(() => {
      setLoadingMessage(LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)])
    }, 4000)
    return () => clearInterval(interval)
  }, [isAnalyzing, isGenerating])

  async function handleFile(file: File) {
    if (!file.name.endsWith('.docx')) {
      toast.error('Please upload a .docx file.')
      return
    }
    if (!analyzeWebhookUrl) {
      toast.error('Analyze service not configured. Contact admin.')
      return
    }
    setStage('analyzing')
    const result = await uploadAndAnalyze(file, analyzeWebhookUrl)
    if (result && result.success) {
      setStage('select-angles')
    } else {
      setStage('upload')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  async function handleGenerate(selections: TopicAngleSelection[]) {
    if (!generateWebhookUrl) {
      toast.error('Generate service not configured. Contact admin.')
      return
    }
    const [, brandSlug, ...toolParts] = window.location.pathname.split('/')
    trackToolSubmit(toolParts.join('/') || 'unknown', brandSlug ?? 'unknown')
    setStage('review')
    await generate(selections, generateWebhookUrl)
  }

  async function handleScheduleOnFB(previewUrl: string, caption: string, brand: string, scheduledFor?: string, passcode?: string): Promise<{ success: boolean; message: string }> {
    const resolvedPasscode = passcode ?? getCredentials(brand.toLowerCase())?.passcode
    if (!resolvedPasscode) return { success: false, message: 'No passcode.' }
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl) { toast.error('Publish service not configured. Contact admin.'); return { success: false, message: 'Webhook not configured.' } }
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url: previewUrl,
          fb_ai_caption: caption,
          brand: brand.toLowerCase(),
          passcode: resolvedPasscode,
          ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        }),
      })
      const data = await res.json() as { success?: boolean; status?: string; message?: string }
      if (data.status === 'AUTH_ERROR') {
        clearCredentials(brand.toLowerCase())
        toast.error('Incorrect passcode. Please try again.')
        return { success: false, message: 'Invalid passcode.' }
      }
      if (data.status === 'BRAND_ERROR') {
        const msg = data.message ?? 'Brand not allowed.'
        toast.error(msg)
        return { success: false, message: msg }
      }
      if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
        saveCredentials(brand.toLowerCase(), resolvedPasscode)
        toast.success('Scheduled on Facebook!')
        return { success: true, message: 'Scheduled on Facebook!' }
      }
      const msg = data.message ?? 'Failed to schedule. Please try again.'
      toast.error(msg)
      return { success: false, message: msg }
    } catch {
      toast.error('Network error. Please try again.')
      return { success: false, message: 'Network error. Please try again.' }
    }
  }

  const handleUpdateIdea = (ideaId: string, field: 'headline' | 'subtitle' | 'caption', value: string) => {
    setIdeas(ideas.map((idea) => (idea.id === ideaId ? { ...idea, [field]: value } : idea)))
  }

  const handlePhotoSelected = (ideaId: string, photo: { url: string; publicId: string }) => {
    setIdeas(ideas.map((idea) => (idea.id === ideaId ? { ...idea, photo_url: photo.url, photo_public_id: photo.publicId } : idea)))
  }

  function handleBack() {
    if (stage === 'upload') {
      window.history.back()
    } else if (stage === 'select-angles') {
      reset()
      setStage('upload')
    } else if (stage === 'review') {
      setStage('select-angles')
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-neutral-950">Prime Talk 《八点最热报》 Post Generator</h1>
          </div>
          <p className="text-sm text-neutral-600">Turn Prime Talk episode scripts into ready-to-post Facebook image cards</p>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">

        {/* Stage: Upload */}
        {stage === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-8">
              <h2 className="text-lg font-semibold text-neutral-950 mb-1">Upload Script</h2>
              <p className="text-sm text-neutral-500 mb-6">Upload this week's Prime Talk episode script (.docx)</p>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-neutral-950 bg-neutral-50'
                    : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'
                }`}
              >
                <IconUpload className="w-10 h-10 mx-auto text-neutral-400 mb-3" />
                <p className="text-sm font-medium text-neutral-700">Drag & drop your .docx file here</p>
                <p className="text-xs text-neutral-400 mt-1">or click to browse</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />

              {error && <div className="mt-4 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">{error}</div>}
            </div>
          </div>
        )}

        {/* Stage: Analyzing */}
        {stage === 'analyzing' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 text-center space-y-6">
              <div className="text-4xl inline-block animate-bounce">📰</div>
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
                <p className="text-xs text-neutral-400 mt-1">Step {currentLoadingStep + 1} of {LOADING_STEPS.length}</p>
              </div>
              <p key={loadingMessage} className="text-sm text-neutral-500 italic animate-fade">{loadingMessage}</p>
              <p className="text-xs text-neutral-400">Usually takes about 15 seconds</p>
            </div>
          </div>
        )}

        {/* Stage: Select Angles */}
        {stage === 'select-angles' && (
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Script Analysis Panel */}
            {scriptAnalysis && <ScriptAnalysisPanel data={scriptAnalysis} />}

            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
              {error && <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
              <PrimeTalkAngleSelector
                topics={topics}
                isLoading={isGenerating}
                onGenerate={handleGenerate}
              />
            </div>
          </div>
        )}

        {/* Stage: Review — Generating */}
        {stage === 'review' && isGenerating && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 text-center space-y-6">
              <div className="text-4xl inline-block animate-bounce">✍️</div>
              <div className="flex justify-center gap-2">
                {(['Writing captions', 'Matching images', 'Rendering cards'] as const).map((step, idx) => (
                  <div
                    key={step}
                    className="h-2 w-4 rounded-full animate-pulse"
                    style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)', animationDelay: `${idx * 0.3}s` }}
                  />
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Generating Posts</p>
                <p className="text-xs text-neutral-400 mt-1">Writing captions, finding images, applying Hotspot brand style</p>
              </div>
              <p key={loadingMessage} className="text-sm text-neutral-500 italic animate-fade">{loadingMessage}</p>
              <p className="text-xs text-neutral-400">Usually takes 30–60 seconds</p>
            </div>
          </div>
        )}

        {/* Stage: Review — Done */}
        {stage === 'review' && !isGenerating && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-neutral-950">Review Posts</h2>
              <p className="text-sm text-neutral-600">Edit and schedule your Prime Talk engagement posts</p>
            </div>

            {error && <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {ideas.map((idea, idx) => (
                <div key={idea.id} className="border rounded-2xl p-4 bg-white border-gray-200">
                  <IdeaCard
                    idea={idea}
                    onUpdateField={handleUpdateIdea}
                    onPhotoSelected={handlePhotoSelected}
                    onScheduleOnFB={handleScheduleOnFB}
                    selectedBrand={BRAND}
                    index={idx}
                    cachedPhotos={{}}
                    downloadPrefix={DOWNLOAD_PREFIX}
                    uploadPreset={uploadPreset}
                    headlineFontSpec="Fonts:方正兰亭特黑简体.ttf_90_bold_normal_center"
                    subtitleFontSpec="Fonts:方正兰亭特黑简体.ttf_38_bold_normal_center"
                    playerLabel="Subject"
                    logoSize={220}
                    showTypeOnImage
                    subtitleY={1130}
                  />
                </div>
              ))}
            </div>

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
                <p className="text-sm text-neutral-600 mt-1">Your generated posts will be lost if you leave.</p>
              </div>
              <button onClick={() => blocker.reset()} className="text-neutral-400 hover:text-neutral-600 transition flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => blocker.reset()} className="flex-1 px-4 py-2.5 border border-neutral-300 text-neutral-950 rounded-lg font-medium hover:bg-neutral-50 transition text-sm">Stay</button>
              <button onClick={() => blocker.proceed()} className="flex-1 px-4 py-2.5 bg-neutral-950 text-white rounded-lg font-medium hover:bg-neutral-800 transition text-sm">Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
