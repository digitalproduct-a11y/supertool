import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconArrowLeft,
  IconBlockquote,
  IconDownload,
  IconRefresh,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { QuoteCanvas, type QuoteCanvasHandle, type QuoteData } from "./QuoteCanvas";
import { ScheduleModal } from "./ScheduleModal";
import { Spinner } from "./ds/Spinner";
import { getCredentials } from "../utils/fbCredentials";
import { toast } from "../hooks/useToast";
import {
  BRANDS,
  DOMAIN_TO_BRAND,
  detectBrandFromUrl,
  detectBrandInfoFromUrl,
} from "../constants/brands";
import {
  DEFAULT_QUOTE_CANVAS_CONFIG,
  TABLOID_QUOTE_CANVAS_CONFIG,
} from "../config/quoteCanvasConfig";
import type { CaptionTitleMode } from "../types";

interface QuoteResponse {
  success: true;
  quote_text: string;
  quote_punch: string;
  quote_author: string;
  quote_author_title?: string;
  original_quote: string;
  fb_caption: string;
  brand: string;
  image_url?: string;
  pexels_image_left_url?: string;
  pexels_image_right_url?: string;
  // Up to 6 Pexels matches — frontend cycles through these via the
  // Refresh button. Array is preferred; left/right kept for back-compat.
  pexels_image_urls?: string[];
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
  const [captionTitleMode, setCaptionTitleMode] = useState<CaptionTitleMode>("ai");
  // "Default Template" toggle. ON = tabloid template (full-bleed photo). OFF = subject cutout feature (bg-removed + side-text layout).
  const [useDefaultTemplate, setUseDefaultTemplate] = useState(true);
  const [stage, setStage] = useState<Stage>("input");
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // All Pexels matches returned by n8n (up to 6). The Refresh button cycles
  // pexelsIndex through them — no extra round-trips.
  const [pexelsUrls, setPexelsUrls] = useState<string[]>([]);
  const [pexelsIndex, setPexelsIndex] = useState(0);
  // User-uploaded image that overrides the Pexels match for the side circle.
  // Stored as an object URL so the canvas can render it without any upload step.
  const [customCircleUrl, setCustomCircleUrl] = useState<string | null>(null);
  const customCircleInputRef = useRef<HTMLInputElement>(null);
  // User-uploaded background image (overrides the article photo).
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const customBgInputRef = useRef<HTMLInputElement>(null);
  // User toggle for the tabloid layout's decorative side circle. Off by default.
  const [useSideCircle, setUseSideCircle] = useState(false);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const config = useDefaultTemplate
    ? TABLOID_QUOTE_CANVAS_CONFIG
    : DEFAULT_QUOTE_CANVAS_CONFIG;

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

  // Supported sites modal
  const [showSupportedSites, setShowSupportedSites] = useState(false);
  const detectedBrand = url ? detectBrandFromUrl(url) : null;

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

  // Cleanup custom side-circle object URL on unmount/replace
  useEffect(() => {
    return () => {
      if (customCircleUrl) URL.revokeObjectURL(customCircleUrl);
    };
  }, [customCircleUrl]);

  // Cleanup custom background object URL on unmount/replace
  useEffect(() => {
    return () => {
      if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    };
  }, [customBgUrl]);

  function handleCustomCircleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customCircleUrl) URL.revokeObjectURL(customCircleUrl);
    setCustomCircleUrl(URL.createObjectURL(file));
    e.target.value = "";
  }

  function handleResetCustomCircle() {
    if (customCircleUrl) URL.revokeObjectURL(customCircleUrl);
    setCustomCircleUrl(null);
  }

  function handleCustomBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    setCustomBgUrl(URL.createObjectURL(file));
    e.target.value = "";
  }

  function handleResetCustomBg() {
    if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    setCustomBgUrl(null);
  }

  function handleRefreshPexels() {
    if (pexelsUrls.length < 2) return;
    setPexelsIndex((i) => (i + 1) % pexelsUrls.length);
  }

  // Auto-detect brand from URL. Caption title mode is left as-is — AI is the default.
  function handleUrlChange(newUrl: string) {
    setUrl(newUrl);
    const detected = detectBrandFromUrl(newUrl);
    if (detected) setBrand(detected);
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
    setPexelsUrls([]);
    setPexelsIndex(0);
    if (customCircleUrl) URL.revokeObjectURL(customCircleUrl);
    setCustomCircleUrl(null);
    if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    setCustomBgUrl(null);
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
          quote_punch: data.quote_punch,
          quote_author: data.quote_author,
          quote_author_title: data.quote_author_title,
        });
        setCaption(data.fb_caption);
        setImageUrl(data.image_url || null);
        // Pexels matches: prefer the array; fall back to the legacy left URL.
        const urls =
          (data.pexels_image_urls?.filter(Boolean) ?? []) as string[];
        const fallback = data.pexels_image_left_url
          ? [data.pexels_image_left_url]
          : [];
        setPexelsUrls(urls.length ? urls : fallback);
        setPexelsIndex(0);
        setStage("preview");

        // Background removal (only when "Default Template" is OFF — i.e. user picked the cutout feature)
        if (data.image_url && !useDefaultTemplate && config.cutoutImage.enabled) {
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
      setPexelsUrls([]);
      setPexelsIndex(0);
      if (customCircleUrl) URL.revokeObjectURL(customCircleUrl);
      setCustomCircleUrl(null);
      if (customBgUrl) URL.revokeObjectURL(customBgUrl);
      setCustomBgUrl(null);
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
          {/* Left column — form, always visible */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!url.trim() || !brand || !detectedBrand) return;
                  handleGenerate();
                }}
                className="space-y-6"
              >
                {/* URL input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Article URL
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSupportedSites(true)}
                      className="text-neutral-500 hover:text-neutral-800 underline text-xs font-medium transition"
                      title="Check supported domains"
                    >
                      Check supported domains
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      placeholder="https://www.astroawani.com/..."
                      required
                      className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                    />
                    {url && (
                      <button
                        type="button"
                        onClick={() => handleUrlChange("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {url && detectedBrand && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-700 animate-slide-down">
                      <svg
                        className="w-3.5 h-3.5 text-green-500"
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
                      <span className="font-medium">
                        {detectedBrand} detected
                      </span>
                    </div>
                  )}
                  {url && !detectedBrand && (
                    <div className="mt-2 text-xs text-red-500 animate-slide-down">
                      Domain not supported — check the list of supported
                      websites
                    </div>
                  )}
                </div>

                {/* Brand selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand To Generate For
                  </label>
                  <div className="relative">
                    <select
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      required
                      className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white transition appearance-none cursor-pointer"
                    >
                      <option value="">Select a brand...</option>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Caption Title */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Caption Title
                  </label>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                    {(["original", "ai"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setCaptionTitleMode(mode)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                          captionTitleMode === mode
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {mode === "original" ? "Original" : "AI ✨"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {captionTitleMode === "original" &&
                      "Uses the article's headline in the caption"}
                    {captionTitleMode === "ai" &&
                      "AI rewrites the headline in the caption"}
                  </p>
                </div>

                {/* Default Template */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Default Template
                  </label>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                    {(
                      [
                        { value: true, label: "On" },
                        { value: false, label: "Off" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setUseDefaultTemplate(opt.value)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                          useDefaultTemplate === opt.value
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {useDefaultTemplate
                      ? "Uses the default branded template with the article photo as-is"
                      : "Removes the photo background and shows only the subject"}
                  </p>
                </div>

                {/* Side Circle — only relevant for the Default Template (tabloid) layout */}
                {useDefaultTemplate && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Side Circle
                    </label>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                      {(
                        [
                          { value: true, label: "On" },
                          { value: false, label: "Off" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setUseSideCircle(opt.value)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                            useSideCircle === opt.value
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {useSideCircle
                        ? "Adds a Pexels stock photo in a circular frame matched to the article topic"
                        : "Hides the decorative circle"}
                    </p>
                  </div>
                )}

                {/* Generate button */}
                <button
                  type="submit"
                  disabled={!url.trim() || !brand || !detectedBrand}
                  className="w-full py-3 px-6 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-medium rounded-xl transition text-sm active:scale-[0.98]"
                >
                  Generate Quote Image
                </button>

                {/* Supported sites modal */}
                {showSupportedSites && (
                  <div
                    className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
                    onClick={() => setShowSupportedSites(false)}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-lg p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Supported websites
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowSupportedSites(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(DOMAIN_TO_BRAND).map(
                          ([domain, info]) => (
                            <div
                              key={domain}
                              className="text-sm text-gray-700"
                            >
                              <span className="font-medium">{info.brand}</span>{" "}
                              <a
                                href={`https://${domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-xs"
                              >
                                {domain}
                              </a>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </form>
          </div>

          {/* Right column — idle / generating / preview / error */}
          <div id="quote-preview-panel">
            {stage === "input" && (
              <div className="glass-card rounded-2xl p-12 min-h-[420px] flex flex-col items-center justify-center text-center">
                <IconBlockquote className="w-12 h-12 text-neutral-200 mb-3" />
                <p className="text-sm font-medium text-neutral-500">
                  Generated quote will appear here
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Paste an article URL on the left and hit Generate.
                </p>
              </div>
            )}

            {/* Generating Stage */}
            {stage === "generating" && (
          <>
            {isLoading && (
              <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-10 text-center space-y-6">
                <div className="text-4xl inline-block animate-bounce">💬</div>
                <div className="flex justify-center gap-2">
                  {LOADING_STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2 rounded-full transition-all duration-700 ${
                        idx < stepIndex
                          ? "bg-green-500 w-4"
                          : idx === stepIndex
                            ? "w-4 animate-pulse"
                            : "bg-neutral-200 w-2"
                      }`}
                      style={
                        idx === stepIndex
                          ? {
                              background:
                                "linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)",
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {LOADING_STEPS[stepIndex]}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Step {stepIndex + 1} of {LOADING_STEPS.length}
                  </p>
                </div>
                <p
                  key={quoteIndex}
                  className="text-sm text-neutral-500 italic animate-fade"
                >
                  {LOADING_QUOTES[quoteIndex]}
                </p>
                <p className="text-xs text-neutral-400">
                  Taking ~30 seconds to process
                </p>
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
                  setPexelsUrls([]);
                  setPexelsIndex(0);
                  if (customCircleUrl) URL.revokeObjectURL(customCircleUrl);
                  setCustomCircleUrl(null);
                  if (customBgUrl) URL.revokeObjectURL(customBgUrl);
                  setCustomBgUrl(null);
                  if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
                  setCutoutUrl(null);
                }}
                className="text-xs text-neutral-500 hover:text-neutral-800 transition"
              >
                Start over
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {/* Canvas */}
              <div className="flex flex-col items-center gap-3">
                {isProcessingImage ? (
                  <div className="w-full" style={{ maxWidth: 720 }}>
                    <div
                      className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 flex flex-col items-center justify-center gap-3"
                      style={{
                        aspectRatio: `${config.canvas.width} / ${config.canvas.height}`,
                      }}
                    >
                      <Spinner size="lg" />
                      <p className="text-xs text-neutral-400 animate-pulse">
                        Extracting subject from image...
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <QuoteCanvas
                      ref={canvasRef}
                      quote={quoteData}
                      brand={brand}
                      config={config}
                      imageUrl={customBgUrl ?? imageUrl}
                      cutoutImageUrl={cutoutUrl}
                      isProcessingCutout={isProcessingImage}
                      pexelsImageUrl={
                        useDefaultTemplate && useSideCircle
                          ? (customCircleUrl ?? pexelsUrls[pexelsIndex] ?? null)
                          : null
                      }
                      onClick={() => {
                        const dataUrl = canvasRef.current?.getDataUrl();
                        if (dataUrl) setLightboxUrl(dataUrl);
                      }}
                    />
                    {/* Hidden file inputs (background + side circle) */}
                    <input
                      ref={customBgInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCustomBgFile}
                    />
                    <input
                      ref={customCircleInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCustomCircleFile}
                    />

                    {/* Action button cluster */}
                    <div
                      className="w-full space-y-2"
                      style={{ maxWidth: 720 }}
                    >
                      {/* Row 1 — primary: Upload Background + Download */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => customBgInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition"
                        >
                          <IconUpload className="w-4 h-4" />
                          {customBgUrl ? "Replace background" : "Upload Custom Image"}
                        </button>
                        <button
                          onClick={() => canvasRef.current?.downloadAsPng()}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition"
                        >
                          <IconDownload className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                      {customBgUrl && (
                        <button
                          onClick={handleResetCustomBg}
                          className="text-xs text-neutral-500 hover:text-neutral-800 transition"
                        >
                          Reset to article photo
                        </button>
                      )}

                      {/* Row 2 — secondary: Upload Circle + Refresh Pexels (only when Side Circle is on) */}
                      {useDefaultTemplate && useSideCircle && (
                        <>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => customCircleInputRef.current?.click()}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 transition"
                            >
                              <IconUpload className="w-3.5 h-3.5" />
                              {customCircleUrl
                                ? "Replace side-circle image"
                                : "Upload Custom Side Circle"}
                            </button>
                            <button
                              onClick={handleRefreshPexels}
                              disabled={pexelsUrls.length < 2}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:border-gray-400 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                              title={
                                pexelsUrls.length < 2
                                  ? "Only one Pexels match available"
                                  : `Showing ${pexelsIndex + 1} of ${pexelsUrls.length}`
                              }
                            >
                              <IconRefresh className="w-3.5 h-3.5" />
                              Refresh Pexels
                            </button>
                          </div>
                          {customCircleUrl && (
                            <button
                              onClick={handleResetCustomCircle}
                              className="text-xs text-neutral-500 hover:text-neutral-800 transition"
                            >
                              Reset to Pexels image
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
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
        </div>
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
