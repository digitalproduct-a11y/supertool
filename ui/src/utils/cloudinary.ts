/**
 * Encodes text for use in Cloudinary URL text layers.
 * Must match n8n's cloudinaryTextEncode function exactly.
 */
export function cloudinaryTextEncode(str: string): string {
  const encoded = encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return encoded.replace(/%/g, "%25");
}

/**
 * Builds the delivery URL for a brand logo from its Cloudinary public_id
 * (e.g. `astro_awani_logo`). Matches the pattern used across the Fabric canvases.
 */
export function brandLogoUrl(logoId: string): string {
  return `https://res.cloudinary.com/dymmqtqyg/image/upload/${logoId}`;
}

/**
 * Builds the delivery URL for a brand overlay/background template from its
 * Cloudinary public_id. Cloudinary's library is flat, so `slug` is ignored here
 * (it only shapes the ImageKit path). Mirrors the ImageKit counterpart's signature.
 */
export function brandTemplateUrl(_slug: string, templateId: string): string {
  return `https://res.cloudinary.com/dymmqtqyg/image/upload/${templateId}`;
}

const CLOUD_NAME =
  (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim() ||
  "dymmqtqyg";

/**
 * Delivery URL for a freshly-uploaded image from its Cloudinary public_id
 * (the raw asset, no transforms). Mirrors the ImageKit counterpart's signature.
 */
export function uploadedImageUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}`;
}

/**
 * Applies an explicit rectangular crop region (in source pixels) to a Cloudinary
 * URL by inserting `c_crop` before the first `c_fill` sizing step, then re-filling
 * to the same canvas size. Returns the URL unchanged if no such sizing step exists.
 * Synchronous (no cache-buster) — callers add one when needed.
 */
export function applyRegionCrop(
  url: string,
  region: { x: number; y: number; width: number; height: number },
): string {
  const x = Math.round(region.x);
  const y = Math.round(region.y);
  const w = Math.round(region.width);
  const h = Math.round(region.height);
  return url.replace(
    /c_fill,g_[^,/]+,w_(\d+),h_(\d+)/,
    `c_crop,x_${x},y_${y},w_${w},h_${h}/c_fill,g_center,w_$1,h_$2`,
  );
}

// Mirrors n8n's normalize() used across brand Image Layout nodes:
// collapse whitespace, straight-quote smart quotes, hyphenate dashes.
function normalizeTitle(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");
}

const singleEncode = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );

/**
 * Replaces the encoded original title in a Cloudinary imageUrl with a new encoded title.
 * Uses replaceAll so brands with two title layers (e.g. Rasa shadow + main) both update.
 * Tries double-encoded and uppercase variants to cover all brand templates.
 */
export function updateTitleInImageUrl(
  imageUrl: string,
  originalTitle: string,
  newTitle: string,
): string {
  if (!originalTitle || !newTitle) return imageUrl;

  const normalizedOriginal = normalizeTitle(originalTitle);

  // Each strategy: [encode fn, case transform]
  // The same case transform is applied to original (for matching) and new title (for replacement),
  // so brands that render UPPERCASE (ERA, Hitz, Gegar, etc.) stay UPPERCASE after edits.
  const strategies: Array<[(s: string) => string, (s: string) => string]> = [
    [cloudinaryTextEncode, (s) => s], // double-encoded, as-is (most brands)
    [cloudinaryTextEncode, (s) => s.toUpperCase()], // double-encoded, uppercase (ERA, Hitz, Gegar, etc.)
    [singleEncode, (s) => s], // single-encoded, as-is (fallback)
    [singleEncode, (s) => s.toUpperCase()], // single-encoded, uppercase (fallback)
    [encodeURIComponent, (s) => s], // plain encodeURIComponent (fallback)
  ];

  for (const [encode, caseTransform] of strategies) {
    const encodedOriginal = encode(caseTransform(normalizedOriginal));
    if (encodedOriginal && imageUrl.includes(encodedOriginal)) {
      // replaceAll: Rasa has two layers (shadow + main) with the same encoded text
      return imageUrl.replaceAll(
        encodedOriginal,
        encode(caseTransform(newTitle)),
      );
    }
  }

  return imageUrl;
}

/**
 * Replaces the encoded original subtitle in a Cloudinary imageUrl with a new encoded subtitle.
 * Only used for Era Sarawak and Era Sabah which have a sub_title text layer.
 */
export function updateSubtitleInImageUrl(
  imageUrl: string,
  originalSubtitle: string,
  newSubtitle: string,
): string {
  if (!originalSubtitle) return imageUrl;

  const normalizedOriginal = normalizeTitle(originalSubtitle);

  const strategies: Array<(s: string) => string> = [
    cloudinaryTextEncode,
    singleEncode,
    encodeURIComponent,
  ];

  for (const encode of strategies) {
    const encodedOriginal = encode(normalizedOriginal);
    if (encodedOriginal && imageUrl.includes(encodedOriginal)) {
      return imageUrl.replaceAll(
        encodedOriginal,
        encode(normalizeTitle(newSubtitle)),
      );
    }
  }

  return imageUrl;
}

/** Brands that have a subtitle text layer in their Cloudinary template. */
export const SUBTITLE_BRANDS = new Set(["era sarawak", "era sabah"]);

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
export function replaceBaseImage(
  originalUrl: string,
  newPublicId: string,
): string {
  const uploadPrefix = "/image/upload/";
  const fetchPrefix = "/image/fetch/";

  let prefixIdx = originalUrl.indexOf(uploadPrefix);
  let prefixLen = uploadPrefix.length;

  if (prefixIdx === -1) {
    prefixIdx = originalUrl.indexOf(fetchPrefix);
    prefixLen = fetchPrefix.length;
  }

  if (prefixIdx === -1) return originalUrl;

  const base = originalUrl.substring(0, prefixIdx);
  const afterPrefix = originalUrl.substring(prefixIdx + prefixLen);
  const segments = afterPrefix.split("/");

  // Find the last segment that contains a comma — that's the final transform.
  // Encoded Pexels URLs (%2F, %2C etc.) contain no literal commas, so they're
  // correctly identified as the base image segment, not a transform.
  let lastTransformIdx = -1;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].includes(",")) lastTransformIdx = i;
  }

  if (lastTransformIdx < 0) return originalUrl;

  const transforms = segments.slice(0, lastTransformIdx + 1).join("/");
  // Always produce an upload URL regardless of whether source was fetch or upload
  return `${base}/image/upload/${transforms}/${newPublicId}`;
}

/**
 * Rewrites a Cloudinary `/image/upload/` URL to fetch a subject-aware crop
 * sized for the target canvas. Uses Cloudinary's free-tier `g_auto`, which
 * picks the focal region using content analysis — keeps the article's main
 * subject in frame instead of relying on geometric center.
 *
 * Returns the original URL unchanged for non-Cloudinary inputs (blob:, data:,
 * external URLs) and for URLs that already carry a `c_fill`/`g_auto` segment
 * (idempotent — safe to call repeatedly).
 */
export function withSubjectAwareCrop(
  url: string | null | undefined,
  width: number,
  height: number,
): string {
  if (!url) return "";
  // Crop works on both delivery types: /image/upload/ (stored asset) and
  // /image/fetch/ (remote URL proxied through Cloudinary, CORS-safe).
  const marker = url.includes("/image/upload/")
    ? "/image/upload/"
    : url.includes("/image/fetch/")
      ? "/image/fetch/"
      : null;
  if (!marker) return url;
  if (/\/(c_fill|g_auto)[,/]/.test(url)) return url;

  const w = Math.round(width);
  const h = Math.round(height);
  // Reduce ar to lowest terms so the param matches Cloudinary's expected form
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h);
  const transform = `c_fill,g_auto,ar_${w / g}:${h / g},w_${w},h_${h},f_auto,q_auto`;

  return url.replace(marker, `${marker}${transform}/`);
}

interface CloudinarySignature {
  signature: string;
  api_key: string;
  timestamp: number;
  cloud_name: string;
}

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  [key: string]: unknown;
}

// Fetches a fresh upload signature from the n8n signing webhook.
// Webhook holds CLOUDINARY_API_SECRET as an n8n credential — never reaches the browser.
// extraParams (e.g. tags) must be signed alongside upload_preset, so they're
// forwarded to the webhook and must come back reflected in the same request body.
async function getUploadSignature(
  uploadPreset: string,
  extraParams?: Record<string, string>,
): Promise<CloudinarySignature> {
  const signWebhookUrl = (
    import.meta.env.VITE_CLOUDINARY_SIGN_WEBHOOK_URL as string | undefined
  )?.trim();
  if (!signWebhookUrl) {
    throw new Error("Cloudinary sign webhook not configured");
  }

  const res = await fetch(signWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_preset: uploadPreset, ...extraParams }),
  });
  if (!res.ok) throw new Error(`Signature request failed: ${res.status}`);
  return (await res.json()) as CloudinarySignature;
}

/**
 * Signed upload to Cloudinary. Fetches a signature from the n8n signing webhook,
 * then uploads the file/URL directly to Cloudinary with the signed params.
 * The API secret never leaves n8n.
 */
export async function signedUploadToCloudinary(
  fileOrUrl: File | string | Blob,
  uploadPreset?: string,
  extraParams?: Record<string, string>,
): Promise<CloudinaryUploadResponse> {
  const preset =
    uploadPreset ??
    ((import.meta.env.VITE_CLOUDINARY_TEMP_UPLOADS_PRESET as
      | string
      | undefined)?.trim() ||
      "temp_uploads");

  const { signature, api_key, timestamp, cloud_name } =
    await getUploadSignature(preset, extraParams);

  const formData = new FormData();
  formData.append("file", fileOrUrl);
  formData.append("upload_preset", preset);
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      formData.append(key, value);
    }
  }
  formData.append("api_key", api_key);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${errText}`);
  }

  return (await res.json()) as CloudinaryUploadResponse;
}

/**
 * Uploads an image file to Cloudinary using signed upload.
 * Returns the public_id on success.
 */
export async function uploadToCloudinary(file: File): Promise<string> {
  const { public_id } = await signedUploadToCloudinary(file);
  return public_id;
}

/**
 * Replaces the encoded text for a single bullet-point fact layer in a Cloudinary URL.
 * Uses the same encoding strategies as updateTitleInImageUrl, but replaces only the
 * first match (facts appear once; title layers can appear twice for shadow brands).
 *
 * factIndex is reserved for future use when the n8n URL structure is finalised.
 */
export function updateFactInImageUrl(
  imageUrl: string,
  _factIndex: number,
  oldText: string,
  newText: string
): string {
  if (!oldText || !newText) return imageUrl

  const normalizedOld = normalizeTitle(oldText)

  const strategies: Array<[(s: string) => string, (s: string) => string]> = [
    [cloudinaryTextEncode, s => s],
    [cloudinaryTextEncode, s => s.toUpperCase()],
    [singleEncode, s => s],
    [singleEncode, s => s.toUpperCase()],
    [encodeURIComponent, s => s],
  ]

  for (const [encode, caseTransform] of strategies) {
    const encodedOld = encode(caseTransform(normalizedOld))
    if (encodedOld && imageUrl.includes(encodedOld)) {
      return imageUrl.replace(encodedOld, encode(caseTransform(newText)))
    }
  }

  return imageUrl
}

/**
 * Extracts the raw base image URL from a Cloudinary /image/fetch/ URL.
 * Pexels images in the carousel are served as Cloudinary fetch URLs; this
 * recovers the original Pexels URL so we can re-upload without double-overlays.
 * Returns null if the URL is not a Cloudinary fetch URL.
 */
export function extractBaseImageUrl(cloudinaryUrl: string): string | null {
  const fetchPrefix = '/image/fetch/'
  const prefixIdx = cloudinaryUrl.indexOf(fetchPrefix)
  if (prefixIdx === -1) return null

  const afterPrefix = cloudinaryUrl.substring(prefixIdx + fetchPrefix.length)
  const segments = afterPrefix.split('/')

  // The last segment with a comma is the final transform layer.
  // The encoded source URL follows it as a single segment (/ chars are %2F).
  let lastTransformIdx = -1
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].includes(',')) lastTransformIdx = i
  }

  if (lastTransformIdx < 0 || lastTransformIdx >= segments.length - 1) return null

  try {
    return decodeURIComponent(segments[lastTransformIdx + 1])
  } catch {
    return null
  }
}

/**
 * Uploads an image from a URL to Cloudinary using signed upload.
 * Cloudinary fetches the URL server-side (avoids browser CORS issues).
 * Returns the public_id on success.
 */
export async function uploadUrlToCloudinary(url: string): Promise<string> {
  const { public_id } = await signedUploadToCloudinary(url)
  return public_id
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

  const transforms = [
    'c_fill,g_center,w_1080,h_1350',
    'l_gradient:msl_on_transparent,angle_180,co_rgb:060608,e_grayscale,o_15,w_1080,h_1350/l_gradient:msl_on_transparent,angle_180,co_rgb:060608,e_grayscale,o_55,w_1080,h_1350/l_gradient:msl_on_transparent,angle_180,co_rgb:060608,e_grayscale,o_88,w_1080,h_1350/l_gradient:msl_on_transparent,angle_180,co_rgb:060608,e_grayscale,o_92,w_1080,h_1350',
    'l_text:arial_1:__,co_rgb:060608,o_78,y_-535,g_north,h_280,w_1080',
    `l_text:Georgia_italic_72:${encHead},co_rgb:faf7ee,y_300,g_south,w_900,c_fit`,
    `l_text:Arial_18:${encFact},co_rgb:f5f2ea,y_80,g_south,w_900,c_fit`,
  ].join('/')

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${baseImagePublicId}`
}
