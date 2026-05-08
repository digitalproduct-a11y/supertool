import { StaticCanvas, FabricImage, Text } from 'fabric'

export async function renderImageOnCanvas(
  canvas: StaticCanvas,
  photoUrl: string,
  canvasWidth: number,
  canvasHeight: number,
  headline: string = '',
  subtitle: string = '',
  headlineOffset: number = 200,
  subtitleOffset: number = 220,
  brandLogoUrl: string = ''
) {
  canvas.clear()

  if (!photoUrl) {
    canvas.renderAll()
    return
  }

  try {
    // Ensure Montserrat fonts are loaded before rendering
    await document.fonts.load('900 52px Montserrat')
    await document.fonts.load('300 24px Montserrat')
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

    // Add brand logo at top right
    if (brandLogoUrl) {
      try {
        const logo = await FabricImage.fromURL(brandLogoUrl, {
          crossOrigin: 'anonymous',
        })

        const logoSize = (150 * canvasWidth) / 1080
        const padding = (20 * canvasWidth) / 1080
        const maxDimension = Math.max(logo.width || 1, logo.height || 1)
        const scale = logoSize / maxDimension

        logo.set({
          scaleX: scale,
          scaleY: scale,
          left: canvasWidth - logoSize - padding,
          top: padding,
          originX: 'left',
          originY: 'top',
          selectable: false,
          evented: false,
        })

        canvas.add(logo)
        console.log('Brand logo added at top right')
      } catch (err) {
        console.error('Brand logo error:', err)
      }
    }

    // Add headline and subtitle as a grouped unit
    const headlineBoxWidth = (900 * canvasWidth) / 1080
    const headlineFontSize = (64 * canvasWidth) / 1080
    const subtitleFontSize = (36 * canvasWidth) / 1080
    const gap = (20 * canvasHeight) / 1350 // gap between headline and subtitle

    // Wrap headline text
    let headlineLines: string[] = []
    if (headline) {
      const words = headline.split(' ')
      let currentLine = ''
      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.font = `500 ${headlineFontSize}px Montserrat`

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const width = ctx.measureText(testLine).width
        if (width > headlineBoxWidth && currentLine) {
          headlineLines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) headlineLines.push(currentLine)
    }

    // Wrap subtitle text
    let subtitleLines: string[] = []
    if (subtitle) {
      const words = subtitle.split(' ')
      let currentLine = ''
      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.font = `500 ${subtitleFontSize}px Montserrat`

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const width = ctx.measureText(testLine).width
        if (width > headlineBoxWidth && currentLine) {
          subtitleLines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) subtitleLines.push(currentLine)
    }

    // Calculate group dimensions
    const headlineHeight = headlineLines.length * headlineFontSize * 1.2 // line height factor
    const subtitleHeight = subtitleLines.length * subtitleFontSize * 1.2
    const groupHeight = headlineHeight + gap + subtitleHeight
    const groupOffsetFromBottom = (subtitleOffset * canvasHeight) / 1350
    const groupTop = canvasHeight - groupOffsetFromBottom - groupHeight

    // Add headline
    if (headline && headlineLines.length > 0) {
      const headlineText = new Text(headlineLines.join('\n'), {
        left: canvasWidth / 2,
        top: groupTop,
        fontSize: headlineFontSize,
        fontFamily: 'Montserrat',
        fontWeight: 700,
        fill: '#FFFFFF',
        textAlign: 'center',
        originX: 'center',
        originY: 'top',
        selectable: false,
        evented: false,
      })
      canvas.add(headlineText)
      console.log('Headline added with wrapping')
    }

    // Add subtitle
    if (subtitle && subtitleLines.length > 0) {
      const subtitleTop = groupTop + headlineHeight + gap
      const subtitleText = new Text(subtitleLines.join('\n'), {
        left: canvasWidth / 2,
        top: subtitleTop,
        fontSize: subtitleFontSize,
        fontFamily: 'Montserrat',
        fontWeight: 300,
        fill: '#FFFFFF',
        textAlign: 'center',
        originX: 'center',
        originY: 'top',
        selectable: false,
        evented: false,
      })
      canvas.add(subtitleText)
      console.log('Subtitle added with wrapping')
    }

    canvas.renderAll()
  } catch (error) {
    console.error('Error rendering image on canvas:', error)
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.dispatchEvent(new CustomEvent('canvas-utils-updated'))
  })
}
