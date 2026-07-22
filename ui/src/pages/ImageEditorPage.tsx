import { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BackButton } from '../components/ds'
import { FabricCropPicker } from '../features/photo/FabricCropPicker'
import type { CropRegion } from '../features/quote/ImageCropAdjuster'
import { useBrand } from '../context/BrandContext'
import { IMAGE_PROVIDER } from '../utils/imageProvider'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'crop' | 'collage'

type AspectRatio = { label: string; w: number; h: number }
type CollageLayout = { id: string; label: string; slots: number; grid: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const ASPECT_RATIOS: AspectRatio[] = [
  { label: '16:9', w: 16, h: 9 },
  { label: '9:16', w: 9, h: 16 },
  { label: '1:1', w: 1, h: 1 },
  { label: '4:5', w: 4, h: 5 },
  { label: '3:4', w: 3, h: 4 },
  { label: '4:3', w: 4, h: 3 },
]


const COLLAGE_LAYOUTS: CollageLayout[] = [
  { id: 'overlay', label: '1 + Rounded Overlay', slots: 2, grid: '1fr' },
  { id: '2-side', label: '2 Side by Side', slots: 2, grid: '1fr 1fr' },
  { id: '2-stack', label: '2 Stacked', slots: 2, grid: '1fr' },
  { id: '3-left', label: '3 — Left Feature', slots: 3, grid: '2fr 1fr' },
  { id: '3-grid', label: '3 Grid', slots: 3, grid: '1fr 1fr 1fr' },
  { id: '4-grid', label: '4 Grid', slots: 4, grid: '1fr 1fr' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result as string)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

async function callEnhanceWebhook(file: File, brand: string): Promise<string> {
  const url =
    IMAGE_PROVIDER === 'imagekit'
      ? import.meta.env.VITE_IMAGE_ENHANCE_WEBHOOK_URL_IMAGEKIT
      : import.meta.env.VITE_IMAGE_ENHANCE_WEBHOOK_URL
  if (!url) throw new Error('VITE_IMAGE_ENHANCE_WEBHOOK_URL is not set')
  const base64 = await fileToBase64(file)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, filename: file.name, brand }),
  })
  if (!res.ok) throw new Error('Enhancement failed')
  const data = await res.json()
  return data.imageUrl as string
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const srcAR = img.naturalWidth / img.naturalHeight
  const dstAR = dw / dh
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
  if (srcAR > dstAR) {
    sw = img.naturalHeight * dstAR
    sx = (img.naturalWidth - sw) / 2
  } else {
    sh = img.naturalWidth / dstAR
    sy = (img.naturalHeight - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

function getSlotAspectRatio(layout: CollageLayout, slotIndex: number, w: number, h: number): number {
  const gap = 0
  switch (layout.id) {
    case '2-side': return ((w - gap) / 2) / h
    case '2-stack': return w / ((h - gap) / 2)
    case '3-left': {
      const leftW = Math.round(w * 2 / 3) - gap / 2
      const rightW = w - leftW - gap
      return slotIndex === 0 ? leftW / h : rightW / ((h - gap) / 2)
    }
    case '3-grid': return ((w - gap * 2) / 3) / h
    case '4-grid': return ((w - gap) / 2) / ((h - gap) / 2)
    case 'overlay': return slotIndex === 0 ? w / h : 1
    default: return 1
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function UploadSlot({
  url,
  onFile,
  label,
}: {
  url: string | null
  onFile: (f: File) => void
  label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false)
        const f = e.dataTransfer.files[0]
        if (f?.type.startsWith('image/')) onFile(f)
      }}
      onClick={() => ref.current?.click()}
      className={`w-full h-full min-h-[120px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
        drag ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
      }`}
    >
      {url ? (
        <img src={url} alt="slot" className="w-full h-full object-cover rounded-xl" />
      ) : (
        <>
          <svg className="w-6 h-6 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          {label && <p className="text-xs text-neutral-400">{label}</p>}
        </>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ImageEditorPage() {
  const { selectedBrand } = useBrand()
  const [tab, setTab] = useState<Tab>('crop')

  // ── Crop state
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropUrl, setCropUrl] = useState<string | null>(null)
  const [cropRatio, setCropRatio] = useState<AspectRatio>(ASPECT_RATIOS[0])
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null)
  const [showCropPicker, setShowCropPicker] = useState(false)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)

  // ── Enhance state
  const [cropEnhancing, setCropEnhancing] = useState(false)
  const [enhancingSlots, setEnhancingSlots] = useState<Set<number>>(new Set())

  // ── Collage state
  const [collageLayout, setCollageLayout] = useState<CollageLayout>(COLLAGE_LAYOUTS[0])
  const [collageFiles, setCollageFiles] = useState<(File | null)[]>([null, null])
  const [collageUrls, setCollageUrls] = useState<(string | null)[]>([null, null])
  const [collageCropRegions, setCollageCropRegions] = useState<(CropRegion | null)[]>([null, null])
  const [adjustingSlot, setAdjustingSlot] = useState<number | null>(null)
  const [collageRatio, setCollageRatio] = useState<AspectRatio>(ASPECT_RATIOS[0])
  const collageCanvasRef = useRef<HTMLCanvasElement>(null)

  const BASE = 1080
  const collageW = collageRatio.w >= collageRatio.h ? BASE : Math.round(BASE * collageRatio.w / collageRatio.h)
  const collageH = collageRatio.w >= collageRatio.h ? Math.round(BASE * collageRatio.h / collageRatio.w) : BASE

  // ── Crop render
  const renderCrop = useCallback(async () => {
    if (!cropUrl || !cropCanvasRef.current) return
    const aw = cropRatio.w
    const ah = cropRatio.h
    const BASE = 1080
    const cw = aw >= ah ? BASE : Math.round(BASE * aw / ah)
    const ch = aw >= ah ? Math.round(BASE * ah / aw) : BASE
    const canvas = cropCanvasRef.current
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')!
    const img = await loadImage(cropUrl)
    if (cropRegion) {
      ctx.drawImage(img, cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height, 0, 0, cw, ch)
    } else {
      drawCover(ctx, img, 0, 0, cw, ch)
    }
  }, [cropUrl, cropRatio, cropRegion])

  useEffect(() => { renderCrop() }, [renderCrop])

  // ── Collage render
  const renderCollage = useCallback(async () => {
    if (!collageCanvasRef.current) return
    const w = collageW
    const h = collageH
    const canvas = collageCanvasRef.current
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, w, h)

    const gap = 0
    const urls = collageUrls
    const regions = collageCropRegions
    const layout = collageLayout

    const drawSlot = async (i: number, dx: number, dy: number, dw: number, dh: number) => {
      if (!urls[i]) return
      const img = await loadImage(urls[i]!)
      const region = regions[i]
      if (region) {
        ctx.drawImage(img, region.x, region.y, region.width, region.height, dx, dy, dw, dh)
      } else {
        drawCover(ctx, img, dx, dy, dw, dh)
      }
    }

    if (layout.id === '2-side') {
      const sw = (w - gap) / 2
      for (let i = 0; i < 2; i++) await drawSlot(i, i * (sw + gap), 0, sw, h)
    } else if (layout.id === '2-stack') {
      const sh = (h - gap) / 2
      for (let i = 0; i < 2; i++) await drawSlot(i, 0, i * (sh + gap), w, sh)
    } else if (layout.id === '3-left') {
      const leftW = Math.round(w * 2 / 3) - gap / 2
      const rightW = w - leftW - gap
      const sh = (h - gap) / 2
      await drawSlot(0, 0, 0, leftW, h)
      await drawSlot(1, leftW + gap, 0, rightW, sh)
      await drawSlot(2, leftW + gap, sh + gap, rightW, sh)
    } else if (layout.id === '3-grid') {
      const sw = (w - gap * 2) / 3
      for (let i = 0; i < 3; i++) await drawSlot(i, i * (sw + gap), 0, sw, h)
    } else if (layout.id === '4-grid') {
      const sw = (w - gap) / 2
      const sh = (h - gap) / 2
      for (let i = 0; i < 4; i++) await drawSlot(i, (i % 2) * (sw + gap), Math.floor(i / 2) * (sh + gap), sw, sh)
    } else if (layout.id === 'overlay') {
      // Background — full canvas
      await drawSlot(0, 0, 0, w, h)
      // Circle overlay — centered, ~40% of shorter side
      if (urls[1]) {
        const r = Math.round(Math.min(w, h) * 0.18)
        const cx = Math.round(w * 0.22)
        const cy = Math.round(h * 0.28)
        const img = await loadImage(urls[1])
        const region = regions[1]
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.clip()
        if (region) {
          ctx.drawImage(img, region.x, region.y, region.width, region.height, cx - r, cy - r, r * 2, r * 2)
        } else {
          drawCover(ctx, img, cx - r, cy - r, r * 2, r * 2)
        }
        ctx.restore()
        // White border ring
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = 'white'
        ctx.lineWidth = Math.round(w * 0.004)
        ctx.stroke()
      }
    }
  }, [collageUrls, collageCropRegions, collageLayout, collageW, collageH])

  useEffect(() => { renderCollage() }, [renderCollage])

  // ── Slot count sync
  useEffect(() => {
    const n = collageLayout.slots
    setCollageFiles((prev) => { const arr = [...prev]; while (arr.length < n) arr.push(null); return arr.slice(0, n) })
    setCollageUrls((prev) => { const arr = [...prev]; while (arr.length < n) arr.push(null); return arr.slice(0, n) })
    setCollageCropRegions((prev) => { const arr = [...prev]; while (arr.length < n) arr.push(null); return arr.slice(0, n) })
  }, [collageLayout])

  // ── Download helpers
  const download = (canvas: HTMLCanvasElement | null, name: string) => {
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'crop', label: 'Crop' },
    { id: 'collage', label: 'Collage' },
  ]

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <BackButton />
            <h1 className="text-2xl font-semibold text-neutral-950">Image Editor</h1>
          </div>
          <p className="text-sm text-neutral-600">Resize, crop, and create image collages — then download.</p>
          <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl mb-8 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white text-neutral-950 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── CROP TAB ──────────────────────────────────────────────────────────── */}
        {tab === 'crop' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Image</label>
                <UploadSlot
                  url={cropFile ? cropUrl : null}
                  onFile={(f) => { setCropFile(f); setCropUrl(URL.createObjectURL(f)); setCropRegion(null) }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((r) => (
                    <button key={r.label} onClick={() => { setCropRatio(r); setCropRegion(null) }}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition ${
                        cropRatio.label === r.label
                          ? 'bg-neutral-950 text-white border-neutral-950'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {cropUrl && (
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!cropFile) return
                      setCropEnhancing(true)
                      try {
                        const enhanced = await callEnhanceWebhook(cropFile, selectedBrand ?? 'Unknown')
                        setCropUrl(enhanced)
                        setCropRegion(null)
                      } catch { /* silent — user still has original */ }
                      finally { setCropEnhancing(false) }
                    }}
                    disabled={cropEnhancing}
                    className="flex-1 px-4 py-3 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {cropEnhancing ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z"/></svg>
                    )}
                    {cropEnhancing ? 'Enhancing...' : 'Enhance Image'}
                  </button>
                  <button onClick={() => setShowCropPicker(true)}
                    className="flex-1 px-4 py-3 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-xl text-sm font-medium transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Adjust Image
                  </button>
                </div>
              )}

            </div>

            <div className="space-y-3">
              <div className="w-full rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50 flex items-center justify-center" style={{ minHeight: 320 }}>
                {cropUrl ? (
                  <canvas ref={cropCanvasRef}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: 540, width: 'auto', height: 'auto', margin: '0 auto' }} />
                ) : (
                  <p className="text-sm text-neutral-400">Upload an image to preview</p>
                )}
              </div>
              <button onClick={() => download(cropCanvasRef.current, `cropped-${cropRatio.label.replace(':', 'x')}.png`)}
                disabled={!cropUrl}
                className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
              >
                Download PNG
              </button>
            </div>
          </div>
        )}

        {/* ── COLLAGE TAB ──────────────────────────────────────────────────────── */}
        {tab === 'collage' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Layout</label>
                <div className="space-y-2">
                  {COLLAGE_LAYOUTS.map((l) => (
                    <button key={l.id} onClick={() => { setCollageLayout(l); setCollageCropRegions(Array(l.slots).fill(null)) }}
                      className={`w-full px-4 py-3 rounded-xl text-sm font-medium border text-left transition ${
                        collageLayout.id === l.id
                          ? 'bg-neutral-950 text-white border-neutral-950'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">Canvas Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((r) => (
                    <button key={r.label} onClick={() => { setCollageRatio(r); setCollageCropRegions(Array(collageLayout.slots).fill(null)) }}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition ${
                        collageRatio.label === r.label
                          ? 'bg-neutral-950 text-white border-neutral-950'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">
                  Images ({collageLayout.slots} required)
                </label>
                <div className={`grid gap-3 ${collageLayout.slots === 2 ? 'grid-cols-2' : collageLayout.slots === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {Array.from({ length: collageLayout.slots }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="aspect-square">
                        {collageUrls[i] ? (
                          <div className="relative w-full h-full rounded-xl overflow-hidden border border-neutral-200 group">
                            <img src={collageUrls[i]!} alt={`slot ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />
                            <label className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded-lg cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                              Replace
                              <input type="file" accept="image/*" className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (!f) return
                                  const newFiles = [...collageFiles]; newFiles[i] = f; setCollageFiles(newFiles)
                                  const newUrls = [...collageUrls]; newUrls[i] = URL.createObjectURL(f); setCollageUrls(newUrls)
                                  const newRegions = [...collageCropRegions]; newRegions[i] = null; setCollageCropRegions(newRegions)
                                }}
                              />
                            </label>
                          </div>
                        ) : (
                          <UploadSlot
                            url={null}
                            label={`Image ${i + 1}`}
                            onFile={(f) => {
                              const newFiles = [...collageFiles]; newFiles[i] = f; setCollageFiles(newFiles)
                              const newUrls = [...collageUrls]; newUrls[i] = URL.createObjectURL(f); setCollageUrls(newUrls)
                            }}
                          />
                        )}
                      </div>
                      {collageUrls[i] && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={async () => {
                              const file = collageFiles[i]
                              if (!file) return
                              setEnhancingSlots(prev => new Set(prev).add(i))
                              try {
                                const enhanced = await callEnhanceWebhook(file, selectedBrand ?? 'Unknown')
                                const newUrls = [...collageUrls]; newUrls[i] = enhanced; setCollageUrls(newUrls)
                                const newRegions = [...collageCropRegions]; newRegions[i] = null; setCollageCropRegions(newRegions)
                              } catch { /* silent */ }
                              finally { setEnhancingSlots(prev => { const s = new Set(prev); s.delete(i); return s }) }
                            }}
                            disabled={enhancingSlots.size > 0}
                            className="flex-1 px-2 py-2 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          >
                            {enhancingSlots.has(i) ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z"/></svg>
                            )}
                            {enhancingSlots.has(i) ? 'Enhancing...' : 'Enhance'}
                          </button>
                          <button
                            onClick={() => setAdjustingSlot(i)}
                            className="flex-1 px-2 py-2 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                            Adjust
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="space-y-3">
              <div className="w-full rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50 flex items-center justify-center" style={{ minHeight: 320 }}>
                {collageUrls.some((u) => u) ? (
                  <canvas ref={collageCanvasRef}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: 540, width: 'auto', height: 'auto', margin: '0 auto' }} />
                ) : (
                  <p className="text-sm text-neutral-400">Upload images to see collage preview</p>
                )}
              </div>
              <button onClick={() => download(collageCanvasRef.current, `collage-${collageLayout.id}.png`)}
                disabled={collageUrls.every((u) => !u)}
                className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
              >
                Download PNG
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Crop tab — picker portal */}
      {showCropPicker && cropUrl && createPortal(
        <FabricCropPicker
          sourceImageUrl={cropUrl}
          aspectRatio={cropRatio.w / cropRatio.h}
          onDone={(region) => { setCropRegion(region); setShowCropPicker(false) }}
          onCancel={() => setShowCropPicker(false)}
        />,
        document.body,
      )}

      {/* Collage — per-slot picker portal */}
      {adjustingSlot !== null && collageUrls[adjustingSlot] && createPortal(
        <FabricCropPicker
          sourceImageUrl={collageUrls[adjustingSlot]!}
          aspectRatio={getSlotAspectRatio(collageLayout, adjustingSlot, collageW, collageH)}
          onDone={(region) => {
            const next = [...collageCropRegions]
            next[adjustingSlot] = region
            setCollageCropRegions(next)
            setAdjustingSlot(null)
          }}
          onCancel={() => setAdjustingSlot(null)}
        />,
        document.body,
      )}
    </div>
  )
}
