/**
 * Image-provider selector for the Cloudinary → ImageKit migration.
 *
 * Re-exports the same surface as utils/cloudinary.ts, so a consumer migrates by
 * swapping its import path from `../utils/cloudinary` to `../utils/imageProvider`
 * — call sites stay unchanged.
 *
 * Two dispatch strategies:
 * - URL editors (updateTitle/Subtitle/Fact, replaceBaseImage, withSubjectAwareCrop,
 *   extractBaseImageUrl) AUTO-DETECT the provider from the URL argument. This is
 *   required for correctness: applying the wrong provider's editor to a URL is a
 *   silent no-op (the title wouldn't update). Auto-detection also makes these safe
 *   for components shared across migrated and not-yet-migrated pages.
 * - Uploads and the raw text encoder follow `VITE_IMAGE_PROVIDER` (default
 *   "cloudinary"), since they have no URL to key off — this is the cutover flag.
 */
import * as cld from "./cloudinary";
import * as ik from "./imagekit";

const raw = (import.meta.env.VITE_IMAGE_PROVIDER as string | undefined)
  ?.trim()
  .toLowerCase();
export const IMAGE_PROVIDER: "cloudinary" | "imagekit" =
  raw === "imagekit" ? "imagekit" : "cloudinary";
const useIK = IMAGE_PROVIDER === "imagekit";

/** True for ImageKit delivery URLs. */
function isImageKitUrl(url: string): boolean {
  return typeof url === "string" && url.includes("ik.imagekit.io");
}

// ── URL editors: auto-detect provider from the URL ─────────────────────────────

export function updateTitleInImageUrl(
  imageUrl: string,
  originalTitle: string,
  newTitle: string,
): string {
  return (isImageKitUrl(imageUrl) ? ik : cld).updateTitleInImageUrl(
    imageUrl,
    originalTitle,
    newTitle,
  );
}

export function updateSubtitleInImageUrl(
  imageUrl: string,
  originalSubtitle: string,
  newSubtitle: string,
): string {
  return (isImageKitUrl(imageUrl) ? ik : cld).updateSubtitleInImageUrl(
    imageUrl,
    originalSubtitle,
    newSubtitle,
  );
}

export function updateFactInImageUrl(
  imageUrl: string,
  factIndex: number,
  oldText: string,
  newText: string,
): string {
  return (isImageKitUrl(imageUrl) ? ik : cld).updateFactInImageUrl(
    imageUrl,
    factIndex,
    oldText,
    newText,
  );
}

export function replaceBaseImage(originalUrl: string, newBaseId: string): string {
  return (isImageKitUrl(originalUrl) ? ik : cld).replaceBaseImage(originalUrl, newBaseId);
}

export function withSubjectAwareCrop(
  url: string | null | undefined,
  width: number,
  height: number,
): string {
  if (!url) return "";
  return (isImageKitUrl(url) ? ik : cld).withSubjectAwareCrop(url, width, height);
}

export function extractBaseImageUrl(url: string): string | null {
  return (isImageKitUrl(url) ? ik : cld).extractBaseImageUrl(url);
}

export function applyRegionCrop(
  url: string,
  region: { x: number; y: number; width: number; height: number },
): string {
  return (isImageKitUrl(url) ? ik : cld).applyRegionCrop(url, region);
}

/**
 * Fill-crop a photo URL to exactly width×height for a Fabric canvas base image,
 * provider-aware and auto-detected from the URL:
 *   - ImageKit  → `?tr=w-,h-,fo-face|fo-auto`
 *   - Cloudinary → `/c_fill,g_face|g_auto,w_,h_/` (idempotent)
 *   - external / blob / data → returned unchanged (canvas cover-fills it)
 * `focus: "face"` ≈ the old Cloudinary g_face (players/celebrities); "auto" = smart crop.
 * Shared by EngagementPostCanvas + GempakEntertainmentCanvas.
 */
export function fitPhotoUrl(
  url: string,
  width: number,
  height: number,
  focus: "face" | "auto" = "auto",
): string {
  if (!url) return url;
  const face = focus === "face";
  if (url.includes("ik.imagekit.io")) {
    const step = `w-${width},h-${height},fo-${face ? "face" : "auto"}`;
    const [base, query] = url.split("?");
    if (query?.startsWith("tr=")) return `${base}?tr=${step}:${query.slice(3)}`;
    return `${base}?tr=${step}${query ? `&${query}` : ""}`;
  }
  const marker = url.includes("/image/upload/")
    ? "/image/upload/"
    : url.includes("/image/fetch/")
      ? "/image/fetch/"
      : null;
  if (marker) {
    if (/\/(c_fill|g_face|g_auto)[,/]/.test(url)) return url;
    const g = face ? "g_face" : "g_auto";
    return url.replace(marker, `${marker}c_fill,${g},w_${width},h_${height}/`);
  }
  return url;
}

/** Same brand set regardless of provider. */
export const SUBTITLE_BRANDS = cld.SUBTITLE_BRANDS;

// ── Uploads + text encoder: follow the VITE_IMAGE_PROVIDER cutover flag ─────────

/** Raw text encoder (no URL to key off). */
export const cloudinaryTextEncode = useIK ? ik.imagekitTextEncode : cld.cloudinaryTextEncode;

/** Brand-logo delivery URL for the active provider (fresh build, follows the flag). */
export const brandLogoUrl = useIK ? ik.brandLogoUrl : cld.brandLogoUrl;

/** Brand template/background delivery URL for the active provider (follows the flag). */
export const brandTemplateUrl = useIK ? ik.brandTemplateUrl : cld.brandTemplateUrl;

/** Uploads a File, returns a base-image id (Cloudinary public_id / ImageKit filePath). */
export const uploadToCloudinary = useIK ? ik.uploadImage : cld.uploadToCloudinary;

/** Delivery URL for a freshly-uploaded image id (raw asset, follows the flag). */
export const uploadedImageUrl = useIK ? ik.uploadedImageUrl : cld.uploadedImageUrl;

/** Uploads from a URL, returns a base-image id. */
export const uploadUrlToCloudinary = useIK ? ik.uploadUrlImage : cld.uploadUrlToCloudinary;

/**
 * Signed upload with a Cloudinary-shaped response ({ public_id, secure_url }).
 * The ImageKit path adapts its response so call sites that read those fields
 * keep working.
 */
export const signedUpload = useIK
  ? async (
      fileOrUrl: File | string | Blob,
      _uploadPreset?: string,
      extraParams?: Record<string, string>,
    ) => {
      const r = await ik.signedUpload(fileOrUrl, {
        folder: extraParams?.folder ?? "/uploads",
        tags: extraParams?.tags
          ? extraParams.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
      });
      return { ...r, public_id: r.filePath.replace(/^\//, ""), secure_url: r.url };
    }
  : cld.signedUploadToCloudinary;

/** @deprecated Cloudinary-era name kept for not-yet-migrated consumers; use `signedUpload`. */
export const signedUploadToCloudinary = signedUpload;
