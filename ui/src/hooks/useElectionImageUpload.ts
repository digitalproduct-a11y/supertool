import { useCallback } from "react";

// Uploads a rendered canvas (PNG data URL) to Cloudinary via an unsigned upload
// preset and returns the public secure_url, used by the Election Results tool as
// the image source for Facebook posting.
//
// Mirrors the unsigned-upload pattern in DidYouKnowCard: the data URL is sent
// straight from the browser to Cloudinary, so there is no serverless function,
// no signing webhook, and no Vercel body-size limit. The whole app is behind
// MSAL login, so uploads stay gated at the app level. The `election` folder and
// public_id come from the preset's configuration.

const PRESET = (import.meta.env.VITE_CLOUDINARY_ELECTION_UPLOAD_PRESET as
  | string
  | undefined)?.trim();
const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as
  | string
  | undefined)?.trim();

export function useElectionImageUpload() {
  const upload = useCallback(async (dataUrl: string): Promise<string> => {
    if (!PRESET || !CLOUD_NAME) {
      throw new Error("Cloudinary upload not configured");
    }

    const blob = await (await fetch(dataUrl)).blob();

    const formData = new FormData();
    formData.append("file", blob);
    formData.append("upload_preset", PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData },
    );
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`Upload failed (${res.status}) ${msg}`);
    }

    const { secure_url } = (await res.json()) as { secure_url?: string };
    if (!secure_url) throw new Error("Upload returned no URL");
    return secure_url;
  }, []);

  return { upload };
}
