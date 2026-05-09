import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from 'react'
import {
  StaticCanvas,
  FabricImage,
  Rect,
  Textbox,
  Gradient,
} from 'fabric'
import {
  DEFAULT_GEMPAK_ENT_CANVAS_CONFIG,
  type GempakEntertainmentCanvasConfig,
  type TextLayerStyle,
} from '../../config/gempakEntertainmentCanvasConfig'
import { BRAND_LOGO_IDS, getBrandHex } from '../../constants/brands'

export interface GempakEntertainmentCanvasHandle {
  downloadAsPng: (filename?: string) => void
  getDataUrl: () => string | null
}

export interface GempakEntertainmentCanvasProps {
  headline: string
  subtitle: string
  brand: string
  // Either a Cloudinary public_id (e.g. "celebrity_xyz_abc") or a full URL
  // (e.g. "https://images.pexels.com/..."). Internally we always render via a
  // Cloudinary URL so face-aware crop applies. Null/empty leaves a brand-color
  // fallback fill.
  photoPublicId: string | null
  // Optional kicker label above the headline (drives the typeLabel layer).
  // Leave empty to hide.
  typeLabel?: string
  config?: GempakEntertainmentCanvasConfig
  onClick?: () => void
}

const CLOUDINARY_CLOUD = 'dymmqtqyg'
const FALLBACK_PHOTO_PUBLIC_ID = 'placeholder_img_cveevd'

// Build a Cloudinary URL with face-aware crop. Mirrors EPL's IdeaCard
// `c_fill,g_face,w_1080,h_1350` segment. Handles both stored public IDs and
// external URLs (the latter via Cloudinary's `fetch` delivery type — same path
// EPL takes when the user uploads a Pexels image).
function buildPhotoUrl(
  photoPublicId: string | null,
  width: number,
  height: number,
): string {
  const id = photoPublicId || FALLBACK_PHOTO_PUBLIC_ID
  const isExternal = id.startsWith('http')
  const deliveryType = isExternal ? 'fetch' : 'upload'
  const finalId = isExternal ? encodeURIComponent(id) : id
  const transform = `c_fill,g_face,w_${width},h_${height},f_auto,q_auto`
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/${deliveryType}/${transform}/${finalId}`
}

function applyTextStyle(style: TextLayerStyle) {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight as string,
    fontStyle: style.fontStyle ?? 'normal',
    fill: style.fill,
    lineHeight: style.lineHeight ?? 1.2,
    charSpacing:
      style.letterSpacing !== undefined ? style.letterSpacing * 1000 : 0,
    textAlign: style.textAlign ?? 'center',
  } as const
}

export const GempakEntertainmentCanvas = forwardRef<
  GempakEntertainmentCanvasHandle,
  GempakEntertainmentCanvasProps
>(function GempakEntertainmentCanvas(
  { headline, subtitle, brand, photoPublicId, typeLabel, config: configProp, onClick },
  ref,
) {
  const config = configProp ?? DEFAULT_GEMPAK_ENT_CANVAS_CONFIG
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<StaticCanvas | null>(null)
  const [ready, setReady] = useState(false)

  const renderCanvas = useCallback(
    async (
      canvas: StaticCanvas,
      isCancelled: () => boolean = () => false,
    ): Promise<boolean> => {
      try {
        canvas.clear()
        const { width, height } = config.canvas
        const brandHex = getBrandHex(brand)

        // Wait for Montserrat weights so Fabric measures glyphs correctly on
        // first paint. Without this, Textbox layout uses fallback widths and
        // text wraps incorrectly until the real font loads.
        try {
          await Promise.all([
            document.fonts.load(`700 90px Montserrat`),
            document.fonts.load(`400 38px Montserrat`),
            document.fonts.load(`600 38px Montserrat`),
          ])
          await document.fonts.ready
        } catch {
          // Fall through with browser fallback fonts
        }
        if (isCancelled()) return false

        // Layer 1: brand-color fallback fill (covered by photo when it loads).
        canvas.add(
          new Rect({
            left: 0,
            top: 0,
            width,
            height,
            fill: brandHex || config.canvas.backgroundColor,
            selectable: false,
            evented: false,
          }),
        )

        // Layer 2: full-bleed face-aware photo. Cloudinary handles the crop;
        // fabric just blits the resulting 1080×1350 image.
        try {
          const photoUrl = buildPhotoUrl(photoPublicId, width, height)
          const photo = await FabricImage.fromURL(photoUrl, {
            crossOrigin: 'anonymous',
          })
          if (isCancelled()) return false
          // Cover-scale defensively in case Cloudinary returned slightly off
          // dimensions (e.g. fetch type sometimes preserves source aspect).
          const scale = Math.max(width / photo.width!, height / photo.height!)
          photo.scale(scale)
          photo.set({
            left: width / 2,
            top: height / 2,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          })
          canvas.add(photo)
        } catch {
          // Photo failed — fallback fill remains visible. User can pick again.
        }

        // Layer 3: bottom darkening gradient — gives white text contrast.
        const gradH = Math.round(height * config.bottomGradient.coverageRatio)
        const gradRect = new Rect({
          left: 0,
          top: height - gradH,
          width,
          height: gradH,
          selectable: false,
          evented: false,
        })
        gradRect.set(
          'fill',
          new Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: 0, y2: gradH },
            colorStops: [
              {
                offset: 0,
                color: config.bottomGradient.color,
                opacity: config.bottomGradient.startOpacity,
              },
              {
                offset: 1,
                color: config.bottomGradient.color,
                opacity: config.bottomGradient.endOpacity,
              },
            ],
          }),
        )
        canvas.add(gradRect)

        // Layer 4: optional kicker label (idea.type uppercase, gold).
        if (config.typeLabel.enabled && typeLabel) {
          const tStyle = applyTextStyle(config.typeLabel.style)
          const tText = config.typeLabel.style.uppercase
            ? typeLabel.toUpperCase()
            : typeLabel
          const t = new Textbox(tText, {
            ...tStyle,
            width: config.typeLabel.maxWidth,
            left: width / 2,
            top: config.typeLabel.yFromTop,
            originX: 'center',
            originY: 'top',
            selectable: false,
            evented: false,
          })
          canvas.add(t)
        }

        // Layer 5: headline (white, bold, uppercase, dynamic-sized).
        const headlineTier = config.headline.dynamicSizing.find(
          (tier) => headline.length <= tier.maxLength,
        )
        const headlineScale = headlineTier?.scale ?? 1
        const headlineFontSize = Math.round(
          config.headline.style.fontSize * headlineScale,
        )
        const hStyle = applyTextStyle({
          ...config.headline.style,
          fontSize: headlineFontSize,
        })
        const hText = config.headline.style.uppercase
          ? headline.toUpperCase()
          : headline
        const hBox = new Textbox(hText, {
          ...hStyle,
          width: config.headline.maxWidth,
          left: width / 2,
          top: config.headline.yFromTop,
          originX: 'center',
          originY: 'top',
          selectable: false,
          evented: false,
        })
        canvas.add(hBox)

        // Layer 6: subtitle (white, regular, dynamic-sized).
        const subtitleTier = config.subtitle.dynamicSizing.find(
          (tier) => subtitle.length <= tier.maxLength,
        )
        const subtitleScale = subtitleTier?.scale ?? 1
        const subtitleFontSize = Math.round(
          config.subtitle.style.fontSize * subtitleScale,
        )
        const sStyle = applyTextStyle({
          ...config.subtitle.style,
          fontSize: subtitleFontSize,
        })
        const sBox = new Textbox(subtitle, {
          ...sStyle,
          width: config.subtitle.maxWidth,
          left: width / 2,
          top: config.subtitle.yFromTop,
          originX: 'center',
          originY: 'top',
          selectable: false,
          evented: false,
        })
        canvas.add(sBox)

        // Layer 7: brand logo (bottom-centered).
        if (brand) {
          const logoId =
            BRAND_LOGO_IDS[brand as keyof typeof BRAND_LOGO_IDS] ?? ''
          if (logoId) {
            try {
              const logoUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${logoId}`
              const logoImg = await FabricImage.fromURL(logoUrl, {
                crossOrigin: 'anonymous',
              })
              if (isCancelled()) return false
              logoImg.scaleToWidth(config.logo.width)
              if (logoImg.getScaledHeight() > config.logo.maxHeight) {
                logoImg.scaleToHeight(config.logo.maxHeight)
              }
              logoImg.set({
                left: width / 2,
                top: height - config.logo.yFromBottom,
                originX: 'center',
                originY: 'bottom',
                selectable: false,
                evented: false,
              })
              canvas.add(logoImg)
            } catch {
              // Logo failed — skip; preview still readable
            }
          }
        }

        canvas.renderAll()
        return true
      } catch (e) {
        console.error('GempakEntertainmentCanvas render failed', e)
        return false
      }
    },
    [headline, subtitle, brand, photoPublicId, typeLabel, config],
  )

  // Double-buffered render: build the new frame on a detached canvas, then
  // blit onto the visible <canvas> in a single drawImage call. Keeps the
  // previous frame on screen while async work (font/image fetch) completes.
  // A generation counter discards late-completing renders.
  const renderGenRef = useRef(0)
  useEffect(() => {
    if (!canvasElRef.current) return

    const myGen = ++renderGenRef.current
    const isCancelled = () => myGen !== renderGenRef.current
    const { width, height, backgroundColor } = config.canvas

    const offscreenEl = document.createElement('canvas')
    offscreenEl.width = width
    offscreenEl.height = height
    const offscreen = new StaticCanvas(offscreenEl, {
      width,
      height,
      backgroundColor,
    })

    renderCanvas(offscreen, isCancelled).then((ok) => {
      if (!ok || isCancelled()) {
        offscreen.dispose()
        return
      }
      const visibleEl = canvasElRef.current
      if (!visibleEl) {
        offscreen.dispose()
        return
      }
      if (visibleEl.width !== width) visibleEl.width = width
      if (visibleEl.height !== height) visibleEl.height = height
      const ctx = visibleEl.getContext('2d')
      if (ctx) {
        // toCanvasElement always paints a fresh frame from the object model —
        // avoids stale glyphs from late-resolved fonts that lowerCanvasEl can
        // miss. Same trick used in QuoteCanvas.
        const sourceEl = offscreen.toCanvasElement(1) as HTMLCanvasElement
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(sourceEl, 0, 0)
      }
      visibleEl.style.width = '100%'
      visibleEl.style.height = '100%'

      const prev = fabricRef.current
      fabricRef.current = offscreen
      if (prev) prev.dispose()
      setReady(true)
    })
  }, [headline, subtitle, brand, photoPublicId, typeLabel, config, renderCanvas])

  useEffect(() => {
    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  }, [])

  useImperativeHandle(ref, () => ({
    downloadAsPng(filename?: string) {
      const canvas = fabricRef.current
      if (!canvas) return
      const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = filename ?? 'gempak-ent-post.png'
      link.click()
    },
    getDataUrl() {
      const canvas = fabricRef.current
      if (!canvas) return null
      return canvas.toDataURL({ format: 'png', multiplier: 1 })
    },
  }))

  const { width: cw, height: ch } = config.canvas

  return (
    <div
      className={`w-full overflow-hidden rounded-xl bg-neutral-100${onClick ? ' cursor-pointer hover:opacity-90 transition' : ''}`}
      style={{ aspectRatio: `${cw} / ${ch}` }}
      onClick={onClick}
    >
      <canvas
        ref={canvasElRef}
        width={cw}
        height={ch}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {!ready && (
        <div className="flex items-center justify-center h-full text-xs text-neutral-400">
          Rendering preview…
        </div>
      )}
    </div>
  )
})

export default GempakEntertainmentCanvas
