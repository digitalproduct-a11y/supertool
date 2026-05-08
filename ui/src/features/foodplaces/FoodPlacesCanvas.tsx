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
  Text,
  Gradient,
} from 'fabric'
import {
  getFoodPlacesCanvasConfig,
  type FoodPlacesCanvasConfig,
} from '../../config/foodPlacesCanvasConfig'
import { withSubjectAwareCrop } from '../../utils/cloudinary'
import type { FoodPlacesSlide } from './types'

export interface FoodPlacesCanvasHandle {
  downloadAsPng: (filename?: string) => void
  getDataUrl: () => string | null
}

interface FoodPlacesCanvasProps {
  slide: FoodPlacesSlide
  brand: string
  cloudName: string
  onClick?: () => void
}

function loadFonts(): Promise<unknown> {
  return Promise.all([
    document.fonts.load(`500 14px Inter`),
    document.fonts.load(`600 16px Inter`),
    document.fonts.load(`500 18px "JetBrains Mono"`),
    document.fonts.load(`700 48px "Space Grotesk"`),
    document.fonts.load(`700 64px "Space Grotesk"`),
  ]).then(() => document.fonts.ready)
}

function publicIdToUrl(cloudName: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`
}

export const FoodPlacesCanvas = forwardRef<
  FoodPlacesCanvasHandle,
  FoodPlacesCanvasProps
>(function FoodPlacesCanvas({ slide, brand, cloudName, onClick }, ref) {
  const config: FoodPlacesCanvasConfig = getFoodPlacesCanvasConfig(brand)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<StaticCanvas | null>(null)
  const renderGenRef = useRef(0)
  const [ready, setReady] = useState(false)

  const renderCanvas = useCallback(
    async (
      canvas: StaticCanvas,
      isCancelled: () => boolean = () => false,
    ): Promise<boolean> => {
      try {
        canvas.clear()
        const { width, height, accentColor, fontFamily } = config

        await loadFonts()
        if (isCancelled()) return false

        // Layer 1: solid fallback fill (covered by photo when it loads)
        canvas.add(
          new Rect({
            left: 0,
            top: 0,
            width,
            height,
            fill: '#1a1a1a',
            selectable: false,
            evented: false,
          }),
        )

        // Layer 2: full-bleed photo (Cloudinary subject-aware crop)
        if (slide.photoPublicId) {
          try {
            const url = withSubjectAwareCrop(
              publicIdToUrl(cloudName, slide.photoPublicId),
              width,
              height,
            )
            const img = await FabricImage.fromURL(url, {
              crossOrigin: 'anonymous',
            })
            if (isCancelled()) return false
            const elem = img.getElement() as HTMLImageElement
            const scale = Math.max(
              width / elem.naturalWidth,
              height / elem.naturalHeight,
            )
            img.set({
              left: width / 2,
              top: height / 2,
              originX: 'center',
              originY: 'center',
              scaleX: scale,
              scaleY: scale,
              selectable: false,
              evented: false,
            })
            canvas.add(img)
          } catch {
            // Photo failed — solid fallback is already there
          }
        }

        // Layer 3: bottom-up dark gradient mask for legibility
        const gradientHeight = slide.type === 'cover' ? height : height * 0.55
        const gradient = new Gradient({
          type: 'linear',
          coords: { x1: 0, y1: 0, x2: 0, y2: gradientHeight },
          colorStops: [
            { offset: 0, color: 'rgba(0,0,0,0)' },
            { offset: 0.6, color: 'rgba(0,0,0,0.55)' },
            { offset: 1, color: 'rgba(0,0,0,0.92)' },
          ],
        })
        canvas.add(
          new Rect({
            left: 0,
            top: height - gradientHeight,
            width,
            height: gradientHeight,
            fill: gradient,
            selectable: false,
            evented: false,
          }),
        )

        // Cover-only top vignette so the brand pill stands out on bright photos
        if (slide.type === 'cover') {
          const topGrad = new Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: 0, y2: height * 0.3 },
            colorStops: [
              { offset: 0, color: 'rgba(0,0,0,0.55)' },
              { offset: 1, color: 'rgba(0,0,0,0)' },
            ],
          })
          canvas.add(
            new Rect({
              left: 0,
              top: 0,
              width,
              height: height * 0.3,
              fill: topGrad,
              selectable: false,
              evented: false,
            }),
          )
        }

        // Layer 4a: brand logo top-left (when brand is configured).
        const padX = 56
        const padY = 56
        if (config.logoPublicId) {
          try {
            const logoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${config.logoPublicId}`
            const logo = await FabricImage.fromURL(logoUrl, {
              crossOrigin: 'anonymous',
            })
            if (isCancelled()) return false
            const targetWidth = 180
            logo.scaleToWidth(targetWidth)
            if (logo.getScaledHeight() > 80) logo.scaleToHeight(80)
            logo.set({
              left: padX,
              top: padY,
              originX: 'left',
              originY: 'top',
              selectable: false,
              evented: false,
            })
            canvas.add(logo)
          } catch {
            // Logo unavailable — silently fall through
          }
        }

        // Layer 4b: top-right pill (rank for place slides only).
        if (slide.type === 'place') {
          const pillText = `#${slide.place.rank}${slide.place.from_nearby ? ' · NEARBY' : ''}`
          const pillFontSize = 22
          const pillPadX = 22
          const pillPadY = 12
          const pillTextWidth = pillText.length * pillFontSize * 0.62
          const pillWidth = pillTextWidth + pillPadX * 2
          const pillHeight = pillFontSize + pillPadY * 2
          canvas.add(
            new Rect({
              left: width - padX - pillWidth,
              top: padY,
              width: pillWidth,
              height: pillHeight,
              rx: pillHeight / 2,
              ry: pillHeight / 2,
              fill: accentColor,
              selectable: false,
              evented: false,
            }),
          )
          canvas.add(
            new Text(pillText, {
              fontFamily: fontFamily.mono,
              fontSize: pillFontSize,
              fontWeight: 600,
              fill: '#ffffff',
              charSpacing: 80,
              left: width - padX - pillWidth / 2,
              top: padY + pillHeight / 2,
              originX: 'center',
              originY: 'center',
              selectable: false,
              evented: false,
            }),
          )
        }

        // Layer 5: bottom text stack
        if (slide.type === 'cover') {
          // Cover title — bottom-anchored, leaves room for the swipe hint
          // below it. Auto-shrinks if the title wraps too tall.
          const titleBox = new Textbox(slide.title || '', {
            fontFamily: fontFamily.display,
            fontSize: 110,
            fontWeight: 700,
            fill: '#ffffff',
            lineHeight: 1.05,
            width: width - padX * 2,
            left: padX,
            top: height - padY - 90,
            originX: 'left',
            originY: 'bottom',
            selectable: false,
            evented: false,
          })
          while (titleBox.height > 720 && (titleBox.fontSize as number) > 56) {
            titleBox.set('fontSize', (titleBox.fontSize as number) - 6)
            titleBox.initDimensions()
          }
          canvas.add(titleBox)

          canvas.add(
            new Text('Swipe to see them all  →', {
              fontFamily: fontFamily.body,
              fontSize: 24,
              fontWeight: 400,
              fill: 'rgba(255,255,255,0.75)',
              left: padX,
              top: height - padY,
              originX: 'left',
              originY: 'bottom',
              selectable: false,
              evented: false,
            }),
          )
        } else {
          const place = slide.place
          const lineGap = 18
          let cursor = height - padY

          if (place.address) {
            const addr = new Textbox(place.address, {
              fontFamily: fontFamily.body,
              fontSize: 22,
              fontWeight: 400,
              fill: 'rgba(255,255,255,0.78)',
              lineHeight: 1.3,
              width: width - padX * 2,
              left: padX,
              top: cursor,
              originX: 'left',
              originY: 'bottom',
              selectable: false,
              evented: false,
            })
            canvas.add(addr)
            cursor -= addr.height + lineGap
          }

          if (place.operating_hours) {
            const hours = new Text(`🕐  ${place.operating_hours}`, {
              fontFamily: fontFamily.body,
              fontSize: 24,
              fontWeight: 500,
              fill: '#a7f3d0',
              left: padX,
              top: cursor,
              originX: 'left',
              originY: 'bottom',
              selectable: false,
              evented: false,
            })
            canvas.add(hours)
            cursor -= hours.height + lineGap
          }

          const ratingLabel =
            place.rating_label ||
            (place.rating
              ? `${place.rating} (${place.review_count} reviews)`
              : '')
          if (ratingLabel) {
            const rating = new Text(`★  ${ratingLabel}`, {
              fontFamily: fontFamily.body,
              fontSize: 28,
              fontWeight: 600,
              fill: '#fcd34d',
              left: padX,
              top: cursor,
              originX: 'left',
              originY: 'bottom',
              selectable: false,
              evented: false,
            })
            canvas.add(rating)
            cursor -= rating.height + lineGap + 4
          }

          const name = new Textbox(place.name, {
            fontFamily: fontFamily.display,
            fontSize: 76,
            fontWeight: 700,
            fill: '#ffffff',
            lineHeight: 1.05,
            width: width - padX * 2,
            left: padX,
            top: cursor,
            originX: 'left',
            originY: 'bottom',
            selectable: false,
            evented: false,
          })
          while (name.height > 280 && (name.fontSize as number) > 40) {
            name.set('fontSize', (name.fontSize as number) - 4)
            name.initDimensions()
          }
          name.set({ top: cursor })
          canvas.add(name)
        }

        canvas.renderAll()
        return true
      } catch {
        return false
      }
    },
    [slide, brand, cloudName, config],
  )

  // Double-buffered render: build the new frame on a detached canvas, then
  // blit it onto the visible canvas in one drawImage so the previous frame
  // stays on screen during async font/image loads. Mirrors OnThisDayCanvas.
  useEffect(() => {
    if (!canvasElRef.current) return

    const myGen = ++renderGenRef.current
    const isCancelled = () => myGen !== renderGenRef.current
    const { width, height } = config

    const offscreenEl = document.createElement('canvas')
    offscreenEl.width = width
    offscreenEl.height = height
    const offscreen = new StaticCanvas(offscreenEl, {
      width,
      height,
      backgroundColor: '#1a1a1a',
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
  }, [slide, brand, cloudName, config, renderCanvas])

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
      link.download = filename ?? 'food-places.png'
      link.click()
    },
    getDataUrl() {
      const canvas = fabricRef.current
      if (!canvas) return null
      return canvas.toDataURL({ format: 'png', multiplier: 1 })
    },
  }))

  const { width: cw, height: ch } = config

  return (
    <div className="flex flex-col items-center w-full">
      <div
        className={`w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900${
          onClick ? ' cursor-pointer hover:opacity-90 transition' : ''
        }`}
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
          <div className="flex items-center justify-center h-full text-sm text-neutral-400">
            Rendering preview…
          </div>
        )}
      </div>
    </div>
  )
})
