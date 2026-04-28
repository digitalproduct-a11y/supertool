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
  Gradient,
  Shadow,
} from 'fabric'
import {
  DEFAULT_DID_YOU_KNOW_CANVAS_CONFIG,
  type DidYouKnowCanvasConfig,
} from '../config/didYouKnowCanvasConfig'
import type { DidYouKnowIdea } from '../hooks/useDidYouKnow'

export interface DidYouKnowCanvasHandle {
  downloadAsPng: () => void
  getDataUrl: () => string | null
}

interface DidYouKnowCanvasProps {
  idea: DidYouKnowIdea
  imageUrl: string | null
  brandLogoPublicId: string | null
  translatedEdition: string
  config?: DidYouKnowCanvasConfig
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
    config: configProp,
    onClick,
  },
  ref,
) {
  const config = configProp ?? DEFAULT_DID_YOU_KNOW_CANVAS_CONFIG
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<StaticCanvas | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const renderCanvas = useCallback(
    async (canvas: StaticCanvas) => {
      canvas.clear()
      const { width, height } = config.canvas
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string

      try {
        await Promise.all([
          document.fonts.load(`900 28px Montserrat`),
          document.fonts.load(`400 12px Montserrat`),
          document.fonts.load(`600 10px "JetBrains Mono"`),
        ])
      } catch {
        // Continue with fallback fonts if loading fails
      }

      // Layer 1: Dark bg fallback
      canvas.add(
        new Rect({
          left: 0,
          top: 0,
          width,
          height,
          fill: config.canvas.backgroundColor,
          selectable: false,
          evented: false,
        }),
      )

      // Layer 2: Full-bleed photo (fill height, center-anchor, crop sides if needed)
      if (imageUrl) {
        try {
          const photo = await FabricImage.fromURL(imageUrl, {
            crossOrigin: 'anonymous',
          })

          const imgHeight = photo.height!

          // Scale to fill canvas height, width crops if needed
          const scale = height / imgHeight

          const faceTop = height * 0.35
          photo.set({
            scaleX: scale,
            scaleY: scale,
            left: width / 2,
            top: faceTop,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          })
          canvas.add(photo)
        } catch {
          // Photo failed — dark bg remains
        }
      }

      // Layer 3: Gradient overlay (multi-stop linear)
      const gradRect = new Rect({
        left: 0,
        top: 0,
        width,
        height,
        selectable: false,
        evented: false,
      })
      gradRect.set(
        'fill',
        new Gradient({
          type: 'linear',
          coords: { x1: 0, y1: 0, x2: 0, y2: height },
          colorStops: config.gradient.colorStops.map((s) => ({
            offset: s.offset,
            color: config.gradient.color,
            opacity: s.opacity,
          })),
        }),
      )
      canvas.add(gradRect)

      // Layer 4: Brand logo (top-right)
      if (brandLogoPublicId) {
        try {
          const logoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${brandLogoPublicId}`
          const logo = await FabricImage.fromURL(logoUrl, {
            crossOrigin: 'anonymous',
          })
          logo.scaleToHeight(config.logo.height)
          logo.set({
            left: width - config.logo.marginRight,
            top: config.logo.marginTop,
            originX: 'right',
            originY: 'top',
            selectable: false,
            evented: false,
          })
          canvas.add(logo)
        } catch {
          // Logo failed — skip
        }
      }

      // Layers 5–10: Bottom-anchored content stack
      // Create all text objects first, measure, then position

      // Temporarily add text to canvas to get proper measurements
      // Create temporary text for measurement only
      const tempLabelText = new Text(translatedEdition.toUpperCase(), {
        fontFamily: config.editionLabel.fontFamily,
        fontSize: config.editionLabel.fontSize,
        fontWeight: config.editionLabel.fontWeight,
        fill: config.editionLabel.color,
        charSpacing: config.editionLabel.charSpacing,
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      })

      const tempHeadline = new Textbox(idea.headline, {
        fontFamily: config.headline.fontFamily,
        fontSize: config.headline.fontSize,
        fontWeight: config.headline.fontWeight,
        fill: config.headline.fill,
        lineHeight: config.headline.lineHeight,
        charSpacing: config.headline.charSpacing,
        width: config.headline.maxWidth,
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        shadow: new Shadow({
          color: config.headline.shadow.color,
          blur: config.headline.shadow.blur,
          offsetX: config.headline.shadow.offsetX,
          offsetY: config.headline.shadow.offsetY,
        }),
      })

      const tempFactTextbox = new Textbox(idea.fact, {
        fontFamily: config.fact.fontFamily,
        fontSize: config.fact.fontSize,
        fontWeight: config.fact.fontWeight,
        fill: config.fact.fill,
        lineHeight: config.fact.lineHeight,
        width: config.fact.maxWidth,
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      })

      // Temporarily add to canvas to measure
      canvas.add(tempLabelText)
      canvas.add(tempHeadline)
      canvas.add(tempFactTextbox)
      canvas.renderAll()

      // Measure heights from temporary objects
      const factHeight = tempFactTextbox.getScaledHeight()
      const headlineHeight = tempHeadline.getScaledHeight()
      const labelBgWidth =
        tempLabelText.getScaledWidth() + 2 * config.editionLabel.paddingH
      const labelBgHeight =
        config.editionLabel.fontSize + 2 * config.editionLabel.paddingV

      // Layer 8: Divider
      const divider = new Rect({
        left: 0,
        top: 0,
        width: config.divider.width,
        height: config.divider.height,
        fill: config.divider.color,
        selectable: false,
        evented: false,
      })

      // Layer 9: Accent bar (height = fact text height)
      const accentBar = new Rect({
        left: 0,
        top: 0,
        width: config.accentBar.width,
        height: factHeight,
        fill: config.accentBar.color,
        selectable: false,
        evented: false,
      })

      // Stack assembly: compute total height and position from bottom
      const labelBlockHeight =
        labelBgHeight + config.editionLabel.marginBottom
      const headlineBlockHeight =
        headlineHeight + config.headline.marginBottom
      const dividerBlockHeight =
        divider.height + config.divider.marginBottom
      const factBlockHeight = factHeight

      const totalStackHeight =
        labelBlockHeight +
        headlineBlockHeight +
        dividerBlockHeight +
        factBlockHeight

      const stackBottom = height - config.layout.bottomPadding
      let cursorY = stackBottom - totalStackHeight

      // Clear and rebuild with proper positioning
      canvas.clear()

      // Re-add all base layers
      canvas.add(
        new Rect({
          left: 0,
          top: 0,
          width,
          height,
          fill: config.canvas.backgroundColor,
          selectable: false,
          evented: false,
        }),
      )

      // Re-add photo if exists
      if (imageUrl) {
        try {
          const photo = await FabricImage.fromURL(imageUrl, {
            crossOrigin: 'anonymous',
          })
          const scale = Math.max(width / photo.width!, height / photo.height!)
          const faceTop = height * 0.35
          photo.set({
            scaleX: scale,
            scaleY: scale,
            left: width / 2,
            top: faceTop,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          })
          canvas.add(photo)
        } catch {
          // Photo failed
        }
      }

      // Re-add gradient
      const gradRect2 = new Rect({
        left: 0,
        top: 0,
        width,
        height,
        selectable: false,
        evented: false,
      })
      gradRect2.set(
        'fill',
        new Gradient({
          type: 'linear',
          coords: { x1: 0, y1: 0, x2: 0, y2: height },
          colorStops: config.gradient.colorStops.map((s) => ({
            offset: s.offset,
            color: config.gradient.color,
            opacity: s.opacity,
          })),
        }),
      )
      canvas.add(gradRect2)

      // Re-add logo if exists
      if (brandLogoPublicId) {
        try {
          const logoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${brandLogoPublicId}`
          const logo = await FabricImage.fromURL(logoUrl, {
            crossOrigin: 'anonymous',
          })
          logo.scaleToHeight(config.logo.height)
          logo.set({
            left: width - config.logo.marginRight,
            top: config.logo.marginTop,
            originX: 'right',
            originY: 'top',
            selectable: false,
            evented: false,
          })
          canvas.add(logo)
        } catch {
          // Logo failed
        }
      }

      // Edition label bg rect (sized from measured text)
      const labelBgRect = new Rect({
        left: config.layout.sidePadding,
        top: cursorY,
        width: labelBgWidth,
        height: labelBgHeight,
        fill: config.editionLabel.backgroundColor,
        selectable: false,
        evented: false,
      })
      canvas.add(labelBgRect)

      // Edition label text (recreated fresh)
      const labelText = new Text(translatedEdition.toUpperCase(), {
        fontFamily: config.editionLabel.fontFamily,
        fontSize: config.editionLabel.fontSize,
        fontWeight: config.editionLabel.fontWeight,
        fill: config.editionLabel.color,
        charSpacing: config.editionLabel.charSpacing,
        left: config.layout.sidePadding + config.editionLabel.paddingH,
        top: cursorY + config.editionLabel.paddingV,
        selectable: false,
        evented: false,
      })
      canvas.add(labelText)
      cursorY += labelBlockHeight

      // Headline (recreated fresh)
      const headline = new Textbox(idea.headline, {
        fontFamily: config.headline.fontFamily,
        fontSize: config.headline.fontSize,
        fontWeight: config.headline.fontWeight,
        fill: config.headline.fill,
        lineHeight: config.headline.lineHeight,
        charSpacing: config.headline.charSpacing,
        width: config.headline.maxWidth,
        left: config.layout.sidePadding,
        top: cursorY,
        selectable: false,
        evented: false,
        shadow: new Shadow({
          color: config.headline.shadow.color,
          blur: config.headline.shadow.blur,
          offsetX: config.headline.shadow.offsetX,
          offsetY: config.headline.shadow.offsetY,
        }),
      })
      canvas.add(headline)
      cursorY += headlineBlockHeight

      // Divider
      divider.set({
        left: config.layout.sidePadding,
        top: cursorY,
      })
      canvas.add(divider)
      cursorY += dividerBlockHeight

      // Fact block (accent bar + text side-by-side)
      const factTop = cursorY
      accentBar.set({
        left: config.layout.sidePadding,
        top: factTop,
      })

      // Fact text (recreated fresh)
      const factTextbox = new Textbox(idea.fact, {
        fontFamily: config.fact.fontFamily,
        fontSize: config.fact.fontSize,
        fontWeight: config.fact.fontWeight,
        fill: config.fact.fill,
        lineHeight: config.fact.lineHeight,
        width: config.fact.maxWidth,
        left:
          config.layout.sidePadding +
          config.accentBar.width +
          config.accentBar.gap,
        top: factTop,
        selectable: false,
        evented: false,
      })

      canvas.add(accentBar)
      canvas.add(factTextbox)

      canvas.renderAll()
      setReady(true)
      setError(null)
    },
    [idea, imageUrl, brandLogoPublicId, translatedEdition, config],
  )

  // Render directly on visible canvas
  useEffect(() => {
    if (!canvasElRef.current) return

    let cancelled = false
    const { width, height, backgroundColor } = config.canvas

    const visibleEl = canvasElRef.current

    // Dispose old canvas if it exists
    const prevCanvas = fabricRef.current
    if (prevCanvas) {
      prevCanvas.dispose()
      fabricRef.current = null
    }

    visibleEl.width = width
    visibleEl.height = height

    const canvas = new StaticCanvas(visibleEl, {
      width,
      height,
      backgroundColor,
    })

    fabricRef.current = canvas

    renderCanvas(canvas).then(() => {
      if (cancelled) {
        canvas.dispose()
        fabricRef.current = null
      }
    })

    return () => {
      cancelled = true
    }
  }, [idea, imageUrl, brandLogoPublicId, translatedEdition, config, renderCanvas])

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
      link.download = `didyouknow-${idea.id}.png`
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
    <div className="flex flex-col items-center gap-4" style={{ width: 'inherit' }}>
      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}
      {imageUrl ? (
        <div
          className={`rounded-xl border border-neutral-200${onClick ? ' cursor-pointer hover:opacity-90 transition' : ''}`}
          style={{ width: '100%' }}
          onClick={onClick}
        >
          <canvas
            ref={canvasElRef}
            width={cw}
            height={ch}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
            }}
          />
          {!ready && (
            <div className="flex items-center justify-center h-64 text-sm text-neutral-400">
              Rendering preview...
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center bg-neutral-50 border border-neutral-200 rounded-xl" style={{ width: '400px', minHeight: '400px' }}>
          <p className="text-sm text-neutral-500">Upload an image to see preview</p>
        </div>
      )}
    </div>
  )
})
