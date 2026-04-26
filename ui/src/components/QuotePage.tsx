import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconArrowLeft,
  IconBlockquote,
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import { QuoteCanvas, type QuoteCanvasHandle, type QuoteData } from "./QuoteCanvas";
import { ScheduleModal } from "./ScheduleModal";
import { Spinner } from "./ds/Spinner";
import { getCredentials } from "../utils/fbCredentials";
import { toast } from "../hooks/useToast";
import { BRANDS, detectBrandInfoFromUrl } from "../constants/brands";
import { DEFAULT_QUOTE_CANVAS_CONFIG } from "../config/quoteCanvasConfig";
import type { CaptionTitleMode } from "../types";

interface QuoteResponse {
  success: true;
  quote_text: string;
  quote_author: string;
  quote_author_title?: string;
  original_quote: string;
  fb_caption: string;
  brand: string;
  image_url?: string;
}

interface QuoteErrorResponse {
  success: false;
  error: string;
  message: string;
}

type QuoteResult = QuoteResponse | QuoteErrorResponse;

type Stage = "input" | "generating" | "preview";

const LOADING_QUOTES = [
  "Reading the article...",
  "Searching for powerful quotes...",
  "Finding who said what...",
  "Translating to brand voice...",
  "Almost there — preparing your image...",
];

const LOADING_STEPS = [
  "Extracting article content",
  "Identifying key quotes",
  "Generating caption",
  "Preparing image",
];

export function QuotePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [brand, setBrand] = useState("");
  const [captionTitleMode, setCaptionTitleMode] = useState<CaptionTitleMode>("original");
  const [stage, setStage] = useState<Stage>("input");
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const config = DEFAULT_QUOTE_CANVAS_CONFIG;

  const canvasRef = useRef<QuoteCanvasHandle>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const closeLightbox = useCallback(() => setLightboxUrl(null), []);

  // Schedule state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<"idle" | "done" | "error">("idle");

  // Loading animation
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  // Lightbox escape key
  useEffect(() => {
    if (!lightboxUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxUrl, closeLightbox]);

  // Cleanup cutout object URL on unmount/reset
  useEffect(() => {
    return () => {
      if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    };
  }, [cutoutUrl]);

  // Auto-detect brand and caption mode from URL
  function handleUrlChange(newUrl: string) {
    setUrl(newUrl);
    const info = detectBrandInfoFromUrl(newUrl);
    if (info) {
      setBrand(info.brand);
      // Auto-select AI mode for English Stadium Astro (matching FB flow)
      setCaptionTitleMode(
        info.brand === "Stadium Astro" && info.language === "EN" ? "ai" : "original",
      );
    }
  }

  async function handleGenerate() {
    if (!url.trim() || !brand) return;

    const webhookUrl = import.meta.env.VITE_QUOTE_WEBHOOK_URL as string | undefined;
    if (!webhookUrl) {
      toast.error("Quote webhook URL not configured.");
      return;
    }

    setStage("generating");
    setError(null);
    setQuoteData(null);
    setCaption("");
    setImageUrl(null);
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    setCutoutUrl(null);
    setIsProcessingImage(false);
    setQuoteIndex(0);
    setStepIndex(0);
    setScheduleStatus("idle");
    setIsLoading(true);

    const quoteInterval = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % LOADING_QUOTES.length);
    }, 3000);
    const stepInterval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 8000);

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 2 * 60 * 1000);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          brand,
          caption_title_mode: captionTitleMode,
          language: detectBrandInfoFromUrl(url.trim())?.language || "BM",
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setError(`Service error (${res.status}). Please try again.`);
        setStage("generating");
        return;
      }

      const text = await res.text();
      if (!text) {
        setError("Service returned an empty response. Please try again.");
        return;
      }

      let data: QuoteResult;
      try {
        data = JSON.parse(text) as QuoteResult;
      } catch {
        setError("Service returned an invalid response. Please try again.");
        return;
      }

      if (controller.signal.aborted) return;

      if (data.success) {
        setQuoteData({
          quote_text: data.quote_text,
          quote_author: data.quote_author,
          quote_author_title: data.quote_author_title,
        });
        setCaption(data.fb_caption);
        setImageUrl(data.image_url || null);
        setStage("preview");

        // Background removal (non-blocking, only if enabled and image available)
        if (data.image_url && config.cutoutImage.enabled) {
          setIsProcessingImage(true);
          try {
            const imgRes = await fetch(data.image_url, { mode: "cors" });
            const blob = await imgRes.blob();
            const { removeBackground } = await import(
              "@imgly/background-removal"
            );
            const resultBlob = await removeBackground(blob, {
              model: "medium",
              output: { format: "image/png", quality: 0.9 },
            });
            setCutoutUrl(URL.createObjectURL(resultBlob));
          } catch {
            // Silently fail — canvas works without cutout
          } finally {
            setIsProcessingImage(false);
          }
        }
      } else {
        setError(data.message || "Failed to extract quote from article.");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError(
          e instanceof Error ? e.message : "Something went wrong. Please try again.",
        );
      }
    } finally {
      clearInterval(quoteInterval);
      clearInterval(stepInterval);
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }

  function handleCopyCaption() {
    navigator.clipboard.writeText(caption);
    toast.success("Caption copied!");
  }

  async function handleSchedule(scheduledFor: string, passcode?: string) {
    const webhookUrl = (
      import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined
    )?.trim();
    if (!webhookUrl) {
      toast.error("Webhook not configured.");
      return;
    }

    const imageUrl = canvasRef.current?.getDataUrl();
    if (!imageUrl) {
      toast.error("Image not ready.");
      return;
    }

    const creds = passcode
      ? { passcode }
      : getCredentials(brand.toLowerCase());
    if (!creds) {
      toast.error("Passcode required.");
      return;
    }

    setIsScheduling(true);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fb_ai_image_url: imageUrl,
          fb_ai_caption: caption,
          brand: brand.toLowerCase(),
          scheduled_for: scheduledFor,
          passcode: creds.passcode,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        status?: string;
        message?: string;
      };

      if (data.status === "AUTH_ERROR") {
        toast.error(data.message ?? "Invalid passcode.");
        setScheduleStatus("error");
      } else if (
        data.success === true ||
        data.status === "SUCCESS" ||
        data.status === "DRAFT_SAVED"
      ) {
        toast.success("Quote post scheduled!");
        setScheduleStatus("done");
      } else {
        toast.error(data.message ?? "Something went wrong.");
        setScheduleStatus("error");
      }
    } catch {
      toast.error("Network error. Please try again.");
      setScheduleStatus("error");
    } finally {
      setIsScheduling(false);
      setShowScheduleModal(false);
    }
  }

  function handleBack() {
    if (stage === "input") {
      navigate("/engagement-posts");
    } else {
      setStage("input");
      setQuoteData(null);
      setCaption("");
      setError(null);
      setImageUrl(null);
      if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
      setCutoutUrl(null);
    }
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-950 transition mb-4"
          >
            <IconArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <IconBlockquote
              className="w-8 h-8"
              style={{ color: "#0055EE" }}
            />
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                Quote
              </h1>
              <p className="text-neutral-500 text-sm">
                Extract a key quote from any article and generate a branded image
              </p>
            </div>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{
              background:
                "linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)",
            }}
          />
        </div>

        {/* Input Stage */}
        {stage === "input" && (
          <div className="max-w-md">
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Article URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://astroawani.com/..."
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Select brand
                </label>
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
                >
                  <option value="">Choose a brand...</option>
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Caption Style
                </label>
                <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
                  {(["original", "ai"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCaptionTitleMode(mode)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                        captionTitleMode === mode
                          ? "bg-white text-neutral-900 shadow-sm"
                          : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      {mode === "original" ? "Original" : "AI ✨"}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  {captionTitleMode === "original"
                    ? "Uses the article headline as-is"
                    : "AI rewrites using brand voice"}
                </p>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!url.trim() || !brand}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-neutral-950 hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Generate Quote Image
              </button>
            </div>
          </div>
        )}

        {/* Generating Stage */}
        {stage === "generating" && (
          <>
            {isLoading && (
              <div className="glass-card rounded-2xl p-12 flex flex-col items-center gap-6 text-center">
                <Spinner size="lg" />
                <div className="space-y-3">
                  <div className="flex flex-col items-start gap-2 text-left">
                    {LOADING_STEPS.map((step, i) => (
                      <div
                        key={step}
                        className="flex items-center gap-2 text-sm"
                      >
                        {i < stepIndex ? (
                          <svg
                            className="w-4 h-4 text-green-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : i === stepIndex ? (
                          <div className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-neutral-200" />
                        )}
                        <span
                          className={
                            i <= stepIndex
                              ? "text-neutral-800 font-medium"
                              : "text-neutral-400"
                          }
                        >
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p
                    key={quoteIndex}
                    className="text-xs text-neutral-400 italic animate-fade-slide-up"
                  >
                    {LOADING_QUOTES[quoteIndex]}
                  </p>
                </div>
              </div>
            )}

            {!isLoading && error && (
              <div className="glass-card rounded-2xl p-8 text-center space-y-4">
                <p className="text-sm text-red-600 font-medium">{error}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setStage("input");
                      setError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
                  >
                    Change article
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Preview Stage */}
        {stage === "preview" && quoteData && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-neutral-500">
                Quote by{" "}
                <span className="font-semibold text-neutral-800">
                  {quoteData.quote_author}
                </span>{" "}
                for{" "}
                <span className="font-semibold text-neutral-800">{brand}</span>
              </p>
              <button
                onClick={() => {
                  setStage("input");
                  setQuoteData(null);
                  setCaption("");
                  setImageUrl(null);
                  if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
                  setCutoutUrl(null);
                }}
                className="text-xs text-neutral-500 hover:text-neutral-800 transition"
              >
                Start over
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
              {/* Canvas */}
              <div className="flex flex-col items-center gap-3">
                <QuoteCanvas
                  ref={canvasRef}
                  quote={quoteData}
                  brand={brand}
                  imageUrl={imageUrl}
                  cutoutImageUrl={cutoutUrl}
                  isProcessingCutout={isProcessingImage}
                  onClick={() => {
                    const dataUrl = canvasRef.current?.getDataUrl();
                    if (dataUrl) setLightboxUrl(dataUrl);
                  }}
                />
                {isProcessingImage && (
                  <p className="text-xs text-neutral-400 animate-pulse">
                    Extracting subject from image...
                  </p>
                )}
                <button
                  onClick={() => canvasRef.current?.downloadAsPng()}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition active:scale-[0.98]"
                >
                  <IconDownload className="w-3.5 h-3.5" />
                  Download Image
                </button>
              </div>

              {/* Caption + schedule */}
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Caption for post
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCopyCaption}
                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 transition active:scale-[0.98]"
                  >
                    Copy caption
                  </button>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    disabled={isScheduling || scheduleStatus === "done"}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {isScheduling
                      ? "Scheduling..."
                      : scheduleStatus === "done"
                        ? "Scheduled!"
                        : "Schedule on FB"}
                  </button>
                </div>
              </div>
            </div>

            {showScheduleModal && (
              <ScheduleModal
                brand={brand}
                hasCredentials={!!getCredentials(brand.toLowerCase())}
                isPosting={isScheduling}
                onConfirm={handleSchedule}
                onClose={() => setShowScheduleModal(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
          >
            <IconX className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Quote preview"
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}
