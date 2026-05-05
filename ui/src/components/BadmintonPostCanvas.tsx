import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { StaticCanvas } from 'fabric'
import { renderImageOnCanvas } from '../utils/canvasRenderingUtils'

interface BadmintonPostCanvasProps {
  headline: string
  content: string
  photoUrl: string | null
  brandLogoUrl: string
}

export interface BadmintonPostCanvasHandle {
  downloadAsPng: (filename: string) => void
  getDataUrl: () => string
}

const BadmintonPostCanvas = forwardRef<BadmintonPostCanvasHandle, BadmintonPostCanvasProps>(
  ({ headline, content, photoUrl, brandLogoUrl }, ref) => {
    const canvasElRef = useRef<HTMLCanvasElement>(null)
    const fabricRef = useRef<StaticCanvas | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const CANVAS_WIDTH = 1080
    const CANVAS_HEIGHT = 1350

    const renderCanvas = useCallback(
      async (canvas: StaticCanvas) => {
        if (photoUrl) {
          await renderImageOnCanvas(canvas, photoUrl, CANVAS_WIDTH, CANVAS_HEIGHT, headline)
        } else {
          canvas.clear()
          canvas.renderAll()
        }
      },
      [photoUrl, headline]
    )

    useImperativeHandle(ref, () => ({
      downloadAsPng: (filename: string = 'badminton-post.png') => {
        if (!fabricRef.current) return
        const dataUrl = fabricRef.current.toDataURL({ format: 'png', multiplier: 1 })
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = filename
        link.click()
      },
      getDataUrl: () => {
        if (!fabricRef.current) return ''
        return fabricRef.current.toDataURL({ format: 'png', multiplier: 1 })
      },
    }))

    useEffect(() => {
      if (!canvasElRef.current) return

      const canvas = new StaticCanvas(canvasElRef.current, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: 'transparent',
      })

      renderCanvas(canvas).then(() => {
        const prev = fabricRef.current
        fabricRef.current = canvas
        if (prev) prev.dispose()
      })

      return () => {
        if (canvas) canvas.dispose()
      }
    }, [headline, content, photoUrl, brandLogoUrl, renderCanvas])

    return (
      <div
        ref={containerRef}
        className="rounded-xl overflow-hidden"
        style={{
          aspectRatio: '1080 / 1350',
          width: '100%',
          height: '100%',
        }}
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
      </div>
    )
  }
)

BadmintonPostCanvas.displayName = 'BadmintonPostCanvas'

export default BadmintonPostCanvas
