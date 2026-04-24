import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconArrowLeft,
  IconCloudRain,
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import { useWeatherMalaysia } from "../hooks/useWeatherMalaysia";
import { WeatherCanvas, type WeatherCanvasHandle } from "./WeatherCanvas";
import { ScheduleModal } from "./ScheduleModal";
import { Spinner } from "./ds/Spinner";
import { getCredentials } from "../utils/fbCredentials";

import { toast } from "../hooks/useToast";
import { BRANDS } from "../constants/brands";
import type { WeatherPost } from "../hooks/useWeatherMalaysia";
import {
  DEFAULT_WEATHER_BACKGROUNDS,
  type WeatherBackgroundsConfig,
} from "../config/weatherCanvasConfig";

type PostMode = "grouped" | "individual";

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
  { value: "grouped", label: "By Weather" },
  { value: "individual", label: "Individual (16 Posts)" },
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
  const { posts, isLoading, error, generate } = useWeatherMalaysia();
  const [brand, setBrand] = useState("");
  const [mode, setMode] = useState<PostMode>("grouped");
  const [stage, setStage] = useState<"brand-select" | "review">(
    posts.length > 0 ? "review" : "brand-select",
  );

  const [sharedCaption, setSharedCaption] = useState("");
  const groupedCanvasRefs = useRef<Map<string, WeatherCanvasHandle>>(new Map());
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
      const imageUrls = posts.map((p) => p.imageUrl);

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
    } catch {
      toast.error("Network error. Please try again.");
      setScheduleStatus("error");
    } finally {
      setIsScheduling(false);
      setShowScheduleModal(false);
    }
  }

  function handleBack() {
    if (stage === "brand-select") {
      navigate("/engagement-posts");
    } else {
      setStage("brand-select");
      setSharedCaption("");
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
            <IconCloudRain
              className="w-8 h-8"
              style={{ color: "#00E5D4" }}
            />
            <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                Weather Malaysia
              </h1>
              <p className="text-neutral-500 text-sm">
                Generate daily weather forecast posts for all states
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

        {/* Brand Select Stage */}
        {stage === "brand-select" && (
          <div className="max-w-md">
            <div className="glass-card rounded-2xl p-6 space-y-5">
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
        {stage === "review" && (
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
                      {mode === "grouped"
                        ? "post(s) by weather"
                        : "posts"}{" "}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupPostsByWeather(posts).map((group) => (
                      <div key={group.backgroundId} className="flex flex-col items-center gap-3">
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
                      disabled={isScheduling || scheduleStatus === "done"}
                      className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {isScheduling
                        ? "Scheduling…"
                        : scheduleStatus === "done"
                          ? "Scheduled!"
                          : "Schedule on FB"}
                    </button>
                  </div>
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
