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
  Text,
  Textbox,
} from 'fabric'
import type { DidYouKnowIdea } from '../../hooks/useDidYouKnow'
import { DEFAULT_DID_YOU_KNOW_CANVAS_CONFIG } from '../../config/didYouKnowCanvasConfig'

export interface DidYouKnowCanvasHandle {
  downloadAsPng: () => void
  getDataUrl: () => string | null
}

interface DidYouKnowCanvasProps {
  idea: DidYouKnowIdea
  imageUrl: string | null
  brandLogoPublicId: string | null
  translatedEdition: string
  language: string
  onClick?: () => void
}

export const DidYouKnowCanvas = forwardRef<
  DidYouKnowCanvasHandle,
  DidYouKnowCanvasProps
>(function DidYouKnowCanvas(
  {
    idea,
    imageUrl,
    brandLogoPublicId,
    translatedEdition,
    language,
    onClick,
  },
  ref,
) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<StaticCanvas | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const CANVAS_WIDTH = 1080
  const CANVAS_HEIGHT = 1350

  const renderCanvas = useCallback(
    async (canvas: StaticCanvas) => {
      canvas.clear()

      const cfg = DEFAULT_DID_YOU_KNOW_CANVAS_CONFIG

      // Preload fonts
      try {
        const isChinese = language === 'zh' || language.startsWith('zh')
        const fontLoads = [
          document.fonts.load('900 28px Montserrat'),
          document.fonts.load('400 12px Montserrat'),
          document.fonts.load('600 10px "JetBrains Mono"'),
        ]
        if (isChinese) {
          fontLoads.push(document.fonts.load('400 28px "Noto Sans CJK SC"'))
        }
        await Promise.all(fontLoads)
      } catch {
        // Continue with fallback
      }

      const w = CANVAS_WIDTH
      const h = CANVAS_HEIGHT

      // Layer 1: Background image (smart scaling based on aspect ratio)
      if (imageUrl) {
        try {
          const photo = await FabricImage.fromURL(imageUrl, {
            crossOrigin: 'anonymous',
          })

          const scaleX = w / photo.width!
          const scaleY = h / photo.height!

          // Fill entire canvas (zoom in if needed)
          const scale = Math.max(scaleX, scaleY)

          photo.set({
            scaleX: scale,
            scaleY: scale,
            left: w / 2,
            top: 0,
            originX: 'center',
            originY: 'top',
            selectable: false,
            evented: false,
          })
          canvas.add(photo)
        } catch {
          // Image failed — dark bg remains
        }
      }

      // Layer 1.5: Gradient overlay (black, bottom-to-top)
      // Create gradient on canvas context
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = w
      tempCanvas.height = h
      const ctx = tempCanvas.getContext('2d')!
      const grad = ctx.createLinearGradient(0, h, 0, 0)
      grad.addColorStop(0, 'rgba(0, 0.8, 1, 1)')
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      const gradientImage = await FabricImage.fromURL(tempCanvas.toDataURL())
      gradientImage.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      })
      canvas.add(gradientImage)

      // Layer 2: Brand logo (top-right, small)
      if (brandLogoPublicId) {
        try {
          const logoHeight = 90
          const logoUrl = `https://res.cloudinary.com/dymmqtqyg/image/upload/h_${logoHeight},c_scale/${brandLogoPublicId}`
          const logo = await FabricImage.fromURL(logoUrl, {
            crossOrigin: 'anonymous',
          })

          logo.set({
            height: logoHeight,
            scaleToHeight: logoHeight,
            left: w - 40,
            top: 40,
            originX: 'right',
            originY: 'top',
            selectable: false,
            evented: false,
          })
          canvas.add(logo)
        } catch {
          // Logo failed — continue
        }
      }

      // Layer 5-9: Bottom layout (anchored from bottom, measured upward)
      const bottomPad = cfg.layout.bottomPadding

      // Measure headline first
      const headlineObj = new Textbox(idea.headline, {
        fontFamily: cfg.headline.fontFamily,
        fontSize: cfg.headline.fontSize,
        fontWeight: cfg.headline.fontWeight,
        fill: cfg.headline.fill,
        lineHeight: cfg.headline.lineHeight,
        charSpacing: cfg.headline.charSpacing,
        width: cfg.headline.maxWidth,
        originY: 'top',
        selectable: false,
        evented: false,
      })
      const headlineH = headlineObj.getScaledHeight()

      // Measure fact text
      const isChinese = language === 'Chinese Simplified'
      const factFontFamily = isChinese ? 'Noto Sans CJK SC' : cfg.fact.fontFamily
      const factFontSize = cfg.fact.fontSize
      const factLineHeight = cfg.fact.lineHeight
      const factWidth = cfg.fact.maxWidth

      const factObj = new Textbox(idea.fact, {
        fontFamily: isChinese ? '"Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", SimSun, sans-serif' : factFontFamily,
        fontSize: factFontSize,
        fontWeight: cfg.fact.fontWeight,
        fill: cfg.fact.fill,
        lineHeight: factLineHeight,
        width: factWidth,
        originX: 'center',
        selectable: false,
        evented: false,
        ...(isChinese && { splitByGrapheme: true }),
      })
      const factH = factObj.getScaledHeight()

      // Position from bottom up
      let cursorY = h - bottomPad

      // Add fact + accent bar (highest priority, bottom-most)
      const factX = cfg.fact.leftOffset
      const factLeftEdge = factX - (factWidth / 2)
      const accentBarX = factLeftEdge - cfg.accentBar.gap - cfg.accentBar.width

      const accentBar = new Rect({
        left: accentBarX,
        top: cursorY - factH,
        width: cfg.accentBar.width,
        height: factH,
        fill: cfg.accentBar.color,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      })
      canvas.add(accentBar)

      factObj.set({
        left: factX,
        top: cursorY - factH,
        originY: 'top',
      })
      canvas.add(factObj)

      cursorY -= factH + cfg.divider.marginBottom

      // Add divider
      const divider = new Rect({
        left: cfg.divider.leftOffset,
        top: cursorY,
        width: cfg.divider.width,
        height: cfg.divider.height,
        fill: cfg.divider.color,
        originY: 'top',
        selectable: false,
        evented: false,
      })
      canvas.add(divider)

      cursorY -= cfg.headline.marginBottom

      // Add headline
      headlineObj.set({
        left: cfg.headline.leftOffset,
        top: cursorY - headlineH,
        originY: 'top',
      })
      canvas.add(headlineObj)

      cursorY -= headlineH + cfg.editionLabel.marginBottom

      // Add edition label with black background
      const isMalay = language === 'ms' || language.startsWith('ms') || language?.toLowerCase().includes('malay')
      const prefix = isMalay ? 'IMBAS KEMBALI' : 'THROWBACK'
      const editionText = `${prefix} - ${translatedEdition}`.toUpperCase()
      const editionObj = new Text(editionText, {
        fontFamily: cfg.editionLabel.fontFamily,
        fontSize: cfg.editionLabel.fontSize,
        fontWeight: cfg.editionLabel.fontWeight,
        fill: cfg.editionLabel.color,
        charSpacing: cfg.editionLabel.charSpacing,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      })

      const editionW = editionObj.getScaledWidth()
      const editionH = editionObj.getScaledHeight()
      const editionBgW = editionW + cfg.editionLabel.paddingH * 2
      const editionBgH = editionH + cfg.editionLabel.paddingV * 2

      const editionBg = new Rect({
        left: cfg.editionLabel.leftOffset,
        top: cursorY - editionBgH,
        width: editionBgW,
        height: editionBgH,
        fill: cfg.editionLabel.backgroundColor,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      })
      canvas.add(editionBg)

      editionObj.set({
        left: cfg.editionLabel.leftOffset + cfg.editionLabel.paddingH,
        top: cursorY - editionBgH + cfg.editionLabel.paddingV,
      })
      canvas.add(editionObj)

      canvas.renderAll()
      setReady(true)
      setError(null)
    },
    [idea, imageUrl, brandLogoPublicId, translatedEdition],
  )

  // Render directly to visible canvas
  useEffect(() => {
    if (!canvasElRef.current || !imageUrl) return

    let cancelled = false

    // Dispose old canvas completely before creating new one
    if (fabricRef.current) {
      fabricRef.current.dispose()
      fabricRef.current = null
    }

    const visibleEl = canvasElRef.current

    // Clear Fabric's internal state from the canvas element
    ;(visibleEl as any).__fabricjsInstance = undefined
    ;(visibleEl as any).__currentFabric = undefined

    // Reset canvas element to clear any previous state
    visibleEl.width = CANVAS_WIDTH
    visibleEl.height = CANVAS_HEIGHT

    const canvas = new StaticCanvas(visibleEl, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 'transparent',
    })

    renderCanvas(canvas).then(() => {
      if (cancelled) {
        canvas.dispose()
        return
      }

      visibleEl.style.width = '100%'
      visibleEl.style.height = '100%'

      const prev = fabricRef.current
      fabricRef.current = canvas
      if (prev) prev.dispose()
    })

    return () => {
      cancelled = true
    }
  }, [idea, imageUrl, brandLogoPublicId, translatedEdition, renderCanvas])

  useEffect(() => {
    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  }, [])

  useImperativeHandle(ref, () => ({
    downloadAsPng() {
      const canvas = fabricRef.current
      if (!canvas) return
      const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 })
      const link = document.createElement('a')
      link.href = dataUrl
      const sanitizedHeadline = idea.headline
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100)
      link.download = `${sanitizedHeadline}.png`
      link.click()
    },
    getDataUrl() {
      const canvas = fabricRef.current
      if (!canvas) return null
      return canvas.toDataURL({ format: 'png', multiplier: 1 })
    },
  }))

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}
      {imageUrl ? (
        <div
          className={`w-full rounded-xl border border-neutral-200 overflow-hidden${onClick ? ' cursor-pointer hover:opacity-90 transition' : ''}`}
          style={{
            aspectRatio: '1080 / 1350',
            backgroundColor: '#000',
          }}
          onClick={onClick}
        >
          <canvas
            ref={canvasElRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
            }}
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
              Rendering preview...
            </div>
          )}
        </div>
      ) : (
        <div
          className="w-full flex items-center justify-center bg-neutral-50 border border-neutral-200 rounded-xl"
          style={{
            aspectRatio: '1080 / 1350',
            minHeight: '400px',
          }}
        >
          <p className="text-sm text-neutral-500">Upload an image to see preview</p>
        </div>
      )}
    </div>
  )
})
