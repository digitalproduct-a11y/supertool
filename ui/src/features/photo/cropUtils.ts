import { applyRegionCrop } from "../../utils/imageProvider";

/**
 * Rebuild an image URL with an explicit crop region (source pixels), extracting
 * the selected rectangle and filling the canvas. Provider-aware: Cloudinary URLs
 * use `c_crop`, ImageKit URLs use `cm-extract` (see utils/imageProvider). A
 * cache-buster is appended so the browser re-fetches after a crop change.
 */
export async function applyFocalCrop(
  finalImageUrl: string,
  cropRegion: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const cropped = applyRegionCrop(finalImageUrl, cropRegion);
  const separator = cropped.includes("?") ? "&" : "?";
  return `${cropped}${separator}cb=${Date.now()}`;
}
