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
 * Tries multiple encoding strategies to handle brand nodes that use different encoding approaches.
 */
export function updateTitleInImageUrl(imageUrl: string, originalTitle: string, newTitle: string): string {
  if (!originalTitle || !newTitle) return imageUrl

  // Single-encoded RFC variant (encodeURIComponent + special chars, no double-% step)
  const singleEncode = (s: string) =>
    encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())

  const strategies: Array<(s: string) => string> = [
    cloudinaryTextEncode, // double-encoded (most brands)
    singleEncode,         // single-encoded RFC variant (Era, Gegar, Hitz, etc.)
    encodeURIComponent,   // plain encodeURIComponent fallback
  ]

  for (const encode of strategies) {
    const encodedOriginal = encode(originalTitle)
    if (encodedOriginal && imageUrl.includes(encodedOriginal)) {
      return imageUrl.replace(encodedOriginal, encode(newTitle))
    }
  }

  return imageUrl
}
