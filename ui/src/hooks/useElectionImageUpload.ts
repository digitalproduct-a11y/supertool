import { useCallback } from "react";
import { signedUploadToCloudinary } from "../utils/cloudinary";

// Uploads a rendered canvas (PNG data URL) to Cloudinary via the signed upload
// flow (n8n webhook holds the API secret) and returns the public secure_url,
// used by the Election Results tool as the image source for Facebook posting.
// The `election` folder and public_id come from the preset's configuration.

const PRESET = (import.meta.env.VITE_CLOUDINARY_ELECTION_UPLOAD_PRESET as
  | string
  | undefined)?.trim();

export function useElectionImageUpload() {
  const upload = useCallback(async (dataUrl: string): Promise<string> => {
    if (!PRESET) {
      throw new Error("Cloudinary upload not configured");
    }

    const blob = await (await fetch(dataUrl)).blob();
    const { secure_url } = await signedUploadToCloudinary(blob, PRESET);
    if (!secure_url) throw new Error("Upload returned no URL");
    return secure_url;
  }, []);

  return { upload };
}
