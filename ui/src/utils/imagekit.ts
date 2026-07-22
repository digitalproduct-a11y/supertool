/**
 * ImageKit counterpart to utils/cloudinary.ts.
 *
 * Delivered image URLs follow the scheme validated during the migration pilot:
 *   {endpoint}/{basePath}?tr=<step1>:<step2>:...:<textLayer>
 * where the cloned n8n "Image Layout" nodes bake the title into an `l-text` layer
 * using `ie-<base64(text)>` (percent-encoded). The browser edits the title by
 * rewriting that `ie-` segment, so `imagekitTextEncode` here MUST match the encoder
 * in the cloned workflow byte-for-byte (both use `encodeURIComponent(btoa(utf8))`).
 *
 * Media-library paths inside layers use `@@` in place of `/`
 * (e.g. `l-image,i-brands@@astro_awani@@templates@@POSTER-transparent_zdactl`).
 */

import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalInstance, loginRequest } from "../auth/msalConfig";

const ENDPOINT = (
  (import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT as string | undefined)?.trim() ||
  "https://ik.imagekit.io/clckj9ic2"
).replace(/\/$/, "");

// ── Text encoding ───────────────────────────────────────────────────────────

/** UTF-8 safe base64 (btoa only handles Latin1, so encode bytes first). */
function base64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Encodes text for an ImageKit `ie-` overlay segment: base64 (UTF-8) then
 * percent-encode so `+`, `/`, `=` survive inside the URL. Must match the cloned
 * n8n node's `imagekitTextEncode` exactly.
 */
export function imagekitTextEncode(str: string): string {
  return encodeURIComponent(base64Utf8(str));
}

// Mirrors n8n's normalize() used across brand Image Layout nodes:
// collapse whitespace, straight-quote smart quotes, hyphenate dashes.
function normalizeTitle(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-");
}

// ── URL parsing helpers ───────────────────────────────────────────────────────

/** Splits an ImageKit delivery URL into base (before `?`) and the `tr` value. */
function splitTr(url: string): { base: string; tr: string; rest: string } | null {
  const qIdx = url.indexOf("?");
  if (qIdx === -1) return { base: url, tr: "", rest: "" };
  const base = url.slice(0, qIdx);
  const query = url.slice(qIdx + 1);
  // tr is kept literal (commas/colons must not be percent-encoded), so parse by hand.
  const parts = query.split("&");
  let tr = "";
  const others: string[] = [];
  for (const p of parts) {
    if (p.startsWith("tr=")) tr = p.slice(3);
    else others.push(p);
  }
  return { base, tr, rest: others.join("&") };
}

function joinTr(base: string, tr: string, rest: string): string {
  const q = [tr ? `tr=${tr}` : "", rest].filter(Boolean).join("&");
  return q ? `${base}?${q}` : base;
}

// ── Title / subtitle / fact editing (rewrite the `ie-` overlay segment) ────────

/**
 * Replaces the encoded original title in an ImageKit imageUrl with a new one.
 * Tries as-is and uppercase variants so uppercase brands (ERA, Hitz, Gegar…)
 * stay uppercase. replaceAll covers brands with two title layers (e.g. Rasa).
 */
export function updateTitleInImageUrl(
  imageUrl: string,
  originalTitle: string,
  newTitle: string,
): string {
  if (!originalTitle || !newTitle) return imageUrl;
  const normalizedOriginal = normalizeTitle(originalTitle);

  // [case transform] applied to both original (match) and new (replacement).
  const caseTransforms: Array<(s: string) => string> = [
    (s) => s,
    (s) => s.toUpperCase(),
  ];

  for (const caseFn of caseTransforms) {
    const encodedOriginal = imagekitTextEncode(caseFn(normalizedOriginal));
    const needle = `ie-${encodedOriginal}`;
    if (imageUrl.includes(needle)) {
      const replacement = `ie-${imagekitTextEncode(caseFn(newTitle))}`;
      return imageUrl.replaceAll(needle, replacement);
    }
  }
  return imageUrl;
}

/**
 * Replaces the encoded subtitle. Only Era Sarawak / Era Sabah have a subtitle
 * text layer.
 */
export function updateSubtitleInImageUrl(
  imageUrl: string,
  originalSubtitle: string,
  newSubtitle: string,
): string {
  if (!originalSubtitle) return imageUrl;
  const encodedOriginal = imagekitTextEncode(normalizeTitle(originalSubtitle));
  const needle = `ie-${encodedOriginal}`;
  if (imageUrl.includes(needle)) {
    return imageUrl.replaceAll(needle, `ie-${imagekitTextEncode(normalizeTitle(newSubtitle))}`);
  }
  return imageUrl;
}

/** Brands that have a subtitle text layer. Mirrors cloudinary.ts. */
export const SUBTITLE_BRANDS = new Set(["era sarawak", "era sabah"]);

/**
 * Replaces a single bullet-point fact layer's encoded text. Replaces the first
 * match only (facts appear once).
 */
export function updateFactInImageUrl(
  imageUrl: string,
  _factIndex: number,
  oldText: string,
  newText: string,
): string {
  if (!oldText || !newText) return imageUrl;
  const normalizedOld = normalizeTitle(oldText);
  const caseTransforms: Array<(s: string) => string> = [(s) => s, (s) => s.toUpperCase()];
  for (const caseFn of caseTransforms) {
    const needle = `ie-${imagekitTextEncode(caseFn(normalizedOld))}`;
    if (imageUrl.includes(needle)) {
      return imageUrl.replace(needle, `ie-${imagekitTextEncode(caseFn(newText))}`);
    }
  }
  return imageUrl;
}

// ── Base image + crop ─────────────────────────────────────────────────────────

/**
 * Replaces the base image path in an ImageKit URL while preserving the `tr`
 * transform chain (the overlays/text). `newBasePath` is an ImageKit filePath
 * (with or without a leading slash), e.g. the result of uploadImage().
 */
export function replaceBaseImage(originalUrl: string, newBasePath: string): string {
  const split = splitTr(originalUrl);
  if (!split) return originalUrl;
  const clean = newBasePath.replace(/^\//, "");
  return joinTr(`${ENDPOINT}/${clean}`, split.tr, split.rest);
}

/**
 * Builds the delivery URL for a brand logo. Logos are migrated to the brand-first
 * layout `/brands/<slug>/logo/<logo_public_id>`, where the slug is the public_id
 * minus its trailing `_logo`/`-logo` (e.g. `astro_awani_logo` → `astro_awani`,
 * `pa_ma_logo` → `pa_ma`). Mirrors the `i-brands@@<slug>@@logo@@<id>` layer path
 * the cloned n8n workflows use.
 */
export function brandLogoUrl(logoId: string): string {
  const slug = logoId.replace(/[-_]logo$/i, "");
  return `${ENDPOINT}/brands/${slug}/logo/${logoId}`;
}

/**
 * Builds the delivery URL for a brand overlay/background template migrated to the
 * brand-first layout `/brands/<slug>/templates/<templateId>` (e.g. the election
 * bg templates `prn2026_johor_bg` under `astro_awani`). Mirrors the media-library
 * path the cloned n8n workflows use.
 */
export function brandTemplateUrl(slug: string, templateId: string): string {
  return `${ENDPOINT}/brands/${slug}/templates/${templateId}`;
}

/**
 * Prepends a subject-aware crop (`w-,h-,fo-auto` ≈ Cloudinary `c_fill,g_auto`)
 * to an ImageKit URL's transform chain. Passes through non-ImageKit inputs
 * (blob:, data:, external) and is idempotent for URLs already carrying such a crop.
 */
export function withSubjectAwareCrop(
  url: string | null | undefined,
  width: number,
  height: number,
): string {
  if (!url) return "";
  if (!url.startsWith(ENDPOINT)) return url;
  const split = splitTr(url);
  if (!split) return url;
  if (/(^|:)w-\d+,h-\d+,fo-(auto|face)/.test(split.tr)) return url;
  const w = Math.round(width);
  const h = Math.round(height);
  const crop = `w-${w},h-${h},fo-auto`;
  const tr = split.tr ? `${crop}:${split.tr}` : crop;
  return joinTr(split.base, tr, split.rest);
}

/**
 * Delivery URL for a freshly-uploaded image from its ImageKit filePath (the raw
 * asset, no transforms). Mirrors the Cloudinary counterpart's signature.
 */
export function uploadedImageUrl(filePath: string): string {
  return `${ENDPOINT}/${filePath.replace(/^\//, "")}`;
}

/**
 * Applies an explicit rectangular crop region (in source pixels) to an ImageKit URL.
 * Replaces the leading sizing step (`w-W,h-H,fo-…`) with an extract of the region
 * (`cm-extract` at x,y sized w×h ≈ Cloudinary `c_crop`) then a chained resize back
 * to the canvas W×H (≈ `c_fill`). Returns the URL unchanged when the first `tr`
 * step isn't a `w-`/`h-` sizing. Synchronous (no cache-buster).
 */
export function applyRegionCrop(
  url: string,
  region: { x: number; y: number; width: number; height: number },
): string {
  const split = splitTr(url);
  if (!split || !split.tr) return url;
  const steps = split.tr.split(":");
  const m = steps[0].match(/w-(\d+),h-(\d+)/);
  if (!m) return url;
  const [, W, H] = m;
  const x = Math.round(region.x);
  const y = Math.round(region.y);
  const w = Math.round(region.width);
  const h = Math.round(region.height);
  steps[0] = `w-${w},h-${h},cm-extract,x-${x},y-${y}`;
  steps.splice(1, 0, `w-${W},h-${H}`);
  return joinTr(split.base, steps.join(":"), split.rest);
}

/**
 * Recovers the origin URL from an ImageKit remote-image layer (`l-image,ie-<b64url>`).
 * Returns null when the URL carries no such fetched layer.
 */
export function extractBaseImageUrl(imagekitUrl: string): string | null {
  const m = imagekitUrl.match(/l-image,ie-([^,]+)(?:,|:|$)/);
  if (!m) return null;
  try {
    const b64 = decodeURIComponent(m[1]);
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

// ── Engagement preview composite (Prime Talk) ─────────────────────────────────

/**
 * Options for the engagement post-image composite. Shared shape with the
 * Cloudinary counterpart so `imageProvider` can dispatch either by the flag.
 */
export interface EngagementPreviewOptions {
  headline: string;
  subtitle: string;
  /** ImageKit filePath (from the photo picker) OR an external http(s) URL. */
  photoPublicId: string | null;
  /** Post type kicker (e.g. idea.type) — shown when showTypeOnImage is true. */
  type?: string;
  showTypeOnImage: boolean;
  /** Cloudinary-era logo public_id (e.g. `hotspot_logo`) — mapped to the IK path. */
  brandLogoId: string;
  logoSize: number;
  subtitleY: number;
  headlineFontSpec?: string;
  subtitleFontSpec?: string;
}

// Cloudinary `font_use` spec → ImageKit media-library font path (`ff-` value,
// `/` → `@@`). The Chinese Hotspot font is already in the library as
// hotspot_font.ttf (byte-identical to Cloudinary's 方正兰亭特黑简体.ttf).
const IK_FONT_PATHS: Record<string, string> = {
  "Fonts:方正兰亭特黑简体.ttf": "fonts@@hotspot_font.ttf",
};

// Parses a Cloudinary font spec ("Fonts:X.ttf_90_bold_normal_center") into an
// ImageKit `ff` path and font size. Unknown families fall back to a built-in
// ImageKit font (Montserrat); plain family names (e.g. "Montserrat") pass through.
function parseFontSpec(
  spec: string | undefined,
  fallbackSize: number,
): { ff: string; fs: number } {
  if (!spec) return { ff: "Montserrat", fs: fallbackSize };
  const parts = spec.split("_");
  const name = parts[0];
  const sizeTok = parts.find((p) => /^\d+$/.test(p));
  const fs = sizeTok ? parseInt(sizeTok, 10) : fallbackSize;
  const ff =
    IK_FONT_PATHS[name] ??
    (name.includes(":") || name.includes(".") ? "Montserrat" : name);
  return { ff, fs };
}

/** Base segment for the composite: an IK filePath, or an encoded remote URL
 *  (Web Proxy origin) when the photo is an external http(s) link. */
function previewBaseSegment(photoPublicId: string | null): string {
  if (!photoPublicId) return "default-image.jpg";
  if (/^https?:\/\//i.test(photoPublicId)) return encodeURIComponent(photoPublicId);
  return photoPublicId.replace(/^\//, "");
}

/**
 * Builds the ImageKit composite delivery URL for an engagement post image
 * (Prime Talk). Reproduces the legacy Cloudinary `buildPreviewUrl` layout as a
 * query-style transform chain: face-cropped 1080×1350 photo → bottom gradient →
 * optional gold type kicker → white headline → white subtitle → bottom-center
 * brand logo. Query-style (`?tr=`) is required: base64 text (`ie-`) can contain
 * `%2F`, which breaks path-style transforms.
 */
export function buildEngagementPreviewUrl(o: EngagementPreviewOptions): string {
  const slug = o.brandLogoId.replace(/[-_]logo$/i, "");
  const head = parseFontSpec(o.headlineFontSpec, 90);
  const subt = parseFontSpec(o.subtitleFontSpec, 38);
  const base = previewBaseSegment(o.photoPublicId);

  const steps: string[] = [
    "w-1080,h-1350,fo-face",
    // Bottom fade (transparent→black over the lower 60%), replaces Cloudinary's
    // `l_black_fade_pexvn5` — no uploaded asset needed.
    "l-image,i-ik_canvas,e-gradient-ld-bottom_from-00000000_to-000000,w-bw,h-bh_mul_0.6,lfo-bottom,l-end",
  ];
  if (o.showTypeOnImage && o.type) {
    steps.push(
      `l-text,ie-${imagekitTextEncode(o.type)},ff-${subt.ff},fs-${subt.fs},co-FFD700,w-800,ia-center,lxc-bw_mul_0.5,ly-845,l-end`,
    );
  }
  steps.push(
    `l-text,ie-${imagekitTextEncode(o.headline)},ff-${head.ff},fs-${head.fs},co-FFFFFF,w-1000,ia-center,lxc-bw_mul_0.5,ly-900,l-end`,
  );
  steps.push(
    `l-text,ie-${imagekitTextEncode(o.subtitle)},ff-${subt.ff},fs-${subt.fs},co-FFFFFF,w-950,ia-center,lxc-bw_mul_0.5,ly-${o.subtitleY},l-end`,
  );
  steps.push(
    `l-image,i-brands@@${slug}@@logo@@${o.brandLogoId},w-${o.logoSize},lfo-bottom,l-end`,
  );

  return `${ENDPOINT}/${base}?tr=${steps.join(":")}`;
}

// ── Upload (client-side signed upload via n8n sign webhook) ────────────────────

interface ImageKitSignature {
  signature: string;
  token: string;
  expire: number;
  publicKey: string;
}

interface ImageKitUploadResponse {
  fileId: string;
  name: string;
  filePath: string;
  url: string;
  [key: string]: unknown;
}

// Fetches a fresh upload auth (signature/token/expire) from the n8n signing webhook.
// The webhook holds IMAGEKIT_PRIVATE_KEY as an n8n Variable — never in the browser.
//
// In production the request is routed through /api/n8n-proxy (same as useWorkflow.ts):
// the proxy verifies the MSAL id_token server-side, restricts the target to the n8n host,
// and injects the imagekit-sign-token header the signing workflow checks. This keeps the
// signing endpoint from being callable by unauthenticated / non-@astro.com.my users.
async function getUploadAuth(): Promise<ImageKitSignature> {
  const signWebhookUrl = (
    import.meta.env.VITE_IMAGEKIT_SIGN_WEBHOOK_URL as string | undefined
  )?.trim();
  if (!signWebhookUrl) throw new Error("ImageKit sign webhook not configured");

  let fetchUrl = signWebhookUrl;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body = JSON.stringify({});

  if (import.meta.env.PROD) {
    const account =
      msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
    try {
      const tokenResult = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      headers["Authorization"] = `Bearer ${tokenResult.idToken}`;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await msalInstance.loginRedirect(loginRequest);
        throw new Error("Session expired. Redirecting to login…");
      }
      throw err;
    }
    fetchUrl = "/api/n8n-proxy";
    body = JSON.stringify({ n8nUrl: signWebhookUrl });
  }

  const res = await fetch(fetchUrl, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`Signature request failed: ${res.status}`);
  return (await res.json()) as ImageKitSignature;
}

/**
 * Signed client-side upload to ImageKit. Fetches auth from the n8n signing
 * webhook, then uploads the file/URL directly to ImageKit. The private key
 * never leaves n8n.
 */
export async function signedUpload(
  fileOrUrl: File | string | Blob,
  options?: { folder?: string; fileName?: string; useUniqueFileName?: boolean; tags?: string[] },
): Promise<ImageKitUploadResponse> {
  const { signature, token, expire, publicKey } = await getUploadAuth();

  const fd = new FormData();
  fd.append("file", fileOrUrl as Blob | string);
  fd.append(
    "fileName",
    options?.fileName ?? (fileOrUrl instanceof File ? fileOrUrl.name : "upload"),
  );
  fd.append("publicKey", publicKey);
  fd.append("signature", signature);
  fd.append("token", token);
  fd.append("expire", String(expire));
  fd.append("useUniqueFileName", String(options?.useUniqueFileName ?? true));
  if (options?.folder) fd.append("folder", options.folder);
  if (options?.tags?.length) fd.append("tags", options.tags.join(","));

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${errText}`);
  }
  return (await res.json()) as ImageKitUploadResponse;
}

/**
 * Uploads an image File to ImageKit. Returns the filePath (the ImageKit analog
 * of a Cloudinary public_id — used as the base image path in replaceBaseImage).
 */
export async function uploadImage(file: File): Promise<string> {
  const { filePath } = await signedUpload(file, { folder: "/article-uploads" });
  return filePath.replace(/^\//, "");
}

/**
 * Uploads an image from a URL to ImageKit (server-side fetch avoids browser CORS).
 * Returns the filePath.
 */
export async function uploadUrlImage(url: string): Promise<string> {
  const { filePath } = await signedUpload(url, { folder: "/article-uploads" });
  return filePath.replace(/^\//, "");
}
