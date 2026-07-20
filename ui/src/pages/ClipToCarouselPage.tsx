import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import JSZip from 'jszip'
import type { BrandName } from '../constants/brands'
import { BRANDS, getBrandHex } from '../constants/brands'
import { useBrand } from '../context/BrandContext'
import { toast } from '../hooks/useToast'
import { uploadToCloudinary } from '../utils/cloudinary'
import { ScheduleModal } from '../components/ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'
import { logHistoryEvent } from '../services/historyLog'
import { trackToolSubmit, trackPostScheduled } from '../utils/analytics'
import { useBrandPath } from '../hooks/useBrandNavigate'
import { BackButton } from '../components/ds'

// ── webhooks (env, with staging fallback so the preview works out-of-the-box) ──
const env = import.meta.env as Record<string, string | undefined>
const WH_ANALYZE = env.VITE_CLIP_TO_CAROUSEL_ANALYZE_WEBHOOK_URL?.trim() || 'https://astroproduct.app.n8n.cloud/webhook/carousel/analyze'
const WH_PROPOSE = env.VITE_CLIP_TO_CAROUSEL_PROPOSE_WEBHOOK_URL?.trim() || 'https://astroproduct.app.n8n.cloud/webhook/carousel/propose'
const WH_RENDER = env.VITE_CLIP_TO_CAROUSEL_RENDER_WEBHOOK_URL?.trim() || 'https://astroproduct.app.n8n.cloud/webhook/carousel/render'
const PUBLISHER = env.VITE_POST_DRAFT_WEBHOOK_URL?.trim() || 'https://astroproduct.app.n8n.cloud/webhook/zernio-post-publisher-staging'
const CLOUD_NAME = env.VITE_CLOUDINARY_CLOUD_NAME

// ── card geometry (matches the composited output) ──
const CARD_W = 1080, CARD_H = 1350, PANE_H = CARD_H / 2
const SUB_FONT = '"Noto Sans","Noto Sans SC","Noto Sans Tamil",sans-serif'

type Cue = { start: number; text: string }
type Topic = { id?: string; title: string; summary: string; start_seconds: number; end_seconds: number }
type Card = { topT: string; topS: string; botT: string; botS: string }

const CODE_LABEL: Record<string, string> = { zh: '中文 (zh)', ms: 'Melayu (ms)', ta: 'தமிழ் (ta)', en: 'English (en)' }
const langLabel = (c?: string) => CODE_LABEL[(c || '').toLowerCase()] || (c || '—')

function s2mmss(sec: number) { sec = Math.max(0, Math.round(+sec || 0)); const m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s }
function mmss2s(t: string) { const p = String(t).split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1] }
function cleanLine(s: string) { return (s || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim() }

// Parse YouTube-Studio .sbv (also .srt/.vtt): a new cue starts on any timecode line,
// text accumulates until the next; [music]/[applause] tags + SRT index lines stripped.
function parseTranscript(text: string): Cue[] {
  text = text.replace(/\r/g, '')
  const TS = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*(?:,|-->)\s*\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}/
  const SKIP = /^(WEBVTT|Transcript|Total entries:.*|Timestamp|Caption)$/i
  const cues: Cue[] = []
  let cur: { start: number; parts: string[] } | null = null
  for (const line of text.split('\n')) {
    const m = line.match(TS)
    if (m) {
      if (cur && cur.parts.length) cues.push({ start: cur.start, text: cleanLine(cur.parts.join(' ')) })
      cur = { start: (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000, parts: [] }
    } else if (cur) {
      const s = line.trim()
      if (s && !/^\d+$/.test(s) && !SKIP.test(s)) cur.parts.push(s)
    }
  }
  if (cur && cur.parts.length) cues.push({ start: cur.start, text: cleanLine(cur.parts.join(' ')) })
  return cues.filter(c => c.text)
}

// ── canvas compositing helpers ──
let _fontsLoaded = false
async function ensureFonts() {
  if (!_fontsLoaded && typeof document !== 'undefined') {
    if (!document.getElementById('ctc-noto')) {
      const l = document.createElement('link'); l.id = 'ctc-noto'; l.rel = 'stylesheet'
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700;800&family=Noto+Sans+SC:wght@400;700;900&family=Noto+Sans+Tamil:wght@400;700&display=swap'
      document.head.appendChild(l)
    }
    _fontsLoaded = true
  }
  try { await Promise.all(['700 44px ' + SUB_FONT, '600 28px "JetBrains Mono"'].map(f => (document as unknown as { fonts: FontFaceSet }).fonts.load(f))) } catch { /* best effort */ }
  try { await (document as unknown as { fonts: FontFaceSet }).fonts.ready } catch { /* ignore */ }
}
function loadImg(src: string) { return new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src }) }
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  const ir = img.width / img.height, dr = dw / dh; let sw, sh, sx, sy
  if (ir > dr) { sh = img.height; sw = sh * dr; sx = (img.width - sw) / 2; sy = 0 } else { sw = img.width; sh = sw / dr; sx = 0; sy = (img.height - sh) / 2 }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}
function fillDark(ctx: CanvasRenderingContext2D, y: number) { const g = ctx.createLinearGradient(0, y, 0, y + PANE_H); g.addColorStop(0, '#2a2320'); g.addColorStop(1, '#0d0a07'); ctx.fillStyle = g; ctx.fillRect(0, y, CARD_W, PANE_H) }
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = String(text || '').split(/\s+/).filter(Boolean); const lines: string[] = []; let cur = ''
  for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w } else cur = test }
  if (cur) lines.push(cur); return lines
}

export function ClipToCarouselPage() {
  const { selectedBrand, isAdmin } = useBrand()
  // Admin has no fixed brand, so the tool provides its own brand picker.
  const [brand, setBrand] = useState<BrandName | ''>(
    (selectedBrand && selectedBrand !== 'Admin') ? (selectedBrand as BrandName) : ''
  )
  const accent = brand ? getBrandHex(brand) : '#18181b'
  const postQueuePath = useBrandPath('/post-queue')

  // hidden video used to grab frames from the uploaded file (never uploaded whole)
  const capVideoRef = useRef<HTMLVideoElement | null>(null)   // hidden <video> rendered in the JSX below
  const capChain = useRef<Promise<unknown>>(Promise.resolve())

  const [videoReady, setVideoReady] = useState(false)
  const [videoName, setVideoName] = useState('')
  const [cues, setCues] = useState<Cue[] | null>(null)
  const [transcriptName, setTranscriptName] = useState('')

  const [phase, setPhase] = useState<'idle' | 'loading' | 'results'>('idle')
  const [loadingSteps, setLoadingSteps] = useState<string[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicIdx, setTopicIdx] = useState<number | null>(null)
  const [liveLang, setLiveLang] = useState('')
  const [busy, setBusy] = useState(false)

  const [cards, setCards] = useState<Card[]>([])
  const [idx, setIdx] = useState(0)
  const [frames, setFrames] = useState<Record<string, string>>({})
  const [caption, setCaption] = useState('')
  const [uploadedUrls, setUploadedUrls] = useState<string[] | null>(null)

  const [showSchedule, setShowSchedule] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [posted, setPosted] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // frame picker
  const [pickerSlot, setPickerSlot] = useState<'top' | 'bot' | null>(null)
  const [fpWhole, setFpWhole] = useState(false)
  const [fpTime, setFpTime] = useState(0)
  const [fpPreview, setFpPreview] = useState<string | null>(null)
  const fpDataUrl = useRef<string | null>(null)

  const topicReady = brand && cues && cues.length   // Analyze needs brand + transcript only (video is used at Generate)
  const total = cards.length
  const cardMissing = (i: number) => !frames[i + '_top'] || !frames[i + '_bot']
  const missingCount = cards.reduce((n, _c, i) => n + (cardMissing(i) ? 1 : 0), 0)
  const shipBlocked = !cards.length || missingCount > 0

  // length banner (both-directional)
  let lengthWarn = ''
  if (videoReady && cues && cues.length && capVideoRef.current?.duration) {
    const dur = capVideoRef.current.duration
    const maxT = cues.reduce((m, c) => Math.max(m, c.start || 0), 0)
    if (Math.abs(dur - maxT) > Math.max(30, 0.2 * Math.max(dur, maxT))) {
      lengthWarn = `Length mismatch — the video is ${s2mmss(dur)} but the transcript ends at ${s2mmss(maxT)}. They may be different files; double-check before generating.`
    }
  }

  function captureFrame(sec: number): Promise<string | null> {
    return new Promise(resolve => {
      const v = capVideoRef.current
      if (!v || !videoReady) return resolve(null)
      if (v.duration && sec > v.duration + 0.5) return resolve(null)   // out of range -> no frame (flagged)
      const onSeeked = () => {
        v.removeEventListener('seeked', onSeeked)
        try {
          const cnv = document.createElement('canvas'); cnv.width = v.videoWidth || 640; cnv.height = v.videoHeight || 360
          cnv.getContext('2d')!.drawImage(v, 0, 0, cnv.width, cnv.height)
          resolve(cnv.toDataURL('image/jpeg', 0.85))
        } catch { resolve(null) }
      }
      v.addEventListener('seeked', onSeeked)
      try { v.currentTime = Math.min(sec, v.duration || sec) } catch { v.removeEventListener('seeked', onSeeked); resolve(null) }
    })
  }
  function captureSerial(sec: number) { const run = capChain.current.then(() => captureFrame(sec)); capChain.current = run.catch(() => {}); return run }

  function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; const v = capVideoRef.current
    if (!f || !v) { setVideoReady(false); setVideoName(''); return }
    setVideoReady(false); setVideoName(f.name + ' · loading…')
    // loadedmetadata fires as soon as the header is read (duration known) — fast + reliable.
    v.onloadedmetadata = () => { setVideoReady(true); setVideoName(`${f.name} · ready (${Math.round(v.duration || 0)}s)`) }
    v.onerror = () => { const code = v.error?.code; setVideoReady(false); setVideoName(`${f.name} · couldn't read (media error ${code ?? '?'})`); toast.error(`Could not read that video (media error ${code ?? '?'}). Try a standard MP4.`) }
    v.src = URL.createObjectURL(f)
    v.load()
  }
  // .docx is a zip; pull the text out of word/document.xml (paragraphs -> newlines).
  async function extractDocxText(file: File): Promise<string> {
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const xml = (await zip.file('word/document.xml')?.async('string')) || ''
    return xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  }
  async function onTranscript(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) { setCues(null); setTranscriptName(''); return }
    try {
      const text = /\.docx$/i.test(f.name) ? await extractDocxText(f) : await f.text()
      const parsed = parseTranscript(text)
      setCues(parsed)
      if (!parsed.length) {
        setTranscriptName(`${f.name} · no timecodes found`)
        toast.error('No timecodes found — the transcript must include timestamps (e.g. the .sbv export from YouTube Studio).')
      } else {
        setTranscriptName(`${f.name} · ${parsed.length} lines`)
      }
    } catch {
      setCues(null); setTranscriptName(''); toast.error('Could not read that transcript file.')
    }
  }

  async function callWebhook(url: string, payload: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return res.json()
  }
  const transcriptPayload = () => (cues || []).map(c => ({ t: c.start, text: c.text }))

  async function handleAnalyze() {
    if (!brand || !topicReady) return
    setBusy(true); setPhase('loading'); setLoadingSteps(['Sending transcript to analyze', 'Detecting language', 'Segmenting topics & timecodes'])
    try {
      const data = await callWebhook(WH_ANALYZE, { brand, language: '', transcript: transcriptPayload() })
      const tps: Topic[] = data.topics || []
      if (!tps.length) throw new Error('No topics returned for this transcript.')
      setTopics(tps); setTopicIdx(null); setLiveLang(data.language || '')
      trackToolSubmit('clip-to-carousel', brand)
      setPhase('idle')
    } catch (e) {
      setTopics([]); setPhase('idle'); toast.error('Analyze failed: ' + (e as Error).message)
    } finally { setBusy(false) }
  }

  async function handleGenerate() {
    if (!brand || topicIdx == null) return
    const tp = topics[topicIdx]
    setBusy(true); setPhase('loading'); setLoadingSteps(['Selecting narrative beats', 'Capturing frames at each timecode', 'Composing cards', 'Writing caption in brand voice'])
    try {
      const proposeRes = await callWebhook(WH_PROPOSE, { brand, language: liveLang, transcript: transcriptPayload(), topics: [tp] })
      const newCards: Card[] = (proposeRes.cards || []).map((c: { top?: { t: number; subtitle: string }; bottom?: { t: number; subtitle: string } }) => ({
        topT: s2mmss(c.top?.t ?? 0), topS: c.top?.subtitle || '', botT: s2mmss(c.bottom?.t ?? 0), botS: c.bottom?.subtitle || '',
      }))
      if (!newCards.length) throw new Error('No cards returned for this topic.')
      const newFrames: Record<string, string> = {}
      for (let i = 0; i < newCards.length; i++) {
        const top = await captureFrame(mmss2s(newCards[i].topT)); if (top) newFrames[i + '_top'] = top
        const bot = await captureFrame(mmss2s(newCards[i].botT)); if (bot) newFrames[i + '_bot'] = bot
      }
      const renderRes = await callWebhook(WH_RENDER, {
        brand, topic_title: tp.title, language: liveLang,
        cards: newCards.map((c, i) => ({ index: i + 1, image_url: 'inbrowser-composite', top_subtitle: c.topS, bottom_subtitle: c.botS })),
      })
      setCards(newCards); setFrames(newFrames); setIdx(0); setCaption(renderRes.caption || ''); setUploadedUrls(null); setPosted(false)
      setPhase('results')
    } catch (e) {
      setPhase('idle'); toast.error('Generate failed: ' + (e as Error).message)
    } finally { setBusy(false) }
  }

  function editCard(field: keyof Card, value: string) { setCards(cs => cs.map((c, i) => i === idx ? { ...c, [field]: value } : c)) }

  // ── composite one card to a 1080x1350 PNG canvas ──
  async function compositeCard(i: number): Promise<HTMLCanvasElement> {
    const c = cards[i]
    const canvas = document.createElement('canvas'); canvas.width = CARD_W; canvas.height = CARD_H
    const ctx = canvas.getContext('2d')!
    const drawPane = async (slot: 'top' | 'bot', y: number, sub: string) => {
      const src = frames[i + '_' + slot]
      if (src && src.startsWith('data:')) { try { drawCover(ctx, await loadImg(src), 0, y, CARD_W, PANE_H) } catch { fillDark(ctx, y) } } else fillDark(ctx, y)
      const g = ctx.createLinearGradient(0, y + PANE_H - 380, 0, y + PANE_H)
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0.85)')
      ctx.fillStyle = g; ctx.fillRect(0, y + PANE_H - 380, CARD_W, 380)
      ctx.font = '700 44px ' + SUB_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2
      const lines = wrapLines(ctx, sub, CARD_W - 160); const lh = 58; let ty = y + PANE_H - 46 - (lines.length - 1) * lh
      for (const ln of lines) { ctx.fillText(ln, CARD_W / 2, ty); ty += lh }
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    }
    await drawPane('top', 0, c.topS)
    await drawPane('bot', PANE_H, c.botS)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, PANE_H - 2, CARD_W, 4)
    // page index (top-right)
    const pidx = (i + 1) + '/' + total
    ctx.font = '600 28px "JetBrains Mono",monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    const pw = ctx.measureText(pidx).width + 36, px = CARD_W - 36 - pw
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, px, 36, pw, 46, 100); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.fillText(pidx, CARD_W - 54, 60)
    return canvas
  }
  const canvasBlob = (cnv: HTMLCanvasElement) => new Promise<Blob>((res, rej) => cnv.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'))

  async function handleDownload() {
    if (shipBlocked) return
    setDownloading(true)
    try {
      await ensureFonts()
      const zip = new JSZip()
      for (let i = 0; i < cards.length; i++) zip.file(String(i + 1).padStart(2, '0') + '-card.png', await canvasBlob(await compositeCard(i)))
      zip.file('caption.txt', caption || '')
      const out = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(out)
      a.download = `clip-carousel-${(brand || 'carousel').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.zip`
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      logHistoryEvent({ eventType: 'downloaded', brand: brand || '', toolPostType: 'carousel', sourcePage: 'clip_to_carousel', caption, status: 'success' })
    } catch (e) { toast.error('Download failed: ' + (e as Error).message) } finally { setDownloading(false) }
  }

  async function handleSchedule(scheduledFor: string, passcode?: string) {
    if (!brand || shipBlocked) return
    const brandLower = brand.toLowerCase()
    const resolvedPass = passcode ?? getCredentials(brandLower)?.passcode ?? ''
    if (!CLOUD_NAME) { toast.error('Cloudinary not configured'); return }
    setIsPosting(true)
    try {
      await ensureFonts()
      const urls: string[] = []
      for (let i = 0; i < cards.length; i++) {
        const blob = await canvasBlob(await compositeCard(i))
        const file = new File([blob], `ctc-${i + 1}.png`, { type: 'image/png' })
        urls.push(`https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${await uploadToCloudinary(file)}`)
      }
      setUploadedUrls(urls)
      const res = await fetch(PUBLISHER, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fb_ai_image_url: urls[0], carousel_images: urls, fb_ai_caption: caption, brand: brandLower, ...(scheduledFor ? { scheduled_for: scheduledFor } : {}), passcode: resolvedPass }),
      })
      const json = await res.json().catch(() => ({})) as { success?: boolean; status?: string; message?: string }
      if (json.status === 'AUTH_ERROR') { clearCredentials(brandLower); setIsPosting(false); toast.error('Invalid passcode.'); return }
      if (json.success === true || json.status === 'SUCCESS' || json.status === 'DRAFT_SAVED') {
        if (passcode) saveCredentials(brandLower, passcode)
        logHistoryEvent({ eventType: 'scheduled', brand, toolPostType: 'carousel', sourcePage: 'clip_to_carousel', caption, imageUrl: urls[0], scheduledFor, status: 'success' })
        trackPostScheduled('clip-to-carousel', brand)
        setIsPosting(false); setShowSchedule(false); setPosted(true); toast.success('Carousel scheduled on Facebook!')
        return
      }
      throw new Error(json.message || 'Something went wrong.')
    } catch (e) { setIsPosting(false); toast.error('Schedule failed: ' + (e as Error).message) }
  }

  // ── frame picker ──
  const topicRange = () => {
    const tp = topicIdx != null ? topics[topicIdx] : null
    if (tp && tp.end_seconds > tp.start_seconds) return { start: tp.start_seconds, end: tp.end_seconds }
    const dur = capVideoRef.current?.duration || 60
    return { start: 0, end: dur }
  }
  const pickRange = () => { const dur = capVideoRef.current?.duration || 0; const r = topicRange(); return (fpWhole || !r) ? { start: 0, end: dur || r.end } : r }
  function openPicker(slot: 'top' | 'bot') {
    if (!cards.length) return
    setPickerSlot(slot); setFpWhole(false); fpDataUrl.current = null
    const r = pickRange(); const c = cards[idx]; let def = mmss2s(slot === 'top' ? c.topT : c.botT); if (!(def >= r.start && def <= r.end)) def = r.start
    setFpTime(def); void previewAt(def)
  }
  async function previewAt(sec: number) { setFpTime(sec); const url = await captureSerial(sec); fpDataUrl.current = url; setFpPreview(url) }
  function assignFrame(slot: 'top' | 'bot') { if (!fpDataUrl.current) return; setFrames(f => ({ ...f, [idx + '_' + slot]: fpDataUrl.current as string })); setPickerSlot(null) }

  const fieldBase = 'w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900'

  // Admin-only tool: non-admins never see the CTA, and can't reach it via direct URL either.
  if (!isAdmin) {
    return (
      <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6"><BackButton /></div>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
            Clip to Carousel is currently available in <b>Admin</b> mode only.
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      {/* off-screen (not display:none — Chrome won't decode a display:none video for canvas capture) */}
      <video ref={capVideoRef} muted playsInline preload="auto"
        style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', zIndex: -1 }} />
      <style>{`
        .ctc-card{aspect-ratio:4/5;border-radius:14px;overflow:hidden;position:relative;display:flex;flex-direction:column;box-shadow:0 18px 44px #00000033;background:#0d0a07}
        .ctc-pane{flex:1;position:relative;overflow:hidden;display:flex;align-items:flex-end}
        .ctc-pane img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .ctc-sub{position:relative;z-index:2;width:100%;padding:14px 16px 18px;color:#fff;font-weight:700;font-size:15px;line-height:1.32;text-align:center;background:linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.42) 55%,transparent);text-shadow:0 1px 4px rgba(0,0,0,.5)}
        .ctc-pidx{position:absolute;top:13px;right:13px;z-index:5;font-family:'JetBrains Mono',monospace;font-size:11px;color:#fff;background:rgba(0,0,0,.45);padding:2px 9px;border-radius:100px}
        .ctc-seam{height:2px;background:rgba(0,0,0,.55)}
        .ctc-nobadge{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:6;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;color:#7c2d12;background:#fcd34d;padding:3px 10px;border-radius:100px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)}
        .ctc-loader{width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#ff3fbf,#00e5d4,#0055ee,#f05a35);background-size:300% 300%;box-shadow:0 10px 30px rgba(0,0,0,.15);animation:ctc-shift 3s ease infinite,ctc-pulse 1.6s ease-in-out infinite}
        @keyframes ctc-shift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes ctc-pulse{0%,100%{transform:scale(1);opacity:.92}50%{transform:scale(1.08);opacity:1}}
        .ctc-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto}
        .ctc-step{animation:ctc-fade 1.5s ease-in-out infinite}
        @keyframes ctc-fade{0%,100%{opacity:.4}50%{opacity:1}}
        .ctc-shimmer{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);background-size:200% 100%;animation:ctc-sweep 1.8s linear infinite}
        @keyframes ctc-sweep{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media (prefers-reduced-motion: reduce){.ctc-loader,.ctc-step,.ctc-shimmer{animation:none}.ctc-shimmer{display:none}}
      `}</style>

      <div className="max-w-6xl mx-auto">
        <div className="mb-6"><BackButton /></div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Clip to Carousel</h1>
          <p className="text-neutral-500 mt-1.5">Turn a video clip into a swipeable subtitle carousel in your brand's voice{brand ? ` — ${brand}` : ''}.</p>
          <div className="h-[3px] mt-4 rounded-full" style={{ background: accent }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT: inputs */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-neutral-200">
            <label className="block text-base font-semibold text-neutral-900">Brand</label>
            <div className="relative mt-3 mb-5">
              <select value={brand} onChange={e => setBrand(e.target.value as BrandName)}
                className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900">
                <option value="">Select a brand…</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">▾</span>
            </div>

            <label className="block text-base font-semibold text-neutral-900">Video file</label>
            <label className="mt-3 flex items-center gap-3 px-4 py-3.5 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-900 cursor-pointer transition">
              <span className="text-lg">🎞️</span>
              <span className="flex-1 text-sm text-neutral-500">{videoName || 'Upload the episode video file'}</span>
              <input type="file" accept="video/*" className="hidden" onChange={onVideo} />
            </label>
            <p className="text-xs text-neutral-500 mt-1.5">Frames are captured in your browser at each timecode — the video never leaves your device.</p>

            <label className="block text-base font-semibold text-neutral-900 mt-5">Transcript file <span className="text-neutral-400 font-normal text-sm">(.sbv / .srt / .vtt / .txt / .docx — must include timecodes)</span></label>
            <label className="mt-3 flex items-center gap-3 px-4 py-3.5 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-900 cursor-pointer transition">
              <span className="text-lg">📄</span>
              <span className="flex-1 text-sm text-neutral-500">{transcriptName || 'Click to upload your transcript'}</span>
              <input type="file" accept=".sbv,.vtt,.srt,.txt,.docx" className="hidden" onChange={onTranscript} />
            </label>

            {lengthWarn && <div className="mt-4 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 leading-snug">⚠ {lengthWarn}</div>}

            <button disabled={!topicReady || busy} onClick={handleAnalyze}
              className="mt-6 w-full px-5 py-3.5 rounded-xl text-base font-medium transition disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 bg-neutral-900 text-white hover:bg-black">
              {busy && phase === 'loading' && !topics.length ? 'Analyzing…' : 'Analyze clip'}
            </button>

            {topics.length > 0 && (
              <div className="mt-7 pt-6 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-base font-semibold text-neutral-900">Pick a topic</label>
                  <span className="text-xs font-mono text-neutral-500">Video Language: {langLabel(liveLang)}</span>
                </div>
                <div className="space-y-2.5">
                  {topics.map((t, i) => (
                    <button key={i} onClick={() => setTopicIdx(i)}
                      className={'w-full text-left bg-white border rounded-xl px-4 py-3 transition ' + (topicIdx === i ? 'border-neutral-900 ring-2 ring-neutral-900' : 'border-neutral-200 hover:border-neutral-400')}>
                      <div className="text-[11px] font-mono" style={{ color: accent }}>{s2mmss(t.start_seconds)} – {s2mmss(t.end_seconds)}</div>
                      <div className="text-sm font-semibold text-neutral-900 mt-1">{t.title}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{t.summary}</div>
                    </button>
                  ))}
                </div>
                <button disabled={topicIdx == null || !videoReady || busy} onClick={handleGenerate}
                  className="mt-5 w-full px-5 py-3.5 rounded-xl text-base font-medium transition disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 bg-neutral-900 text-white hover:bg-black">
                  {busy && phase === 'loading' && topics.length ? 'Generating…' : 'Generate carousel'}
                </button>
                {topicIdx != null && !videoReady && <p className="mt-2 text-xs text-neutral-500">Upload the video file above to generate frames.</p>}
              </div>
            )}
          </div>

          {/* RIGHT: preview */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-neutral-200">
            {phase === 'idle' && (
              <div className="aspect-[4/5] rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200 border border-neutral-200 flex items-center justify-center text-center px-8">
                <div><p className="text-lg text-neutral-700 font-semibold">Preview will appear here</p><p className="text-sm text-neutral-500 mt-1">Upload the clip + transcript, analyze, then generate.</p></div>
              </div>
            )}
            {phase === 'loading' && (
              <div className="aspect-[4/5] rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-200 border border-neutral-200 flex items-center justify-center overflow-hidden relative">
                <div className="ctc-shimmer" />
                <div className="text-center px-8 relative">
                  <div className="ctc-loader mx-auto mb-4" />
                  <p className="text-lg font-semibold text-neutral-800">Building your carousel…</p>
                  <div className="mt-4 inline-block text-left space-y-2 text-xs text-neutral-600">
                    {loadingSteps.map((s, i) => (
                      <div key={i} className="ctc-step flex items-center gap-2" style={{ animationDelay: `${i * 0.28}s` }}>
                        <span className="ctc-dot" style={{ background: ['#10b981', '#ec4899', '#3b82f6', '#f59e0b'][i % 4] }} />
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {phase === 'results' && cards[idx] && (
              <>
                <div className="ctc-card">
                  <div className="ctc-pidx">{idx + 1}/{total}</div>
                  {(['top', 'bot'] as const).map((slot, si) => (
                    <div key={slot} className="ctc-pane" style={si === 1 ? undefined : undefined}>
                      {frames[idx + '_' + slot] ? <img src={frames[idx + '_' + slot]} alt="" /> : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#2a2320,#0d0a07)' }} />}
                      {!frames[idx + '_' + slot] && <span className="ctc-nobadge">⚠ no frame — pick one</span>}
                      <div className="ctc-sub">{slot === 'top' ? cards[idx].topS : cards[idx].botS}</div>
                      {si === 0 && <div className="ctc-seam" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />}
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => openPicker('top')} className="px-3 py-2.5 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-900 text-xs text-neutral-700 transition">🎞 Pick top frame</button>
                  <button onClick={() => openPicker('bot')} className="px-3 py-2.5 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-900 text-xs text-neutral-700 transition">🎞 Pick bottom frame</button>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                  <span className="font-mono">{idx + 1} / {total}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} className="w-7 h-7 rounded-lg border border-neutral-300 hover:bg-neutral-100 disabled:opacity-30">‹</button>
                    <button onClick={() => setIdx(i => Math.min(total - 1, i + 1))} disabled={idx === total - 1} className="w-7 h-7 rounded-lg border border-neutral-300 hover:bg-neutral-100 disabled:opacity-30">›</button>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {cards.map((_c, i) => (
                    <button key={i} onClick={() => setIdx(i)} title={`Card ${i + 1}${cardMissing(i) ? ' — needs a frame' : ''}`}
                      className={'relative shrink-0 w-12 rounded-lg overflow-hidden border-2 ' + (cardMissing(i) ? 'border-amber-400' : (i === idx ? 'border-neutral-900' : 'border-transparent opacity-70 hover:opacity-100'))} style={{ aspectRatio: '4/5' }}>
                      <div style={{ position: 'relative', height: '50%', overflow: 'hidden', background: '#0d0a07' }}>{frames[i + '_top'] && <img src={frames[i + '_top']} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                      <div style={{ position: 'relative', height: '50%', overflow: 'hidden', background: '#0d0a07' }}>{frames[i + '_bot'] && <img src={frames[i + '_bot']} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                      {cardMissing(i) && <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 9, background: '#fbbf24', color: '#7c2d12', borderRadius: 100, padding: '1px 3px' }}>⚠</span>}
                    </button>
                  ))}
                </div>

                <div className="mt-5 space-y-2.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-neutral-600">Subtitles on this card</label>
                  <div className="flex gap-2"><input readOnly title="Timecode — set via 'Pick frame'" className={fieldBase + ' w-20 text-center font-mono text-xs bg-neutral-100 text-neutral-500 cursor-default'} value={cards[idx].topT} /><input className={fieldBase} value={cards[idx].topS} onChange={e => editCard('topS', e.target.value)} placeholder="Top subtitle" /></div>
                  <div className="flex gap-2"><input readOnly title="Timecode — set via 'Pick frame'" className={fieldBase + ' w-20 text-center font-mono text-xs bg-neutral-100 text-neutral-500 cursor-default'} value={cards[idx].botT} /><input className={fieldBase} value={cards[idx].botS} onChange={e => editCard('botS', e.target.value)} placeholder="Bottom subtitle" /></div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5"><label className="text-xs font-mono uppercase tracking-wider text-neutral-600">Caption</label><span className="text-xs font-mono text-neutral-400">{caption.length}</span></div>
                  <textarea rows={5} className={fieldBase + ' resize-y'} value={caption} onChange={e => setCaption(e.target.value)} />
                </div>

                {shipBlocked && missingCount > 0 && (
                  <div className="mt-4 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 leading-snug">
                    ⚠ <b>{missingCount} card{missingCount > 1 ? 's' : ''} missing a frame.</b> Use <b>Pick frame</b> on each flagged card before you can Download or Schedule.
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button disabled={shipBlocked || downloading} onClick={handleDownload} className="px-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-medium hover:bg-neutral-100 transition disabled:opacity-50 disabled:cursor-not-allowed">{downloading ? 'Preparing…' : '⬇ Download All'}</button>
                  <button disabled={shipBlocked || isPosting} onClick={() => setShowSchedule(true)} className="px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed">{isPosting ? 'Scheduling…' : 'Schedule Post'}</button>
                </div>

                {posted && (
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

                {uploadedUrls && (
                  <div className="mt-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-3 break-all">
                    <div className="font-semibold text-neutral-800 mb-1.5">✓ {uploadedUrls.length} cards uploaded</div>
                    {uploadedUrls.map((u, i) => <div key={i} className="mt-0.5"><span className="text-neutral-400 font-mono">card {i + 1}</span> <a href={u} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{u}</a></div>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* frame picker modal */}
      {pickerSlot && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => { if (e.target === e.currentTarget) setPickerSlot(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1"><h3 className="text-lg font-semibold text-neutral-900">Pick a frame from the timeline</h3><button onClick={() => setPickerSlot(null)} className="text-neutral-400 hover:text-neutral-900 text-2xl leading-none">×</button></div>
            <p className="text-xs text-neutral-500 mb-3">Scrub to a moment where the right speaker is on screen, then set it as the top or bottom frame.</p>
            <div className="aspect-video rounded-xl overflow-hidden bg-neutral-900 relative flex items-center justify-center text-neutral-400 text-sm">
              {fpPreview ? <img src={fpPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="text-xs">scrub to preview a frame</span>}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-mono text-neutral-500">
              <span>Topic {s2mmss(pickRange().start)} – {s2mmss(pickRange().end)}</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none"><input type="checkbox" checked={fpWhole} onChange={e => setFpWhole(e.target.checked)} className="accent-neutral-900" /> whole clip</label>
              <span className="text-neutral-900 font-semibold">{s2mmss(fpTime)}</span>
            </div>
            <input type="range" min={pickRange().start} max={pickRange().end} step={1} value={fpTime} onChange={e => void previewAt(+e.target.value)} className="w-full mt-2 accent-neutral-900 cursor-pointer" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => assignFrame('top')} className={'px-4 py-2.5 rounded-xl border text-sm font-medium transition ' + (pickerSlot === 'top' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 hover:bg-neutral-100')}>Set as TOP frame</button>
              <button onClick={() => assignFrame('bot')} className={'px-4 py-2.5 rounded-xl border text-sm font-medium transition ' + (pickerSlot === 'bot' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 hover:bg-neutral-100')}>Set as BOTTOM frame</button>
            </div>
          </div>
        </div>, document.body)}

      {/* schedule modal (shared component) */}
      {showSchedule && brand && createPortal(
        <ScheduleModal
          brand={brand}
          hasCredentials={!!getCredentials(brand.toLowerCase())}
          isPosting={isPosting}
          onConfirm={(sf, passcode) => void handleSchedule(sf, passcode)}
          onClose={() => setShowSchedule(false)}
        />, document.body)}
    </main>
  )
}
