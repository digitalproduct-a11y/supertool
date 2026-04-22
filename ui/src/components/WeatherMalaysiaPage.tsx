import { useState, memo, useCallback } from "react";
import { useNavigate, useBlocker } from "react-router-dom";
import { IconArrowLeft, IconCloudRain, IconDownload } from "@tabler/icons-react";
import { useWeatherMalaysia, type WeatherPost } from "../hooks/useWeatherMalaysia";
import { ScheduleModal } from "./ScheduleModal";
import { Spinner } from "./ds/Spinner";
import { getCredentials } from "../utils/fbCredentials";
import { toast } from "../hooks/useToast";
import { BRANDS } from "../constants/brands";

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

// ─── Weather Post Card ───────────────────────────────────────────────────────

interface WeatherPostCardProps {
  post: WeatherPost;
  brand: string;
  onCaptionChange: (id: string, caption: string) => void;
  onScheduleOnFB?: (
    imageUrl: string,
    caption: string,
    brand: string,
    scheduledFor?: string,
    passcode?: string,
  ) => Promise<{ success: boolean; message: string }>;
}

const WeatherPostCard = memo(function WeatherPostCard({
  post,
  brand,
  onCaptionChange,
  onScheduleOnFB,
}: WeatherPostCardProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<
    "idle" | "done" | "error"
  >("idle");
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

  function handleCopyCaption() {
    navigator.clipboard.writeText(post.caption);
    toast.success("Caption copied!");
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col">
      {/* Image preview */}
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
            <p className="text-xs">{post.min_temp}°C–{post.max_temp}°C</p>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* State name + summary */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-950">
            {post.state}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {post.summary_forecast} · {post.min_temp}°C–{post.max_temp}°C
          </p>
        </div>

        {/* Editable caption */}
        <textarea
          value={post.caption}
          onChange={(e) => onCaptionChange(post.id, e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
        />

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={handleCopyCaption}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 transition active:scale-[0.98]"
          >
            Copy caption
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition active:scale-[0.98]"
            title="Download image"
          >
            <IconDownload className="w-4 h-4 text-neutral-600" />
          </button>
        </div>

        {/* Schedule on FB */}
        {onScheduleOnFB && (
          <>
            {showScheduleModal && (
              <ScheduleModal
                brand={brand}
                hasCredentials={
                  !!getCredentials(brand.toLowerCase())
                }
                isPosting={isScheduling}
                onConfirm={async (scheduledFor, passcode) => {
                  setIsScheduling(true);
                  const result = await onScheduleOnFB(
                    post.imageUrl,
                    post.caption,
                    brand,
                    scheduledFor,
                    passcode,
                  );
                  setIsScheduling(false);
                  setShowScheduleModal(false);
                  setScheduleStatus(result.success ? "done" : "error");
                  if (result.success) toast.success("Scheduled!");
                  else toast.error(result.message);
                }}
                onClose={() => setShowScheduleModal(false)}
              />
            )}
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={isScheduling}
              className="w-full px-3 py-2 border border-neutral-950 text-neutral-950 hover:bg-neutral-950 hover:text-white disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition active:scale-[0.98]"
            >
              {isScheduling ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Scheduling…
                </span>
              ) : scheduleStatus === "done" ? (
                "Scheduled"
              ) : (
                "Schedule on FB"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
});

// ─── Main Page ───────────────────────────────────────────────────────────────

export function WeatherMalaysiaPage() {
  const navigate = useNavigate();
  const { posts, setPosts, isLoading, error, generate } =
    useWeatherMalaysia();
  const [brand, setBrand] = useState("");
  const [stage, setStage] = useState<"brand-select" | "review">(
    posts.length > 0 ? "review" : "brand-select",
  );

  // Rotating quote for loading
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useBlocker(
    useCallback(
      () =>
        stage === "review" && posts.length > 0
          ? !window.confirm(
              "You have generated posts. Are you sure you want to leave?",
            )
          : false,
      [stage, posts.length],
    ),
  );

  async function handleGenerate() {
    if (!brand) return;
    setStage("review");
    setQuoteIndex(0);
    setStepIndex(0);

    // Rotate quotes
    const quoteInterval = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % LOADING_QUOTES.length);
    }, 3000);
    const stepInterval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 8000);

    await generate(brand);

    clearInterval(quoteInterval);
    clearInterval(stepInterval);
  }

  function handleCaptionChange(id: string, caption: string) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p)),
    );
  }

  async function handleScheduleOnFB(
    imageUrl: string,
    caption: string,
    postBrand: string,
    scheduledFor?: string,
    passcode?: string,
  ): Promise<{ success: boolean; message: string }> {
    const webhookUrl = (
      import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined
    )?.trim();
    if (!webhookUrl)
      return { success: false, message: "Webhook not configured." };

    const creds = passcode
      ? { passcode }
      : getCredentials(postBrand.toLowerCase());
    if (!creds) return { success: false, message: "credentials_required" };

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fb_ai_image_url: imageUrl,
          fb_ai_caption: caption,
          brand: postBrand.toLowerCase(),
          ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
          passcode: creds.passcode,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        status?: string;
        message?: string;
      };
      if (data.status === "AUTH_ERROR")
        return {
          success: false,
          message: data.message ?? "Invalid passcode.",
        };
      if (
        data.success === true ||
        data.status === "SUCCESS" ||
        data.status === "DRAFT_SAVED"
      )
        return { success: true, message: "Scheduled!" };
      return {
        success: false,
        message: data.message ?? "Something went wrong.",
      };
    } catch {
      return { success: false, message: "Network error. Please try again." };
    }
  }

  function handleBack() {
    if (stage === "brand-select") {
      navigate("/engagement-posts");
    } else {
      setStage("brand-select");
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
                  {/* Progress steps */}
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
                  {/* Rotating quote */}
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
                    onClick={() => setStage("brand-select")}
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

            {/* Results grid */}
            {!isLoading && !error && posts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm text-neutral-500">
                    <span className="font-semibold text-neutral-800">
                      {posts.length}
                    </span>{" "}
                    weather posts generated for{" "}
                    <span className="font-semibold text-neutral-800">
                      {brand}
                    </span>
                  </p>
                  <button
                    onClick={() => setStage("brand-select")}
                    className="text-xs text-neutral-500 hover:text-neutral-800 transition"
                  >
                    Start over
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {posts.map((post) => (
                    <WeatherPostCard
                      key={post.id}
                      post={post}
                      brand={brand}
                      onCaptionChange={handleCaptionChange}
                      onScheduleOnFB={handleScheduleOnFB}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
