import { useState, useRef, useEffect, useCallback, memo } from "react";
import { trackToolSubmit, trackButtonClick } from '../utils/analytics'
import { useNavigate, Link } from "react-router-dom";
import { useBrand } from '../context/BrandContext'
import { useBrandNavigate, useBrandPath } from '../hooks/useBrandNavigate'
import {
  IconChevronLeft,
  IconChevronRight,
  IconCloudRain,
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import { useWeatherMalaysia } from "../hooks/useWeatherMalaysia";
import { WeatherCanvas, type WeatherCanvasHandle } from "../features/weather/WeatherCanvas";
import { WeatherSinglePostCanvas, type WeatherSinglePostCanvasHandle } from "../features/weather/WeatherSinglePostCanvas";
import { GegarRegionPosterCanvas } from "../features/weather/GegarRegionPosterCanvas";
import { ScheduleModal } from "../components/ScheduleModal";
import { Spinner } from "../components/ds/Spinner";
import { getCredentials } from "../utils/fbCredentials";
import { uploadToCloudinary } from "../utils/cloudinary";

import { toast } from "../hooks/useToast";
import { BRANDS } from "../constants/brands";
import type { WeatherPost } from "../hooks/useWeatherMalaysia";
import {
  DEFAULT_WEATHER_BACKGROUNDS,
  type WeatherBackgroundsConfig,
} from "../config/weatherCanvasConfig";

type PostMode = "grouped" | "individual" | "single";

interface WeatherGroup {
  label: string;
  backgroundId: string;
  posts: WeatherPost[];
}

function groupPostsByWeather(
  posts: WeatherPost[],
  bgConfig: WeatherBackgroundsConfig = DEFAULT_WEATHER_BACKGROUNDS,
): WeatherGroup[] {
  const groups = new Map<string, WeatherGroup>();

  for (const post of posts) {
    const forecast = (post.summary_forecast || "").toLowerCase();
    let matched = false;
    for (const rule of bgConfig.rules) {
      if (forecast.includes(rule.contains)) {
        const existing = groups.get(rule.publicId);
        if (existing) {
          existing.posts.push(post);
        } else {
          groups.set(rule.publicId, {
            label: rule.label,
            backgroundId: rule.publicId,
            posts: [post],
          });
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      const existing = groups.get(bgConfig.defaultPublicId);
      if (existing) {
        existing.posts.push(post);
      } else {
        groups.set(bgConfig.defaultPublicId, {
          label: bgConfig.defaultLabel,
          backgroundId: bgConfig.defaultPublicId,
          posts: [post],
        });
      }
    }
  }

  return Array.from(groups.values());
}

const LOADING_QUOTES = [
  "Checking the skies across Malaysia...",
  "Reading satellite data...",
  "Gathering forecasts for all 16 states...",
  "Compiling weather patterns...",
  "Almost there — processing images...",
];

const LOADING_STEPS = [
  "Fetching weather data",
  "Generating images",
  "Writing captions",
];

// ─── Weather Image Card (individual mode) ────────────────────────────────────

const WeatherImageCard = memo(function WeatherImageCard({
  post,
}: {
  post: WeatherPost;
}) {
  const [imgError, setImgError] = useState(false);

  async function handleDownload() {
    try {
      const res = await fetch(post.imageUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `weather-${post.state.replace(/\s+/g, "-").toLowerCase()}.jpg`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed.");
    }
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col">
      <div className="relative aspect-[1080/1350] bg-neutral-100">
        {!imgError && post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt={`Weather forecast for ${post.state}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-neutral-200 to-neutral-300 text-neutral-500">
            <IconCloudRain className="w-12 h-12 mb-2 opacity-40" />
            <p className="text-sm font-semibold">{post.state}</p>
            <p className="text-xs mt-1">{post.summary_forecast}</p>
            <p className="text-xs">
              {post.min_temp}°C–{post.max_temp}°C
            </p>
          </div>
        )}
      </div>

      <div className="p-3 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-950 truncate">
            {post.state}
          </h3>
          <p className="text-xs text-neutral-500 truncate">
            {post.summary_forecast} · {post.min_temp}°C–{post.max_temp}°C
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="shrink-0 ml-2 px-2.5 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition active:scale-[0.98]"
          title="Download image"
        >
          <IconDownload className="w-4 h-4 text-neutral-600" />
        </button>
      </div>
    </div>
  );
});

// ─── Mode Toggle ─────────────────────────────────────────────────────────────

const MODE_OPTIONS: { value: PostMode; label: string }[] = [
  { value: "single", label: "Single Post" },
];

function ModeToggle({
  mode,
  onChange,
}: {
  mode: PostMode;
  onChange: (m: PostMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50">
      {MODE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
            mode === opt.value
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function WeatherMalaysiaPage() {
  const navigate = useNavigate();
  const brandNavigate = useBrandNavigate()
  const postQueuePath = useBrandPath('/post-queue')
  const { selectedBrand: globalBrand, isAdmin } = useBrand()
  const { posts, fontUse: rawFontUse, brandColor, nationalSummary, regions, isLoading, error, generate } = useWeatherMalaysia();
  const [brand, setBrand] = useState((!isAdmin && globalBrand) ? globalBrand : "");
  // Gegar has a single bespoke output (the combined East Coast poster), so it
  // always runs in single-post mode regardless of the mode toggle.
  const isGegar = brand === "Gegar";
  // Brands that should render the weather post in the canvas-default Inter
  // face rather than their usual brand font.
  const WEATHER_INTER_BRANDS = new Set(["Sinar", "Era"]);
  const fontUse = WEATHER_INTER_BRANDS.has(brand) ? null : rawFontUse;
  const [mode, setMode] = useState<PostMode>("single");
  const [stage, setStage] = useState<"intro" | "brand-select" | "review">(
    posts.length > 0 ? "review" : "intro",
  );

  // Lock Gegar to single-post mode (its only output is the combined poster).
  useEffect(() => {
    if (isGegar) setMode("single");
  }, [isGegar]);

  // Reset the Gegar gallery to the first creative whenever a new set arrives.
  useEffect(() => {
    setGegarSelected(0);
  }, [regions]);

  const [sharedCaption, setSharedCaption] = useState("");
  const groupedCanvasRefs = useRef<Map<string, WeatherCanvasHandle>>(new Map());
  // Gegar renders one poster per state (Pahang / Kelantan / Terengganu); keep a
  // handle per state, keyed by region.state — mirrors groupedCanvasRefs.
  // Gegar gallery: the 3 thumbnail canvases (source of truth for scheduling /
  // download-all) + the large main-preview canvas for the selected state.
  const gegarCanvasRefs = useRef<Map<string, WeatherSinglePostCanvasHandle>>(new Map());
  const gegarMainRef = useRef<WeatherSinglePostCanvasHandle>(null);
  const [gegarSelected, setGegarSelected] = useState(0);
  const singleCanvasRef = useRef<WeatherSinglePostCanvasHandle>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightboxUrl(null), []);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxUrl, closeLightbox]);

  // Schedule state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<
    "idle" | "done" | "error"
  >("idle");

  // Rotating quote for loading
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  async function handleGenerate() {
    if (!brand) return;
    const [, brandSlug, ...toolParts] = window.location.pathname.split('/')
    trackToolSubmit(toolParts.join('/') || 'unknown', brandSlug ?? 'unknown')
    setStage("review");
    setSharedCaption("");
    setQuoteIndex(0);
    setStepIndex(0);
    setScheduleStatus("idle");

    const quoteInterval = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % LOADING_QUOTES.length);
    }, 3000);
    const stepInterval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 8000);

    const result = await generate(brand, mode);

    clearInterval(quoteInterval);
    clearInterval(stepInterval);

    if (result.length > 0) {
      setSharedCaption(result[0].caption);
    }
  }

  function handleCopyCaption() {
    trackButtonClick('caption_copied')
    navigator.clipboard.writeText(sharedCaption);
    toast.success("Caption copied!");
  }

  async function handleScheduleAll(
    scheduledFor: string,
    passcode?: string,
  ) {
    const webhookUrl = (
      import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined
    )?.trim();
    if (!webhookUrl) {
      toast.error("Webhook not configured.");
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
      // FB needs public URLs. Grouped mode renders client-side canvases —
      // upload each one to Cloudinary. Individual mode already has public
      // imageUrls from the n8n response.
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
      let imageUrls: string[];
      if (isGegar) {
        // Gegar = 3 per-state posters → upload each → carousel_images carries
        // all 3, which the FB publisher treats as a carousel post.
        const orderedStates = (regions ?? []).map((r) => r.state);
        const dataUrls = orderedStates.map(
          (state) => gegarCanvasRefs.current.get(state)?.getDataUrl() ?? null,
        );
        if (dataUrls.length === 0 || dataUrls.some((u) => !u)) {
          toast.error("Some images aren't ready yet.");
          setIsScheduling(false);
          return;
        }
        imageUrls = await Promise.all(
          (dataUrls as string[]).map(async (dataUrl, i) => {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File(
              [blob],
              `weather-gegar-${orderedStates[i].toLowerCase()}-${Date.now()}.png`,
              { type: "image/png" },
            );
            const publicId = await uploadToCloudinary(file);
            return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
          }),
        );
      } else if (mode === "grouped") {
        const groups = groupPostsByWeather(posts);
        const dataUrls = groups.map((g) => {
          const handle = groupedCanvasRefs.current.get(g.backgroundId);
          return handle?.getDataUrl() ?? null;
        });
        if (dataUrls.some((u) => !u)) {
          toast.error("Some images aren't ready yet.");
          setIsScheduling(false);
          return;
        }
        const uploads = await Promise.all(
          (dataUrls as string[]).map(async (dataUrl, i) => {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File(
              [blob],
              `weather-${brand.toLowerCase()}-${groups[i].backgroundId}-${Date.now()}.png`,
              { type: "image/png" },
            );
            const publicId = await uploadToCloudinary(file);
            return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
          }),
        );
        imageUrls = uploads;
      } else if (mode === "single") {
        const dataUrl = singleCanvasRef.current?.getDataUrl() ?? null;
        if (!dataUrl) {
          toast.error("Image isn't ready yet.");
          setIsScheduling(false);
          return;
        }
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File(
          [blob],
          `weather-${brand.toLowerCase()}-single-${Date.now()}.png`,
          { type: "image/png" },
        );
        const publicId = await uploadToCloudinary(file);
        imageUrls = [`https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`];
      } else {
        imageUrls = posts.map((p) => p.imageUrl);
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fb_ai_image_url: imageUrls[0],
          carousel_images: imageUrls,
          fb_ai_caption: sharedCaption,
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
        toast.success("Weather posts scheduled!");
        setScheduleStatus("done");
      } else {
        toast.error(data.message ?? "Something went wrong.");
        setScheduleStatus("error");
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message.startsWith("Upload failed")
          ? "Image upload failed. Please try again."
          : "Network error. Please try again.";
      toast.error(msg);
      setScheduleStatus("error");
    } finally {
      setIsScheduling(false);
      setShowScheduleModal(false);
    }
  }

  function handleBack() {
    if (stage === "intro") {
      if (window.history.length > 1) { navigate(-1); } else { brandNavigate("/home"); }
    } else if (stage === "brand-select") {
      setStage("intro");
    } else {
      setStage("brand-select");
      setSharedCaption("");
    }
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Intro */}
        {stage === 'intro' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden grid grid-cols-1 md:grid-cols-2">
              {/* Left: title, description, controls */}
              <div className="p-8 flex flex-col justify-center space-y-4">
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950 self-start -ml-2"
                >
                  <IconChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="font-display text-lg font-semibold text-neutral-950">Weather Malaysia</h2>
                  <p className="text-sm text-neutral-500 mt-1">Get today's weather forecast for all Malaysian states and generate a branded post ready for social media.</p>
                </div>
                {(isAdmin || !globalBrand) && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-950 mb-2">Select Brand</label>
                    <div className="relative">
                      <select
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full px-4 py-3 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition"
                      >
                        <option value="">Select a brand...</option>
                        {BRANDS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => { handleGenerate() }}
                  disabled={!brand || isLoading}
                  className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
                >
                  Generate Post
                </button>
              </div>
              {/* Right: image */}
              <div className="aspect-video md:aspect-auto bg-[#ECFDF5] flex items-center justify-center">
                <img src="/weather-malaysia-card.png" alt="Weather Malaysia" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        )}

        {/* Single-post mode — two-column layout */}
        {mode === "single" && stage !== 'intro' && (<>
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
              >
                <IconChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Weather Malaysia</h1>
            </div>
            <p className="text-neutral-500 text-sm">Generate daily weather forecast posts for all states</p>
            <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-stretch">
            {/* Left: Controls */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-5">
              {(isAdmin || !globalBrand) && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Brand</label>
                  <div className="relative">
                    <select
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-4 py-3 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition"
                    >
                      <option value="">Select a brand...</option>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}

              {(isLoading || (!error && posts.length > 0)) && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Caption</label>
                    {isLoading ? (
                      <div className="w-full h-28 bg-neutral-100 rounded-xl animate-pulse" />
                    ) : (
                      <textarea
                        value={sharedCaption}
                        onChange={(e) => setSharedCaption(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                      />
                    )}
                  </div>

                  {isLoading ? (
                    <div className="flex gap-3">
                      <div className="flex-1 h-12 bg-neutral-100 rounded-xl animate-pulse" />
                      <div className="flex-1 h-12 bg-neutral-100 rounded-xl animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            if (isGegar) {
                              gegarCanvasRefs.current.forEach((h) => h.downloadAsPng());
                            } else {
                              singleCanvasRef.current?.downloadAsPng();
                            }
                          }}
                          className="flex-1 px-4 py-3 border border-neutral-200 hover:bg-neutral-50 text-neutral-950 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          <IconDownload className="w-4 h-4" />
                          {isGegar ? "Download all (3)" : "Download image"}
                        </button>
                        <button
                          onClick={() => setShowScheduleModal(true)}
                          disabled={isScheduling}
                          className="flex-1 px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          {isScheduling ? "Scheduling…" : "Schedule Post"}
                        </button>
                      </div>
                      {scheduleStatus === 'done' && (
                        <div className="text-center space-y-1 mt-1">
                          <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
                          <p className="text-xs text-neutral-400">
                            To view or delete your scheduled post, check{' '}
                            <Link to={postQueuePath} className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
                              here
                            </Link>.
                          </p>
                        </div>
                      )}
                      {scheduleStatus === 'error' && (
                        <p className="text-xs text-red-500">Failed to schedule. Please try again.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right: Preview */}
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden min-h-96 flex flex-col">
              {isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 p-12">
                  <Spinner size="lg" />
                  <div className="space-y-3">
                    <div className="flex flex-col items-start gap-2 text-left">
                      {LOADING_STEPS.map((step, i) => (
                        <div key={step} className="flex items-center gap-2 text-sm">
                          {i < stepIndex ? (
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : i === stepIndex ? (
                            <div className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-neutral-200" />
                          )}
                          <span className={i <= stepIndex ? "text-neutral-800 font-medium" : "text-neutral-400"}>
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p key={quoteIndex} className="text-xs text-neutral-400 italic animate-fade-slide-up">
                      {LOADING_QUOTES[quoteIndex]}
                    </p>
                  </div>
                </div>
              )}

              {!isLoading && error && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                  <button
                    onClick={handleGenerate}
                    className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 transition active:scale-[0.98]"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!isLoading && !error && posts.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div>
                    <svg className="w-12 h-12 text-neutral-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-neutral-400 text-sm">Your generated post will appear here</p>
                  </div>
                </div>
              )}

              {!isLoading && !error && posts.length > 0 && (
                <div className="p-4">
                  {isGegar && regions && regions.length > 0 ? (
                    (() => {
                      const count = regions.length;
                      const current = regions[Math.min(gegarSelected, count - 1)];
                      const go = (delta: number) =>
                        setGegarSelected((i) => (i + delta + count) % count);
                      return (
                        <div className="flex flex-col items-center gap-4">
                          {/* Main preview — the selected state's live canvas */}
                          <div className="w-full flex flex-col items-center gap-2">
                            <h3 className="text-sm font-semibold text-neutral-800">
                              {current.state}{" "}
                              <span className="font-normal text-neutral-500">
                                ({current.districts.length} daerah)
                              </span>
                            </h3>
                            <div className="relative w-full" style={{ maxWidth: 380 }}>
                              <GegarRegionPosterCanvas
                                key={current.state}
                                ref={gegarMainRef}
                                region={current}
                                brand={brand}
                                date={posts[0]?.date}
                                day={posts[0]?.day}
                                fontUse={fontUse}
                                brandColor={brandColor}
                                onClick={() => {
                                  const url = gegarMainRef.current?.getDataUrl();
                                  if (url) setLightboxUrl(url);
                                }}
                              />
                              {count > 1 && (
                                <>
                                  <button
                                    onClick={() => go(-1)}
                                    aria-label="Previous"
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 shadow hover:bg-white text-neutral-800 transition active:scale-95"
                                  >
                                    <IconChevronLeft className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => go(1)}
                                    aria-label="Next"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 shadow hover:bg-white text-neutral-800 transition active:scale-95"
                                  >
                                    <IconChevronRight className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => gegarMainRef.current?.downloadAsPng()}
                              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-950 transition active:scale-[0.98]"
                            >
                              <IconDownload className="w-3.5 h-3.5" />
                              Download {current.state}
                            </button>
                          </div>

                          {/* Thumbnails — live mini canvases; also the ref source
                              for scheduling + download-all. */}
                          <div className="flex items-center justify-center gap-3">
                            {regions.map((region, idx) => {
                              const active = idx === Math.min(gegarSelected, count - 1);
                              return (
                                <button
                                  key={region.state}
                                  onClick={() => setGegarSelected(idx)}
                                  aria-label={region.state}
                                  className={`rounded-lg overflow-hidden border transition ${
                                    active
                                      ? "ring-2 ring-neutral-900 border-neutral-900"
                                      : "border-neutral-200 hover:border-neutral-400 opacity-80 hover:opacity-100"
                                  }`}
                                  style={{ width: 72 }}
                                >
                                  <div className="pointer-events-none">
                                    <GegarRegionPosterCanvas
                                      ref={(handle) => {
                                        if (handle) {
                                          gegarCanvasRefs.current.set(region.state, handle);
                                        } else {
                                          gegarCanvasRefs.current.delete(region.state);
                                        }
                                      }}
                                      region={region}
                                      brand={brand}
                                      date={posts[0]?.date}
                                      day={posts[0]?.day}
                                      fontUse={fontUse}
                                      brandColor={brandColor}
                                    />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center">
                      <WeatherSinglePostCanvas
                        ref={singleCanvasRef}
                        posts={posts}
                        brand={brand}
                        fontUse={fontUse}
                        brandColor={brandColor}
                        nationalSummary={nationalSummary}
                        onClick={() => {
                          const url = singleCanvasRef.current?.getDataUrl();
                          if (url) setLightboxUrl(url);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {showScheduleModal && (
              <ScheduleModal
                brand={brand}
                hasCredentials={!!getCredentials(brand.toLowerCase())}
                isPosting={isScheduling}
                onConfirm={handleScheduleAll}
                onClose={() => setShowScheduleModal(false)}
              />
            )}
          </div>
        </>)}

        {/* Header for non-single grouped/individual modes */}
        {mode !== "single" && stage !== "intro" && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
              >
                <IconChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Weather Malaysia</h1>
            </div>
            <p className="text-neutral-500 text-sm">Generate daily weather forecast posts for all states</p>
            <div className="mt-4 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
          </div>
        )}

        {/* Brand Select Stage */}
        {mode !== "single" && stage !== "intro" && stage === "brand-select" && (
          <div className="max-w-md">
            <div className="glass-card rounded-2xl p-6 space-y-5">
              {(isAdmin || !globalBrand) && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Select brand
                  </label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
                  >
                    <option value="">Choose a brand…</option>
                    {BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mode toggle */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Post type
                </label>
                <ModeToggle mode={mode} onChange={setMode} />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!brand}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-neutral-950 hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Generate Weather Posts
              </button>
            </div>
          </div>
        )}

        {/* Review Stage */}
        {mode !== "single" && stage === "review" && (
          <>
            {/* Loading */}
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

            {/* Error */}
            {!isLoading && error && (
              <div className="glass-card rounded-2xl p-8 text-center space-y-4">
                <p className="text-sm text-red-600 font-medium">{error}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setStage("brand-select");
                      setSharedCaption("");
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
                  >
                    Change brand
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

            {/* Results */}
            {!isLoading && !error && posts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-neutral-500">
                      <span className="font-semibold text-neutral-800">
                        {mode === "grouped"
                          ? groupPostsByWeather(posts).length
                          : posts.length}
                      </span>{" "}
                      weather{" "}
                      {mode === "grouped" ? "post(s) by weather" : "posts"}{" "}
                      generated for{" "}
                      <span className="font-semibold text-neutral-800">
                        {brand}
                      </span>
                    </p>
                    <ModeToggle mode={mode} onChange={setMode} />
                  </div>
                  <button
                    onClick={() => {
                      setStage("brand-select");
                      setSharedCaption("");
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-800 transition"
                  >
                    Start over
                  </button>
                </div>

                {/* Grouped by weather mode */}
                {mode === "grouped" && (
                  <div className="flex flex-wrap justify-center items-center gap-6">
                    {groupPostsByWeather(posts).map((group) => (
                      <div key={group.backgroundId} className="flex flex-col items-center gap-3 w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]">
                        <h3 className="text-sm font-semibold text-neutral-800">
                          {group.label}{" "}
                          <span className="font-normal text-neutral-500">
                            ({group.posts.length} state{group.posts.length > 1 ? "s" : ""})
                          </span>
                        </h3>
                        <WeatherCanvas
                          ref={(handle) => {
                            if (handle) {
                              groupedCanvasRefs.current.set(group.backgroundId, handle);
                            } else {
                              groupedCanvasRefs.current.delete(group.backgroundId);
                            }
                          }}
                          posts={group.posts}
                          brand={brand}
                          backgroundOverride={group.backgroundId}
                          fontUse={fontUse}
                          onClick={() => {
                            const url = groupedCanvasRefs.current
                              .get(group.backgroundId)
                              ?.getDataUrl();
                            if (url) setLightboxUrl(url);
                          }}
                        />
                        <button
                          onClick={() =>
                            groupedCanvasRefs.current
                              .get(group.backgroundId)
                              ?.downloadAsPng()
                          }
                          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition active:scale-[0.98]"
                        >
                          <IconDownload className="w-3.5 h-3.5" />
                          Download {group.label}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Individual posts mode — image grid */}
                {mode === "individual" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {posts.map((post) => (
                      <WeatherImageCard key={post.id} post={post} />
                    ))}
                  </div>
                )}

                {/* Shared caption + schedule section */}
                <div className="mt-8 glass-card rounded-2xl p-6 max-w-2xl mx-auto space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                      Caption for posts
                    </label>
                    <textarea
                      value={sharedCaption}
                      onChange={(e) => setSharedCaption(e.target.value)}
                      rows={4}
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
                      disabled={isScheduling}
                      className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {isScheduling ? "Scheduling…" : "Schedule Post"}
                    </button>
                  </div>
                  {scheduleStatus === 'done' && (
                    <div className="text-center space-y-1 mt-1">
                      <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
                      <p className="text-xs text-neutral-400">
                        To view or delete your scheduled post, check{' '}
                        <Link to={postQueuePath} className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
                          here
                        </Link>.
                      </p>
                    </div>
                  )}
                </div>

                {/* Schedule modal */}
                {showScheduleModal && (
                  <ScheduleModal
                    brand={brand}
                    hasCredentials={!!getCredentials(brand.toLowerCase())}
                    isPosting={isScheduling}
                    onConfirm={handleScheduleAll}
                    onClose={() => setShowScheduleModal(false)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox modal */}
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
            alt="Weather preview"
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}
