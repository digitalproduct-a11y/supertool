import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { StaticCanvas, Image as FabricImage, Rect, Text, Textbox, Gradient } from 'fabric'

interface BadmintonPostCanvasProps {
  headline: string
  content: string
  photoUrl: string | null
  brandLogoUrl: string
  cardId?: string
}

export interface BadmintonPostCanvasHandle {
  downloadAsPng: (filename: string) => void
  getDataUrl: () => string
}

const BadmintonPostCanvas = forwardRef<BadmintonPostCanvasHandle, BadmintonPostCanvasProps>(
  ({ headline, content, photoUrl, brandLogoUrl, cardId = 'default' }, ref) => {
    const canvasRef = useRef<StaticCanvas | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasId = `badminton-canvas-${cardId}`

    const CANVAS_WIDTH = 1080
    const CANVAS_HEIGHT = 1350

    useImperativeHandle(ref, () => ({
      downloadAsPng: (filename: string = 'badminton-post.png') => {
        if (!canvasRef.current) return
        const dataUrl = canvasRef.current.toDataURL({ multiplier: 1, format: 'png' })
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = filename
        link.click()
      },
      getDataUrl: () => {
        if (!canvasRef.current) return ''
        return canvasRef.current.toDataURL({ multiplier: 1, format: 'png' })
      },
    }))

    useEffect(() => {
      if (!containerRef.current) return

      const canvas = new StaticCanvas(canvasId, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#000',
      })

      canvasRef.current = canvas

      const renderCanvas = async () => {
        canvas.clear()

        try {
          // 1. Background photo
          if (photoUrl) {
            try {
              const img = await FabricImage.fromURL(photoUrl, { crossOrigin: 'anonymous' })
              img.scaleToWidth(CANVAS_WIDTH)
              if (img.height! < CANVAS_HEIGHT) {
                img.scaleToHeight(CANVAS_HEIGHT)
              }
              img.left = CANVAS_WIDTH / 2
              img.top = CANVAS_HEIGHT / 2
              img.originX = 'center'
              img.originY = 'center'
              canvas.add(img)
            } catch (err) {
              console.error('Failed to load background photo:', err)
            }
          }

          // 2. Gradient overlay (dark at bottom, transparent at top)
          const gradientFill = new Gradient({
            type: 'linear' as const,
            coords: { x1: 0, y1: 0, x2: 0, y2: CANVAS_HEIGHT },
            colorStops: [
              { offset: 0, color: 'rgba(0, 0, 0, 0)' },
              { offset: 0.6, color: 'rgba(0, 0, 0, 0.3)' },
              { offset: 1, color: 'rgba(0, 0, 0, 0.8)' },
            ],
          } as any)
          const gradient = new Rect({
            left: 0,
            top: 0,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            fill: gradientFill,
            selectable: false,
            evented: false,
          })
          canvas.add(gradient)

          // 3. Badminton badge
          const badge = new Text('BADMINTON', {
            left: CANVAS_WIDTH / 2,
            top: 80,
            fontSize: 24,
            fontFamily: 'Montserrat',
            fontWeight: 'bold',
            fill: '#F05A35',
            textAlign: 'center',
            originX: 'center',
            selectable: false,
            evented: false,
          })
          canvas.add(badge)

          // 4. Headline
          const headlineText = new Textbox(headline, {
            left: 40,
            top: 900,
            width: CANVAS_WIDTH - 80,
            fontSize: 48,
            fontFamily: 'Montserrat',
            fontWeight: 'bold',
            fill: '#FFFFFF',
            textAlign: 'left',
            lineHeight: 1.1,
            selectable: false,
            evented: false,
          })
          canvas.add(headlineText)

          // 5. Content/subtitle
          const contentText = new Textbox(content, {
            left: 40,
            top: 1100,
            width: CANVAS_WIDTH - 80,
            fontSize: 18,
            fontFamily: 'Montserrat',
            fontWeight: '400',
            fill: '#E0E0E0',
            textAlign: 'left',
            lineHeight: 1.3,
            selectable: false,
            evented: false,
          })
          canvas.add(contentText)

          // 6. Brand logo at bottom
          if (brandLogoUrl) {
            try {
              const logo = await FabricImage.fromURL(brandLogoUrl, { crossOrigin: 'anonymous' })
              logo.scaleToWidth(120)
              logo.left = CANVAS_WIDTH / 2
              logo.top = CANVAS_HEIGHT - 50
              logo.originX = 'center'
              logo.originY = 'center'
              canvas.add(logo)
            } catch (err) {
              console.error('Failed to load brand logo:', err)
            }
          }

          canvas.renderAll()
        } catch (error) {
          console.error('Error rendering canvas:', error)
        }
      }

      renderCanvas()

      return () => {
        canvas.dispose()
      }
    }, [headline, content, photoUrl, brandLogoUrl])

    return (
      <div ref={containerRef} className="flex justify-center">
        <canvas
          id={canvasId}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            maxWidth: '100%',
            height: 'auto',
          }}
        />
      </div>
    )
  }
)

BadmintonPostCanvas.displayName = 'BadmintonPostCanvas'

export default BadmintonPostCanvas
