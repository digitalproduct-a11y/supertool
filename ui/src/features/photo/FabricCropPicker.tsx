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
  const handleCropSave = (region: CropRegion) => {
    onDone(region)
  }

  return (
    <ImageCropAdjuster
      imageUrl={sourceImageUrl}
      aspectRatio={aspectRatio}
      initialRegion={null}
      onSave={handleCropSave}
      onCancel={onCancel}
    />
  )
}
