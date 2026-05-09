/**
 * Rebuild a Cloudinary image URL with explicit crop region.
 * Extracts the selected rectangular region and fills canvas.
 */
export async function applyFocalCrop(
  finalImageUrl: string,
  cropRegion: { x: number; y: number; width: number; height: number },
): Promise<string> {
  // Use Cloudinary's c_crop to extract the exact rectangular region
  const x = Math.round(cropRegion.x)
  const y = Math.round(cropRegion.y)
  const w = Math.round(cropRegion.width)
  const h = Math.round(cropRegion.height)

  // Replace the first c_fill transformation to include crop extraction before fill
  let newUrl = finalImageUrl.replace(
    /c_fill,g_[^,/]+,w_(\d+),h_(\d+)/,
    `c_crop,x_${x},y_${y},w_${w},h_${h}/c_fill,g_center,w_$1,h_$2`,
  )

  // Add cache buster
  const separator = newUrl.includes('?') ? '&' : '?'
  newUrl = `${newUrl}${separator}cb=${Date.now()}`

  return newUrl
}
