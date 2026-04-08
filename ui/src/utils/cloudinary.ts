/**
 * Encodes text for use in Cloudinary URL text layers.
 * Must match n8n's cloudinaryTextEncode function exactly.
 */
export function cloudinaryTextEncode(str: string): string {
  let encoded = encodeURIComponent(str).replace(/[!'()*]/g, (c) =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase()
  )
  return encoded.replace(/%/g, '%25')
}

/**
 * Replaces the encoded original title in a Cloudinary imageUrl with a new encoded title.
 * Uses string replacement so it works across all brand templates without knowing their configs.
 */
export function updateTitleInImageUrl(imageUrl: string, originalTitle: string, newTitle: string): string {
  if (!originalTitle || !newTitle) return imageUrl
  const encodedOriginal = cloudinaryTextEncode(originalTitle)
  const encodedNew = cloudinaryTextEncode(newTitle)
  return imageUrl.replace(encodedOriginal, encodedNew)
}
