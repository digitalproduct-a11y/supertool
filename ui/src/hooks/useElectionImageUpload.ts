import { useCallback } from "react";
import { signedUpload } from "../utils/imageProvider";

// Uploads a rendered canvas (PNG data URL) via the signed upload flow (n8n webhook
// holds the API secret) and returns the public URL, used by the Election Results
// tool as the image source for Facebook posting. Provider follows VITE_IMAGE_PROVIDER:
// ImageKit → /election-uploads folder; Cloudinary (legacy) → the election preset.

const PRESET = (import.meta.env.VITE_CLOUDINARY_ELECTION_UPLOAD_PRESET as
  | string
  | undefined)?.trim();

export function useElectionImageUpload() {
  const upload = useCallback(async (dataUrl: string): Promise<string> => {
    if (!PRESET) {
      throw new Error("Cloudinary upload not configured");
    }

    const blob = await (await fetch(dataUrl)).blob();
    const { secure_url } = await signedUpload(blob, PRESET, {
      folder: "/election-uploads",
    });
    if (!secure_url) throw new Error("Upload returned no URL");
    return secure_url;
  }, []);

  return { upload };
}
