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

/**
 * Replaces the base image in a Cloudinary URL while preserving all overlay
 * transformations. Handles both /image/upload/ and /image/fetch/ source URLs
 * but always outputs an /image/upload/ URL (for custom user-uploaded replacements).
 *
 * Uses a comma heuristic: transform segments always contain commas (e.g. c_fill,w_1080),
 * while the base image segment (public_id or encoded fetch URL) never does.
 *
 * .../image/upload/{transforms}/{old_public_id.jpg}  → .../image/upload/{transforms}/{newPublicId}
 * .../image/fetch/{transforms}/{encodedPexelsUrl}    → .../image/upload/{transforms}/{newPublicId}
 */
export function replaceBaseImage(originalUrl: string, newPublicId: string): string {
  const uploadPrefix = '/image/upload/'
  const fetchPrefix  = '/image/fetch/'

  let prefixIdx = originalUrl.indexOf(uploadPrefix)
  let prefixLen = uploadPrefix.length

  if (prefixIdx === -1) {
    prefixIdx = originalUrl.indexOf(fetchPrefix)
    prefixLen = fetchPrefix.length
  }

  if (prefixIdx === -1) return originalUrl

  const base = originalUrl.substring(0, prefixIdx)
  const afterPrefix = originalUrl.substring(prefixIdx + prefixLen)
  const segments = afterPrefix.split('/')

  // Find the last segment that contains a comma — that's the final transform.
  // Encoded Pexels URLs (%2F, %2C etc.) contain no literal commas, so they're
  // correctly identified as the base image segment, not a transform.
  let lastTransformIdx = -1
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].includes(',')) lastTransformIdx = i
  }

  if (lastTransformIdx < 0) return originalUrl

  const transforms = segments.slice(0, lastTransformIdx + 1).join('/')
  // Always produce an upload URL regardless of whether source was fetch or upload
  return `${base}/image/upload/${transforms}/${newPublicId}`
}

/**
 * Uploads an image file to Cloudinary using unsigned upload.
 * Returns the public_id on success.
 */
export async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_TEMP_UPLOADS_PRESET as string | undefined

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary configuration missing')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`)
  }

  const data = await res.json()
  return data.public_id as string
}

/**
 * Builds a Cloudinary transformation URL for "Did You Know" cards (Tribune design).
 * Layout: full-bleed photo → gradient overlay → headline (serif italic) → fact with accent rule.
 */
export function buildDidYouKnowUrl(
  baseImagePublicId: string,
  headline: string,
  fact: string
): string {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  if (!cloudName) throw new Error('Cloudinary cloud name not configured')

  const encHead = cloudinaryTextEncode(headline)
  const encFact = cloudinaryTextEncode(fact)

  // Base: fill 1080x1350, centered
  const transforms = [
    'c_fill,g_center,w_1080,h_1350',
    // Gradient overlay (5-stop linear gradient, 180° angle, 0.92 intensity)
    'l_gradient:msl_on_transparent,angle_180,co_rgb:060608,e_grayscale,o_15,w_1080,h_1350/l_gradient:msl_on_transparent,angle_180,co_rgb:060608,e_grayscale,o_55,w_1080,h_1350/l_gradient:msl_on_transparent,angle_180,co_rgb:060608,e_grayscale,o_88,w_1080,h_1350/l_gradient:msl_on_transparent,angle_180,co_rgb:060608,e_grayscale,o_92,w_1080,h_1350',
    // Top darkener (280px height)
    'l_text:arial_1:__,co_rgb:060608,o_78,y_-535,g_north,h_280,w_1080',
    // Headline (Instrument Serif, italic, 72px, positioned from bottom: 300px)
    `l_text:Georgia_italic_72:${encHead},co_rgb:faf7ee,y_300,g_south,w_900,c_fit`,
    // Fact body (Inter, 18px, positioned from bottom: 80px)
    `l_text:Arial_18:${encFact},co_rgb:f5f2ea,y_80,g_south,w_900,c_fit`,
  ].join('/')

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${baseImagePublicId}`
}
