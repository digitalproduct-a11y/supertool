import { useState, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import type { WorkflowResponse, WorkflowRequest } from "../types";
import { trackToolSubmit, extractDomain } from "../utils/analytics";
import { loginRequest } from "../auth/msalConfig";

interface UseWorkflowReturn {
  run: (request: WorkflowRequest) => Promise<WorkflowResponse>;
  isRunning: boolean;
}

export function useWorkflow(webhookUrlOverride?: string): UseWorkflowReturn {
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const { instance } = useMsal();

  async function run(request: WorkflowRequest): Promise<WorkflowResponse> {
    if (isRunningRef.current) {
      return {
        success: false,
        error: "execution_error",
        message: "Already running.",
      };
    }

    const webhookUrl =
      webhookUrlOverride || import.meta.env.VITE_GENERATE_WEBHOOK_URL;
    if (!webhookUrl) {
      return {
        success: false,
        error: "execution_error",
        message: "Webhook URL is not configured.",
      };
    }

    isRunningRef.current = true;
    setIsRunning(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      let fetchUrl = webhookUrl;
      const fetchHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      let fetchBody = JSON.stringify(request);

      // In production: route all webhook calls through the server-side proxy.
      // The proxy validates the MSAL token before forwarding to n8n, preventing
      // unauthenticated direct calls to n8n webhook URLs.
      if (import.meta.env.PROD) {
        const account =
          instance.getActiveAccount() ?? instance.getAllAccounts()[0];
        try {
          const tokenResult = await instance.acquireTokenSilent({
            ...loginRequest,
            account,
          });
          fetchHeaders["Authorization"] = `Bearer ${tokenResult.idToken}`;
        } catch (err) {
          if (err instanceof InteractionRequiredAuthError) {
            await instance.loginRedirect(loginRequest);
            return {
              success: false,
              error: "execution_error",
              message: "Session expired. Redirecting to login…",
            };
          }
          throw err;
        }
        fetchUrl = "/api/n8n-proxy";
        fetchBody = JSON.stringify({ n8nUrl: webhookUrl, ...request });
      }

      const response = await fetch(fetchUrl, {
        method: "POST",
        headers: fetchHeaders,
        body: fetchBody,
        signal: controller.signal,
      });

      const data = (await response.json()) as Record<string, unknown>;
      // Normalize subTitle → subtitle (n8n returns camelCase subTitle)
      if (data.subTitle !== undefined && data.subtitle === undefined) {
        data.subtitle = data.subTitle;
      }

      const [, brandSlug, ...toolParts] = window.location.pathname.split("/");
      const sourceDomain = request.url ? extractDomain(request.url) : undefined;
      trackToolSubmit(
        toolParts.join("/") || "unknown",
        brandSlug ?? "unknown",
        sourceDomain
      );

      return data as unknown as WorkflowResponse;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return {
          success: false,
          error: "execution_error",
          message:
            "The request timed out. The workflow may still be running — please try again.",
        };
      }
      return {
        success: false,
        error: "execution_error",
        message: "Network error. Please check your connection and try again.",
      };
    } finally {
      clearTimeout(timeout);
      isRunningRef.current = false;
      setIsRunning(false);
    }
  }

  return { run, isRunning };
}
