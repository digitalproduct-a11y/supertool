import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { StaticCanvas, Image as FabricImage } from 'fabric'

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
              console.log('Loading image from:', photoUrl)
              const img = await FabricImage.fromURL(photoUrl, {
                crossOrigin: 'anonymous',
              })
              console.log('Image loaded, dimensions:', img.width, 'x', img.height)

              const imgWidth = img.width || CANVAS_WIDTH
              const imgHeight = img.height || CANVAS_HEIGHT

              // Calculate scale to cover canvas (Math.max ensures no gaps)
              const scaleX = CANVAS_WIDTH / imgWidth
              const scaleY = CANVAS_HEIGHT / imgHeight
              const scale = Math.max(scaleX, scaleY)

              img.scale(scale)
              img.set({
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top',
              })

              canvas.add(img)
              canvas.renderAll()
              console.log('Image rendered successfully')
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
