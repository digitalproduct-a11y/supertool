import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import JSZip from 'jszip'
import { toast } from '../../hooks/useToast'
import { useBrandPath } from '../../hooks/useBrandNavigate'
import { ScheduleModal } from '../../components/ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../../utils/fbCredentials'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { logHistoryEvent } from '../../services/historyLog'
import type { QuickFactData, QuickFactItem } from '../../types'
import {
  QuickFactSlideCanvas,
  type QuickFactSlideCanvasHandle,
  type QuickFactSlide,
} from './QuickFactSlideCanvas'

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined

// ── source / date helpers (mirror the n8n Build QuickFact Data formatting) ──
function urlToDomain(url: string): string {
  if (!url) return ''
  let s = url.trim()
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    return new URL(s).hostname.replace(/^www\./i, '').toUpperCase()
  } catch {
    return ''
  }
}

function formatDate(category: string): string {
  const now = new Date()
  const d = now.getDate()
  const y = now.getFullYear()
  if (category === 'Chinese') return `${y}年${now.getMonth() + 1}月${d}日`
  const months =
    category === 'Malay'
      ? ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER']
      : ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
  return `${d} ${months[now.getMonth()]} ${y}`
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob()
  return new File([blob], name, { type: 'image/png' })
}

interface QuickFactCarouselViewProps {
  data: QuickFactData
  brand: string
  articleUrl: string
  caption: string
  scheduledFor: string
  onCaptionChange: (v: string) => void
  /** Tighter single-column layout for the bulk grid. */
  compact?: boolean
}

export function QuickFactCarouselView({
  data,
  brand,
  articleUrl,
  caption,
  scheduledFor,
  onCaptionChange,
  compact = false,
}: QuickFactCarouselViewProps) {
  // Editable model
  const [title, setTitle] = useState(data.title)
  const [summary, setSummary] = useState(data.summary)
  const [facts, setFacts] = useState<QuickFactItem[]>(data.facts ?? [])
  const [heroSource, setHeroSource] = useState(data.heroPublicId || data.heroUrl)

  const [active, setActive] = useState(0)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<'idle' | 'posted' | 'error'>('idle')
  const postQueuePath = useBrandPath('/post-queue')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const slideRefs = useRef<Array<QuickFactSlideCanvasHandle | null>>([])

  const domain = useMemo(() => urlToDomain(articleUrl), [articleUrl])
  const dateStr = useMemo(() => formatDate(data.category), [data.category])

  const slides: QuickFactSlide[] = useMemo(() => {
    // Cover chip is derived: "<count> <sectionLabel>" e.g. "5 FAKTA RINGKAS".
    const chip = `${facts.length} ${data.sectionLabel}`.trim()
    const cover: QuickFactSlide = { kind: 'cover', title, summary, keyPhrase: chip, heroSource }
    const factSlides: QuickFactSlide[] = facts.map((f, i) => ({
      kind: 'fact',
      index: i,
      header: f.header,
      body: f.body,
      sectionLabel: data.sectionLabel,
    }))
    return [cover, factSlides].flat()
  }, [title, summary, heroSource, facts, data.sectionLabel])

  const total = slides.length

  function updateFact(i: number, patch: Partial<QuickFactItem>) {
    setFacts(prev => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadLoading(true)
    try {
      const publicId = await uploadToCloudinary(file)
      setHeroSource(publicId)
      toast.success('Hero image updated!')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadLoading(false)
    }
  }

  // Export every slide canvas to a PNG data URL (in slide order).
  function exportDataUrls(): string[] {
    const urls: string[] = []
    for (let i = 0; i < total; i++) {
      const url = slideRefs.current[i]?.getDataUrl()
      if (url) urls.push(url)
    }
    return urls
  }

  async function handleDownloadAll() {
    setExporting(true)
    try {
      const urls = exportDataUrls()
      if (urls.length !== total) throw new Error('Some slides are still rendering — try again in a moment.')
      const zip = new JSZip()
      for (let i = 0; i < urls.length; i++) {
        const blob = await (await fetch(urls[i])).blob()
        const name = i === 0 ? '01-cover.png' : `${String(i + 1).padStart(2, '0')}-fact.png`
        zip.file(name, blob)
      }
      const out = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(out)
      a.download = `quickfact-${brand.toLowerCase()}-${Date.now()}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleSchedule(when: string, passcode?: string) {
    const brandLower = brand.toLowerCase()
    const resolvedPasscode = passcode ?? getCredentials(brandLower)?.passcode ?? ''
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl) {
      toast.error('Post webhook not configured')
      return
    }
    if (!CLOUD_NAME) {
      toast.error('Cloudinary cloud name not configured')
      return
    }
    setIsPosting(true)
    setShowSchedule(false)
    try {
      const dataUrls = exportDataUrls()
      if (dataUrls.length !== total) throw new Error('Slides still rendering — try again in a moment.')

      // Upload each slide PNG to Cloudinary → hosted URL for Facebook.
      const imageUrls: string[] = []
      for (let i = 0; i < dataUrls.length; i++) {
        const file = await dataUrlToFile(dataUrls[i], `qf-${i + 1}.png`)
        const publicId = await uploadToCloudinary(file)
        imageUrls.push(`https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}`)
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url: imageUrls[0],
          carousel_images: imageUrls,
          fb_ai_caption: caption,
          brand: brandLower,
          ...(when ? { scheduled_for: when } : {}),
          passcode: resolvedPasscode,
        }),
      })
      const json = (await res.json()) as { success?: boolean; status?: string; message?: string }
      if (json.status === 'AUTH_ERROR') {
        clearCredentials(brandLower)
        setIsPosting(false)
        setShowSchedule(true)
        toast.error('Invalid passcode.')
        return
      }
      if (json.success === true || json.status === 'SUCCESS' || json.status === 'DRAFT_SAVED') {
        if (passcode) saveCredentials(brandLower, passcode)
        logHistoryEvent({
          eventType: 'scheduled', brand, toolPostType: 'quickfact', sourcePage: 'cms',
          articleUrl, title, caption, imageUrl: imageUrls[0], scheduledFor: when, status: 'success',
        })
        setIsPosting(false)
        setPostStatus('posted')
        toast.success('Quick Fact carousel scheduled!')
        return
      }
      throw new Error(json.message ?? 'Something went wrong.')
    } catch (err) {
      setIsPosting(false)
      setPostStatus('error')
      toast.error(err instanceof Error ? err.message : 'Post failed')
    }
  }

  // ── preview (shared by both layouts): all slides mounted; only active shown ──
  const preview = (
    <div className="space-y-3">
      <div className="relative">
        {slides.map((slide, i) => (
          <div key={i} style={{ display: i === active ? 'block' : 'none' }}>
            <QuickFactSlideCanvas
              ref={el => { slideRefs.current[i] = el }}
              slide={slide}
              brand={brand}
              brandHex={data.brandHex}
              logoPublicId={data.logoPublicId}
              fontUse={data.fontUse}
              category={data.category}
              domain={domain}
              dateStr={dateStr}
            />
          </div>
        ))}
        {/* prev / next */}
        {total > 1 && (
          <>
            <button type="button" onClick={() => setActive(a => (a - 1 + total) % total)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white text-lg flex items-center justify-center hover:bg-black/75 transition">‹</button>
            <button type="button" onClick={() => setActive(a => (a + 1) % total)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white text-lg flex items-center justify-center hover:bg-black/75 transition">›</button>
          </>
        )}
      </div>
      {/* slide pager */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {slides.map((_, i) => (
          <button key={i} type="button" onClick={() => setActive(i)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              i === active ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}>
            {i === 0 ? 'Cover' : `Fact ${i}`}
          </button>
        ))}
      </div>
      {/* image + download actions */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition disabled:opacity-50">
          {uploadLoading ? 'Uploading…' : 'Replace Hero Image'}
        </button>
        <button onClick={handleDownloadAll} disabled={exporting}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition disabled:opacity-50">
          {exporting ? 'Preparing…' : 'Download All'}
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
    </div>
  )

  // ── editable fields ──
  const fields = (
    <div className="space-y-5">
      {/* Cover */}
      <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5 space-y-3">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Cover Slide</p>
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">Summary</label>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <p className="text-xs text-neutral-400">
          Cover chip auto-set to “{facts.length} {data.sectionLabel}”.
        </p>
      </div>

      {/* Facts */}
      <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Fact Slides ({facts.length})</p>
        </div>
        <div className="divide-y divide-neutral-100">
          {facts.map((fact, i) => (
            <div key={i} className="px-5 py-4 flex gap-4 items-start">
              <button type="button" onClick={() => setActive(i + 1)}
                className="text-xl font-black text-neutral-300 leading-none mt-0.5 w-8 flex-shrink-0 tabular-nums hover:text-neutral-900 transition">
                {String(i + 1).padStart(2, '0')}
              </button>
              <div className="flex-1 space-y-2">
                <input type="text" value={fact.header}
                  onChange={e => updateFact(i, { header: e.target.value })}
                  placeholder="HEADER"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-800" />
                <textarea value={fact.body} rows={2}
                  onChange={e => updateFact(i, { body: e.target.value })}
                  placeholder="Fact body text…"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-600" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Caption */}
      <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Caption</p>
          <span className="text-xs text-gray-400">{caption.length}/600</span>
        </div>
        <textarea value={caption} onChange={e => onCaptionChange(e.target.value.slice(0, 600))} rows={6}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 leading-relaxed" />
      </div>

      {/* Schedule */}
      <button type="button" onClick={() => setShowSchedule(true)} disabled={isPosting}
        className="w-full px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
        {isPosting ? 'Scheduling…' : 'Schedule Post'}
      </button>
      {postStatus === 'posted' && (
        <div className="text-center space-y-1 mt-1">
          <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
          <p className="text-xs text-neutral-400">
            To view or delete your scheduled post, check{' '}
            <Link to={postQueuePath} className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
              here
            </Link>.
          </p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {showSchedule && (
        <ScheduleModal
          brand={brand}
          hasCredentials={!!getCredentials(brand.toLowerCase())}
          isPosting={isPosting}
          defaultScheduledFor={scheduledFor}
          onConfirm={handleSchedule}
          onClose={() => setShowSchedule(false)}
        />
      )}
      {compact ? (
        <div className="space-y-4">
          {preview}
          {fields}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-5">{fields}</div>
          <div className="lg:sticky lg:top-6">{preview}</div>
        </div>
      )}
    </>
  )
}
