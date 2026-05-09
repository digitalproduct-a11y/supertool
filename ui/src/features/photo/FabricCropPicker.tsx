import { useEffect, useState } from 'react'
import { ImageCropAdjuster, type CropRegion } from '../quote/ImageCropAdjuster'

interface FabricCropPickerProps {
  sourceImageUrl: string
  aspectRatio: number
  onDone: (cropRegion: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}

export function FabricCropPicker({
  sourceImageUrl,
  aspectRatio,
  onDone,
  onCancel,
}: FabricCropPickerProps) {
  const [imageNaturalSize, setImageNaturalSize] = useState<{ w: number; h: number } | null>(null)

  // Load image to get natural dimensions
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = sourceImageUrl
  }, [sourceImageUrl])

  const handleCropSave = (region: CropRegion) => {
    onDone(region)
  }

  return (
    <ImageCropAdjuster
      imageUrl={sourceImageUrl}
      aspectRatio={aspectRatio}
      initialRegion={null}
      onSave={handleCropSave}
      onReset={() => {
        // When reset, use center of image as focal point
        const focalX = 0.5
        const focalY = 0.5
        onDone(focalX, focalY)
      }}
      onCancel={onCancel}
    />
  )
}
