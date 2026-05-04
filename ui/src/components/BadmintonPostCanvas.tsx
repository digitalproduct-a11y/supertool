import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { StaticCanvas, Image as FabricImage, Rect } from 'fabric'

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
        backgroundColor: '#FFFFFF',
      })

      canvasRef.current = canvas

      const renderCanvas = async () => {
        canvas.clear()

        try {
          // Background photo - crop to fill (like Cloudinary c_fill)
          if (photoUrl) {
            try {
              const img = await FabricImage.fromURL(photoUrl, { crossOrigin: 'anonymous' })
              const imgWidth = img.width || CANVAS_WIDTH
              const imgHeight = img.height || CANVAS_HEIGHT

              // Calculate scale to cover canvas (Math.max ensures no gaps)
              const scaleX = CANVAS_WIDTH / imgWidth
              const scaleY = CANVAS_HEIGHT / imgHeight
              const scale = Math.max(scaleX, scaleY)

              img.scale(scale)
              img.left = CANVAS_WIDTH / 2
              img.top = CANVAS_HEIGHT / 2
              img.originX = 'center'
              img.originY = 'center'
              img.clipPath = new Rect({
                left: -CANVAS_WIDTH / 2,
                top: -CANVAS_HEIGHT / 2,
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                absolutePositioned: true,
              })
              canvas.add(img)
            } catch (err) {
              console.error('Failed to load background photo:', err)
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
    }, [headline, content, photoUrl, brandLogoUrl, canvasId])

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
