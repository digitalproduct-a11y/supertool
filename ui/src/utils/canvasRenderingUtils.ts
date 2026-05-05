import { StaticCanvas, FabricImage, Text } from 'fabric'

export async function renderImageOnCanvas(
  canvas: StaticCanvas,
  photoUrl: string,
  canvasWidth: number,
  canvasHeight: number,
  headline: string = ''
) {
  canvas.clear()

  if (!photoUrl) {
    canvas.renderAll()
    return
  }

  try {
    console.log('Loading image from:', photoUrl)
    const img = await FabricImage.fromURL(photoUrl, {
      crossOrigin: 'anonymous',
    })
    console.log('Image loaded, dimensions:', img.width, 'x', img.height)

    const imgWidth = img.width || canvasWidth
    const imgHeight = img.height || canvasHeight

    // Vertical image (taller than wide): fill 100% width
    // Horizontal image (wider than tall): fill 100% height
    const scaleX = canvasWidth / imgWidth
    const scaleY = canvasHeight / imgHeight
    const isHorizontal = imgWidth > imgHeight
    const scale = isHorizontal ? scaleY : scaleX

    // Calculate scaled dimensions
    const scaledWidth = imgWidth * scale
    const scaledHeight = imgHeight * scale

    // Center horizontally and vertically
    const left = (canvasWidth - scaledWidth) / 2
    const top = (canvasHeight - scaledHeight) / 2

    img.set({
      scaleX: scale,
      scaleY: scale,
      left: left,
      top: top,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
    })

    console.log(`Scaled with scale factor: ${scale}, dimensions: ${scaledWidth}x${scaledHeight}, position: (${left}, ${top})`)

    canvas.add(img)

    // Add bottom gradient overlay using canvas gradient
    try {
      const gradCanvas = document.createElement('canvas')
      gradCanvas.width = canvasWidth
      gradCanvas.height = canvasHeight
      const gradCtx = gradCanvas.getContext('2d')!

      const grad = gradCtx.createLinearGradient(0, canvasHeight * 0.3, 0, canvasHeight)
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
      grad.addColorStop(1, 'rgba(0, 0.5, 0.9, 1)')

      gradCtx.fillStyle = grad
      gradCtx.fillRect(0, 0, canvasWidth, canvasHeight)

      const gradImageUrl = gradCanvas.toDataURL('image/png')
      const gradImg = await FabricImage.fromURL(gradImageUrl)

      gradImg.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      })

      canvas.add(gradImg)
      console.log('Gradient overlay added')
    } catch (err) {
      console.error('Gradient overlay error:', err)
    }

    // Add headline text with word wrapping
    if (headline) {
      const headlineBoxWidth = (985 * canvasWidth) / 1080
      const fontSize = (52 * canvasWidth) / 1080
      const offsetFromBottom = (160 * canvasHeight) / 1350

      // Wrap text by measuring actual word widths
      const words = headline.split(' ')
      const lines: string[] = []
      let currentLine = ''

      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.font = `bold ${fontSize}px Montserrat`

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const width = ctx.measureText(testLine).width

        if (width > headlineBoxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) lines.push(currentLine)

      const headlineText = new Text(lines.join('\n'), {
        left: canvasWidth / 2,
        top: canvasHeight - offsetFromBottom,
        fontSize,
        fontFamily: 'Montserrat',
        fontWeight: 'bold',
        fill: '#FFFFFF',
        textAlign: 'center',
        originX: 'center',
        originY: 'bottom',
        selectable: false,
        evented: false,
      })
      canvas.add(headlineText)
      console.log('Headline added with wrapping')
    }

    canvas.renderAll()
  } catch (error) {
    console.error('Error rendering image on canvas:', error)
  }
}
