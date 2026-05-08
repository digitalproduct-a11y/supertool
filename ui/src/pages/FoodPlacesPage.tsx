import { useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconChevronLeft,
  IconDownload,
  IconChevronRight,
  IconCopy,
  IconX,
  IconSoup,
} from "@tabler/icons-react";
import JSZip from "jszip";
import { ScheduleModal } from "../components/ScheduleModal";
import { BRANDS } from "../constants/brands";
import { uploadToCloudinary, uploadUrlToCloudinary } from "../utils/cloudinary";
import { getCredentials } from "../utils/fbCredentials";
import { toast } from "../hooks/useToast";
import { CarouselProgressSteps } from "../features/carousel/CarouselProgressSteps";
import {
  FoodPlacesCanvas,
  type FoodPlacesCanvasHandle,
} from "../features/foodplaces/FoodPlacesCanvas";
import { FOOD_PLACES_PROGRESS_STEPS } from "../features/foodplaces/progressSteps";
import { SuggestInput } from "../features/foodplaces/SuggestInput";
import {
  FOOD_SUGGESTIONS,
  LOCATION_SUGGESTIONS,
} from "../features/foodplaces/suggestions";
import type {
  FoodPlace,
  FoodPlacesResponse,
  FoodPlacesSlide,
} from "../features/foodplaces/types";

type Stage = "idle" | "loading" | "results" | "empty" | "error";

interface PlaceWithPublicId extends FoodPlace {
  photoPublicId: string | null;
}

interface ResultData {
  places: PlaceWithPublicId[];
  searchQuery: string;
  brandVoiceUsed: string;
  cached: boolean;
  cacheAgeSeconds: number;
  rawReturned: number;
}

export function FoodPlacesPage() {
  const navigate = useNavigate();
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
  const webhookUrl = import.meta.env.VITE_FOOD_PLACES_WEBHOOK_URL as
    | string
    | undefined;

  const [brand, setBrand] = useState("");
  const [foodKeyword, setFoodKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [watchParty, setWatchParty] = useState(false);

  const [stage, setStage] = useState<Stage>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [emptyMessage, setEmptyMessage] = useState("");
  const [result, setResult] = useState<ResultData | null>(null);

  const [editedTitle, setEditedTitle] = useState("");
  const [editedCaption, setEditedCaption] = useState("");
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const canvasRef = useRef<FoodPlacesCanvasHandle>(null);

  const ready = !!brand.trim() && !!foodKeyword.trim() && !!location.trim();

  const slides: FoodPlacesSlide[] = useMemo(() => {
    if (!result) return [];
    const cover: FoodPlacesSlide = {
      type: "cover",
      title: editedTitle,
      photoPublicId: result.places[0]?.photoPublicId ?? null,
    };
    const placeSlides: FoodPlacesSlide[] = result.places.map((p) => ({
      type: "place",
      place: p,
      photoPublicId: p.photoPublicId,
    }));
    return [cover, ...placeSlides];
  }, [result, editedTitle]);

  const currentSlide = slides[currentSlideIdx];

  const handleSubmit = useCallback(async () => {
    if (!ready) return;
    if (!webhookUrl) {
      setErrorMessage("Webhook URL not configured.");
      setStage("error");
      return;
    }

    setStage("loading");
    setErrorMessage("");
    setEmptyMessage("");
    setResult(null);
    setCurrentSlideIdx(0);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_keyword: foodKeyword.trim(),
          location: location.trim(),
          brand,
          watch_party: watchParty,
        }),
      });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      const data = (await res.json()) as FoodPlacesResponse;

      if (!data.places || data.places.length === 0) {
        setEmptyMessage(
          `Searched "${foodKeyword} in ${location}" — found ${
            data.raw_returned ?? 0
          } raw, none passed filters. Try a broader area.`,
        );
        setStage("empty");
        return;
      }

      // Pre-upload photos to Cloudinary so fabric can read them with CORS
      // (Google Places photos taint the canvas otherwise).
      const uploaded: PlaceWithPublicId[] = await Promise.all(
        data.places.map(async (p) => {
          if (!p.photo_url) return { ...p, photoPublicId: null };
          try {
            const publicId = await uploadUrlToCloudinary(p.photo_url);
            return { ...p, photoPublicId: publicId };
          } catch {
            return { ...p, photoPublicId: null };
          }
        }),
      );

      setResult({
        places: uploaded,
        searchQuery: data.search_query ?? "",
        brandVoiceUsed: data.brand_voice_used ?? brand,
        cached: !!data.cached,
        cacheAgeSeconds: data.cache_age_seconds ?? 0,
        rawReturned: data.raw_returned ?? uploaded.length,
      });
      setEditedTitle(data.cover_title ?? "");
      setEditedCaption(data.caption ?? "");
      setStage("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error.";
      setErrorMessage(`Search failed: ${msg}`);
      setStage("error");
    }
  }, [ready, webhookUrl, foodKeyword, location, brand, watchParty]);

  // Render every slide once and return their dataURLs. Mounts each slide in
  // an offscreen canvas inside this component briefly via setCurrentSlideIdx
  // would be slow; instead we render directly into a hidden canvas. To keep
  // the implementation simple, walk the slides sequentially through the
  // visible canvas (small N, ≤6) and read getDataUrl after each render.
  const collectAllSlideDataUrls = useCallback(async (): Promise<string[]> => {
    if (!result) return [];
    const urls: string[] = [];
    for (let i = 0; i < slides.length; i++) {
      setCurrentSlideIdx(i);
      // Wait two animation frames for the canvas effect to render and blit.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      // Allow async font/image loads to settle (esp. first slide).
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      const url = canvasRef.current?.getDataUrl();
      if (url) urls.push(url);
    }
    return urls;
  }, [result, slides.length]);

  const handleDownloadZip = useCallback(async () => {
    if (!result) return;
    setIsDownloading(true);
    try {
      const dataUrls = await collectAllSlideDataUrls();
      if (dataUrls.length === 0) {
        toast.error("No slides to download.");
        return;
      }
      const zip = new JSZip();
      for (let i = 0; i < dataUrls.length; i++) {
        const blob = await (await fetch(dataUrls[i])).blob();
        zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const stem = `food-places-${brand.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
      link.download = `${stem}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("ZIP downloaded.");
    } catch {
      toast.error("Download failed.");
    } finally {
      setIsDownloading(false);
    }
  }, [result, brand, collectAllSlideDataUrls]);

  const handleSchedule = useCallback(
    async (scheduledFor: string, passcode?: string) => {
      const draftWebhook = (
        import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined
      )?.trim();
      if (!draftWebhook) {
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
        // Render every slide and upload each to Cloudinary so Zernio gets
        // public URLs for the carousel.
        const dataUrls = await collectAllSlideDataUrls();
        if (dataUrls.length === 0) {
          toast.error("Slides not ready.");
          return;
        }
        const carouselUrls: string[] = [];
        for (let i = 0; i < dataUrls.length; i++) {
          const blob = await (await fetch(dataUrls[i])).blob();
          const file = new File(
            [blob],
            `food-places-${brand.toLowerCase()}-${Date.now()}-${i}.png`,
            { type: "image/png" },
          );
          const publicId = await uploadToCloudinary(file);
          carouselUrls.push(
            `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`,
          );
        }
        const res = await fetch(draftWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fb_ai_image_url: carouselUrls[0],
            carousel_images: carouselUrls,
            fb_ai_caption: editedCaption,
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
        } else if (
          data.success === true ||
          data.status === "SUCCESS" ||
          data.status === "DRAFT_SAVED"
        ) {
          toast.success("Food Places carousel scheduled!");
        } else {
          toast.error(data.message ?? "Something went wrong.");
        }
      } catch (err) {
        const msg =
          err instanceof Error && err.message.startsWith("Upload failed")
            ? "Image upload failed. Please try again."
            : "Network error. Please try again.";
        toast.error(msg);
      } finally {
        setIsScheduling(false);
        setShowScheduleModal(false);
      }
    },
    [brand, cloudName, editedCaption, collectAllSlideDataUrls],
  );

  function handleCopyCaption() {
    if (!editedCaption) return;
    navigator.clipboard.writeText(editedCaption).then(
      () => toast.success("Caption copied."),
      () => toast.error("Copy failed."),
    );
  }

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate("/engagement-posts")}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
              Food Places Search
            </h1>
          </div>
          <p className="text-neutral-500 text-sm ml-11">
            Generate top food spot carousels in your brand's voice.
          </p>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{
              background:
                "linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)",
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
          {/* LEFT — form */}
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-5">
            {/* Brand */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Brand
              </label>
              <div className="relative">
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
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

            {/* Food keyword */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dish / Food keyword
              </label>
              <SuggestInput
                value={foodKeyword}
                onChange={setFoodKeyword}
                options={FOOD_SUGGESTIONS}
                placeholder="e.g. nasi lemak, wantan mee, dim sum"
              />
              <p className="text-xs text-neutral-500 mt-1.5">
                Generic categories like "pork noodles" auto-expand to specific
                dish names.
              </p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <SuggestInput
                value={location}
                onChange={setLocation}
                options={LOCATION_SUGGESTIONS}
                placeholder="e.g. Subang, KL, SS 15, USJ 9"
              />
              <p className="text-xs text-neutral-500 mt-1.5">
                Tiny sub-areas (SS 15, Section 14) auto-broaden to parent area.
              </p>
            </div>

            {/* Watch-party toggle */}
            <label className="flex items-start gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/60 cursor-pointer hover:bg-neutral-50 transition select-none">
              <input
                type="checkbox"
                checked={watchParty}
                onChange={(e) => setWatchParty(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-neutral-900 cursor-pointer"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-neutral-900">
                  ⚽ Football watch-party angle
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Frame title and caption around match-watching, mamak hangout
                  vibes. Best paired with mamak.
                </div>
              </div>
            </label>

            <button
              onClick={handleSubmit}
              disabled={!ready || stage === "loading"}
              className="w-full px-5 py-3.5 rounded-xl text-base font-semibold transition disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 bg-neutral-950 text-white hover:bg-neutral-800 active:scale-[0.99]"
            >
              {stage === "loading"
                ? "Searching the streets…"
                : "Generate Food Places Carousel"}
            </button>
          </div>

          {/* RIGHT — preview */}
          <div className="glass-card rounded-2xl p-6 min-h-96 flex flex-col space-y-4">
            {stage === "idle" && (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <IconSoup
                    className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-breathe"
                    strokeWidth={1.5}
                  />
                  <p className="text-gray-400 text-sm">
                    Your food places carousel will appear here
                  </p>
                </div>
              </div>
            )}

            {stage === "loading" && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2 text-center">
                    Generating your carousel
                  </h3>
                  <p className="text-xs text-gray-400 text-center">
                    This usually takes 60–90 seconds
                  </p>
                </div>
                <CarouselProgressSteps
                  isComplete={false}
                  steps={FOOD_PLACES_PROGRESS_STEPS}
                />
              </div>
            )}

            {stage === "empty" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                <div className="text-4xl">🤷</div>
                <p className="font-semibold text-gray-800 text-sm">
                  No matches found
                </p>
                <p className="text-xs text-gray-500 max-w-xs">{emptyMessage}</p>
                <button
                  onClick={() => setStage("idle")}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  Try a different search
                </button>
              </div>
            )}

            {stage === "error" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">
                    Something went wrong
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{errorMessage}</p>
                </div>
                <button
                  onClick={() => setStage("idle")}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  Try again
                </button>
              </div>
            )}

            {stage === "results" && result && currentSlide && (
              <div className="animate-fade-slide-up space-y-4">
                {/* Canvas + overlay arrows + counter */}
                <div className="relative">
                  <FoodPlacesCanvas
                    ref={canvasRef}
                    slide={currentSlide}
                    brand={brand}
                    cloudName={cloudName}
                    onClick={() => {
                      const url = canvasRef.current?.getDataUrl();
                      if (url) setLightboxUrl(url);
                    }}
                  />
                  {slides.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlideIdx((i) => Math.max(0, i - 1));
                        }}
                        disabled={currentSlideIdx === 0}
                        className="absolute top-1/2 left-3 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-sm text-white flex items-center justify-center transition disabled:opacity-0 disabled:cursor-default"
                      >
                        <IconChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlideIdx((i) =>
                            Math.min(slides.length - 1, i + 1),
                          );
                        }}
                        disabled={currentSlideIdx === slides.length - 1}
                        className="absolute top-1/2 right-3 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-sm text-white flex items-center justify-center transition disabled:opacity-0 disabled:cursor-default"
                      >
                        <IconChevronRight className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-xs font-medium">
                        {currentSlideIdx + 1} / {slides.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Thumbnail strip */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {slides.map((s, i) => {
                    const photoUrl = s.photoPublicId
                      ? `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,g_auto,w_160,h_160,f_auto,q_auto/${s.photoPublicId}`
                      : null;
                    const isSelected = i === currentSlideIdx;
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentSlideIdx(i)}
                        className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected
                            ? "border-neutral-950 shadow-sm"
                            : "border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-200" />
                        )}
                        {s.type === "cover" ? (
                          <div className="absolute top-1 left-1 px-1 py-0.5 rounded text-[9px] font-bold bg-neutral-950 text-white leading-none">
                            MAIN
                          </div>
                        ) : (
                          <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-[9px] font-bold text-white text-center">
                            #{s.place.rank}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Editable fields — match carousel preview styling */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Image Title
                      </label>
                      <span className="text-xs text-gray-400">
                        {editedTitle.length}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      placeholder="Enter title…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Caption
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {editedCaption.length}/600
                        </span>
                        <button
                          onClick={handleCopyCaption}
                          className="text-neutral-400 hover:text-neutral-700 transition"
                          title="Copy caption"
                        >
                          <IconCopy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={editedCaption}
                      onChange={(e) =>
                        setEditedCaption(e.target.value.slice(0, 600))
                      }
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent font-sans leading-relaxed transition"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadZip}
                    disabled={isDownloading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors"
                  >
                    {isDownloading ? (
                      <>
                        <svg
                          className="w-4 h-4 animate-spin"
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
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Packaging…
                      </>
                    ) : (
                      <>
                        <IconDownload className="w-4 h-4" />
                        Download ZIP
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    disabled={isScheduling}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {isScheduling ? "Scheduling…" : "Schedule on FB"}
                  </button>
                </div>

                {/* Meta line */}
                <div className="pt-3 border-t border-neutral-100 flex items-center gap-2 text-[11px] text-neutral-400 flex-wrap">
                  <span className="font-mono">
                    Search:{" "}
                    <span className="text-neutral-600">
                      {result.searchQuery}
                    </span>
                  </span>
                  <span>·</span>
                  <span className="font-mono">
                    Voice:{" "}
                    <span className="text-neutral-600">
                      {result.brandVoiceUsed}
                    </span>
                  </span>
                  <span>·</span>
                  <span className="font-mono">
                    Cache:{" "}
                    <span className="text-neutral-600">
                      {result.cached
                        ? `HIT ${result.cacheAgeSeconds}s`
                        : "MISS"}
                    </span>
                  </span>
                  <span>·</span>
                  <span className="font-mono">
                    {result.places.length} of {result.rawReturned} raw
                  </span>
                </div>
              </div>
            )}
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

        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
            >
              <IconX className="w-5 h-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="Food Places preview"
              className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </main>
  );
}
