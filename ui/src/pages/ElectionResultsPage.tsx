import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconBrandFacebook, IconChevronLeft, IconDownload, IconX } from "@tabler/icons-react";
import { useBrand } from "../context/BrandContext";
import { useBrandNavigate } from "../hooks/useBrandNavigate";
import { BRANDS } from "../constants/brands";
import { trackButtonClick } from "../utils/analytics";
import { toast } from "../hooks/useToast";
import { Spinner } from "../components/ds/Spinner";
import { ScheduleModal } from "../components/ScheduleModal";
import { clearCredentials, getCredentials, saveCredentials } from "../utils/fbCredentials";
import { useElectionResults } from "../hooks/useElectionResults";
import { useElectionImageUpload } from "../hooks/useElectionImageUpload";
import { ElectionDashboard } from "../features/election/ElectionDashboard";
import { SeatResultCanvas } from "../features/election/SeatResultCanvas";
import { ScoreboardCanvas } from "../features/election/ScoreboardCanvas";
import { HeavyweightCanvas } from "../features/election/HeavyweightCanvas";
import { buildStateSummary, type StateSummary } from "../features/election/electionAggregate";
import { heavyweightCaption, scoreboardCaption, seatCaption } from "../features/election/captions";
import { isHotspot } from "../features/election/electionLabels";
import type { ElectionCanvasHandle } from "../features/election/canvasShared";
import type { SeatResult } from "../features/election/types";

type Composer =
  | { kind: "seat"; seat: SeatResult }
  | { kind: "heavyweight"; seat: SeatResult }
  | { kind: "scoreboard"; summary: StateSummary };

const DEFAULT_BRAND = "Astro Awani";

export function ElectionResultsPage() {
  const navigate = useNavigate();
  const brandNavigate = useBrandNavigate();
  const { selectedBrand: globalBrand, isAdmin } = useBrand();
  const [brand, setBrand] = useState<string>(!isAdmin && globalBrand ? globalBrand : DEFAULT_BRAND);

  const { seats, lastUpdated, isLive, isLoading, error, refresh } = useElectionResults();

  const [composer, setComposer] = useState<Composer | null>(null);
  const [caption, setCaption] = useState("");
  const canvasRef = useRef<ElectionCanvasHandle>(null);
  const { upload: uploadCanvas } = useElectionImageUpload();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  // Election Results is restricted to admin users or the Astro Awani / Hotspot brands.
  const allowed = isAdmin || globalBrand === "Astro Awani" || globalBrand === "Hotspot";
  useEffect(() => {
    if (!allowed) brandNavigate("/home", { replace: true });
  }, [allowed, brandNavigate]);

  function openSeat(seat: SeatResult) {
    setScheduled(false);
    setComposer({ kind: "seat", seat });
    setCaption(seatCaption(seat, brand));
  }
  function openHeavyweight(seat: SeatResult) {
    setScheduled(false);
    setComposer({ kind: "heavyweight", seat });
    setCaption(heavyweightCaption(seat, brand));
  }
  function openScoreboard(state: string) {
    setScheduled(false);
    const summary = buildStateSummary(state, seats.filter((s) => s.state === state));
    setComposer({ kind: "scoreboard", summary });
    setCaption(scoreboardCaption(summary, brand));
  }
  function closeComposer() {
    setComposer(null);
  }

  // Upload the rendered card to Cloudinary, then POST to the FB draft/schedule
  // webhook (same flow as Did You Know). Mirrors payload shape used app-wide.
  async function handleScheduleOnFB(scheduledFor: string, passcode?: string) {
    const dataUrl = canvasRef.current?.getDataUrl();
    if (!dataUrl) {
      toast.error("Preview not ready");
      return;
    }
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim();
    if (!webhookUrl) {
      toast.error("Schedule webhook not configured");
      return;
    }
    const brandLower = brand.toLowerCase();
    const resolvedPasscode = passcode ?? getCredentials(brandLower)?.passcode;
    if (!resolvedPasscode) {
      toast.error("Passcode required");
      setShowScheduleModal(true);
      return;
    }

    setIsScheduling(true);
    try {
      const imageUrl = await uploadCanvas(dataUrl);
      const payload = {
        fb_ai_image_url: imageUrl,
        fb_ai_caption: caption,
        brand: brandLower,
        passcode: resolvedPasscode,
        scheduled_for: scheduledFor,
      };
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (data.status === "AUTH_ERROR") {
        clearCredentials(brandLower);
        toast.error("Authentication failed. Please try again.");
        setShowScheduleModal(true);
        return;
      }
      if (data.status === "BRAND_ERROR") {
        toast.error(data.message || "Brand not permitted.");
        return;
      }
      if (data.success || data.status === "SUCCESS" || data.status === "DRAFT_SAVED") {
        saveCredentials(brandLower, resolvedPasscode);
        toast.success("Scheduled on Facebook!");
        setScheduled(true);
        return;
      }
      toast.error(data.message || "Failed to schedule post");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule post");
    } finally {
      setIsScheduling(false);
    }
  }

  function filenameFor(c: Composer): string {
    if (c.kind === "scoreboard") return `prn-scoreboard-${c.summary.state}`;
    return `prn-${c.kind === "heavyweight" ? "utama-" : ""}${c.seat.seat_id}-${c.seat.seat_name}`;
  }

  function handleBack() {
    if (window.history.length > 1) navigate(-1);
    else brandNavigate("/home");
  }

  if (!allowed) return null;

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
              State Election Results
            </h1>
          </div>
          <p className="text-neutral-500 text-sm">
            Live PRN results — monitor seats and publish branded result posts.
          </p>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{ background: "linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)" }}
          />
        </div>

        {/* Brand selector (admin / no global brand) */}
        {(isAdmin || !globalBrand) && (
          <div className="mb-5 max-w-xs">
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Posting as brand</label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dashboard / states */}
        {isLoading && seats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-neutral-400">Loading live results…</p>
          </div>
        ) : error && seats.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button
              onClick={refresh}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 transition"
            >
              Try again
            </button>
          </div>
        ) : (
          <ElectionDashboard
            seats={seats}
            lastUpdated={lastUpdated}
            isLive={isLive}
            onRefresh={refresh}
            onGenerateScoreboard={openScoreboard}
            onGenerateSeat={openSeat}
            onGenerateHeavyweight={openHeavyweight}
          />
        )}
      </div>

      {/* Composer modal */}
      {composer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 md:p-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h2 className="font-semibold text-neutral-950">
                {composer.kind === "scoreboard"
                  ? `Scoreboard — DUN ${composer.summary.state}`
                  : composer.kind === "heavyweight"
                    ? `Kerusi Utama — ${composer.seat.seat_id} ${composer.seat.seat_name}`
                    : `${composer.seat.seat_id} ${composer.seat.seat_name}`}
              </h2>
              <button onClick={closeComposer} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition">
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* Preview */}
              <div className="flex flex-col items-center">
                {composer.kind === "seat" && <SeatResultCanvas ref={canvasRef} seat={composer.seat} brand={brand} />}
                {composer.kind === "heavyweight" && (
                  <HeavyweightCanvas ref={canvasRef} seat={composer.seat} brand={brand} />
                )}
                {composer.kind === "scoreboard" && (
                  <ScoreboardCanvas ref={canvasRef} summary={composer.summary} brand={brand} lastUpdated={lastUpdated} />
                )}
              </div>

              {/* Controls */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Caption</label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                  />
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      trackButtonClick("download_image");
                      canvasRef.current?.downloadAsPng(filenameFor(composer).toLowerCase());
                    }}
                    className="w-full px-4 py-3 border border-neutral-200 hover:bg-neutral-50 text-neutral-950 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <IconDownload className="w-4 h-4" />
                    Download
                  </button>

                  {isHotspot(brand) && (
                    <>
                      <button
                        onClick={() => {
                          trackButtonClick("election_schedule_fb");
                          setShowScheduleModal(true);
                        }}
                        disabled={isScheduling}
                        className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        {isScheduling ? (
                          <Spinner size="sm" />
                        ) : (
                          <>
                            <IconBrandFacebook className="w-4 h-4" />
                            Schedule on FB
                          </>
                        )}
                      </button>
                      {scheduled && (
                        <p className="text-xs font-medium text-green-600 text-center">
                          Scheduled on Facebook!{" "}
                          <a href="/post-queue" className="underline hover:text-green-700">
                            View queue
                          </a>
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <ScheduleModal
          brand={brand}
          hasCredentials={!!getCredentials(brand.toLowerCase())}
          isPosting={isScheduling}
          onClose={() => setShowScheduleModal(false)}
          onConfirm={async (scheduledFor, passcode) => {
            setShowScheduleModal(false);
            await handleScheduleOnFB(scheduledFor, passcode);
          }}
        />
      )}
    </main>
  );
}
