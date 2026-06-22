import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "../auth/msalConfig";

// Uploads a rendered canvas (PNG data URL) to Vercel Blob via /api/upload-to-blob
// and returns the public URL. Mirrors the MSAL-token handling in useWorkflow:
// in production the route is auth-gated, so we attach the id_token; in dev the
// Vite middleware accepts the request without auth.

export function useBlobUpload() {
  const { instance } = useMsal();

  const upload = useCallback(
    async (dataUrl: string, filename: string): Promise<string> => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (import.meta.env.PROD) {
        const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
        try {
          const tokenResult = await instance.acquireTokenSilent({ ...loginRequest, account });
          headers["Authorization"] = `Bearer ${tokenResult.idToken}`;
        } catch (err) {
          if (err instanceof InteractionRequiredAuthError) {
            await instance.loginRedirect(loginRequest);
            throw new Error("Session expired. Redirecting to login…");
          }
          throw err;
        }
      }

      const res = await fetch("/api/upload-to-blob", {
        method: "POST",
        headers,
        body: JSON.stringify({ dataUrl, filename }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error((msg as { error?: string }).error || `Upload failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      if (!url) throw new Error("Upload returned no URL");
      return url;
    },
    [instance],
  );

  return { upload };
}
