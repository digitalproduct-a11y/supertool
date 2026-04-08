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

// Mirrors n8n's normalize() used across brand Image Layout nodes:
// collapse whitespace, straight-quote smart quotes, hyphenate dashes.
function normalizeTitle(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
}

const singleEncode = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())

/**
 * Replaces the encoded original title in a Cloudinary imageUrl with a new encoded title.
 * Uses replaceAll so brands with two title layers (e.g. Rasa shadow + main) both update.
 * Tries double-encoded and uppercase variants to cover all brand templates.
 */
export function updateTitleInImageUrl(imageUrl: string, originalTitle: string, newTitle: string): string {
  if (!originalTitle || !newTitle) return imageUrl

  const normalizedOriginal = normalizeTitle(originalTitle)

  // Each strategy: [encode fn, case transform]
  // The same case transform is applied to original (for matching) and new title (for replacement),
  // so brands that render UPPERCASE (ERA, Hitz, Gegar, etc.) stay UPPERCASE after edits.
  const strategies: Array<[(s: string) => string, (s: string) => string]> = [
    [cloudinaryTextEncode, s => s],               // double-encoded, as-is (most brands)
    [cloudinaryTextEncode, s => s.toUpperCase()], // double-encoded, uppercase (ERA, Hitz, Gegar, etc.)
    [singleEncode, s => s],                       // single-encoded, as-is (fallback)
    [singleEncode, s => s.toUpperCase()],         // single-encoded, uppercase (fallback)
    [encodeURIComponent, s => s],                 // plain encodeURIComponent (fallback)
  ]

  for (const [encode, caseTransform] of strategies) {
    const encodedOriginal = encode(caseTransform(normalizedOriginal))
    if (encodedOriginal && imageUrl.includes(encodedOriginal)) {
      // replaceAll: Rasa has two layers (shadow + main) with the same encoded text
      return imageUrl.replaceAll(encodedOriginal, encode(caseTransform(newTitle)))
    }
  }

  return imageUrl
}

/**
 * Replaces the encoded original subtitle in a Cloudinary imageUrl with a new encoded subtitle.
 * Only used for Era Sarawak and Era Sabah which have a sub_title text layer.
 */
export function updateSubtitleInImageUrl(imageUrl: string, originalSubtitle: string, newSubtitle: string): string {
  if (!originalSubtitle) return imageUrl

  const normalizedOriginal = normalizeTitle(originalSubtitle)

  const strategies: Array<(s: string) => string> = [
    cloudinaryTextEncode,
    singleEncode,
    encodeURIComponent,
  ]

  for (const encode of strategies) {
    const encodedOriginal = encode(normalizedOriginal)
    if (encodedOriginal && imageUrl.includes(encodedOriginal)) {
      return imageUrl.replaceAll(encodedOriginal, encode(normalizeTitle(newSubtitle)))
    }
  }

  return imageUrl
}

/** Brands that have a subtitle text layer in their Cloudinary template. */
export const SUBTITLE_BRANDS = new Set(['era sarawak', 'era sabah'])
