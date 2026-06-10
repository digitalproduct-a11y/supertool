import { useEffect, useMemo, useRef, useState } from "react";
import { GuideModal } from "../components/ds/GuideModal";
import { BackButton } from "../components/ds";
import { useProductFeed } from "../hooks/useProductFeed";
import { toast } from "../hooks/useToast";
import {
  addFeedFile,
  useFeedHistory,
  type FeedHistoryItem,
} from "../utils/productFeedHistory";
import {
  PARTNERS,
  COUNT_PRESETS,
  DEFAULT_COUNT,
  MAX_PER_MERCHANT,
  COMBINED_MAX,
} from "../constants/productFeedPartners";

const selectClass =
  "w-full px-3 py-2 pr-9 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer";

function triggerDownload(filename: string, url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function shortTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProductFeedGeneratorPage() {
  const { run, isLoading } = useProductFeed();
  const history = useFeedHistory();

  const [partnerId, setPartnerId] = useState(PARTNERS[0].id);
  const partner = useMemo(
    () => PARTNERS.find((p) => p.id === partnerId) ?? PARTNERS[0],
    [partnerId],
  );

  // merchant -> selected count (presence in the map = selected)
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Simulated progress (the webhook is a single synchronous call, so we ease a
  // bar toward an estimate based on the workload and snap to 100% on completion).
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const estimateRef = useRef(20);

  // Id of the file from the most recent successful generate (drives the green
  // "finished" highlight on its entry in the Files card).
  const [justDoneId, setJustDoneId] = useState<string | null>(null);

  const selectedMerchants = partner.merchants.filter((m) => m in counts);
  const total = selectedMerchants.reduce((sum, m) => sum + (counts[m] || 0), 0);
  const overCap = total > COMBINED_MAX;

  useEffect(() => {
    if (!isLoading) return;
    setProgress(0);
    setElapsed(0);
    const start = Date.now();
    const id = window.setInterval(() => {
      const secs = (Date.now() - start) / 1000;
      setElapsed(secs);
      // ease toward 95% over the estimate, never quite reaching 100 until done
      setProgress(Math.min(95, (secs / estimateRef.current) * 95));
    }, 150);
    return () => window.clearInterval(id);
  }, [isLoading]);

  const toggleMerchant = (merchant: string) => {
    setCounts((prev) => {
      const next = { ...prev };
      if (merchant in next) delete next[merchant];
      else next[merchant] = DEFAULT_COUNT;
      return next;
    });
  };

  const setCount = (merchant: string, value: number) => {
    setCounts((prev) => ({ ...prev, [merchant]: value }));
  };

  const handleGenerate = async () => {
    estimateRef.current = Math.max(12, Math.round(8 + total * 0.12));
    setJustDoneId(null);

    const selections = selectedMerchants.map((m) => ({
      merchant: m,
      limit: Math.min(
        Math.max(counts[m] || DEFAULT_COUNT, 1),
        MAX_PER_MERCHANT,
      ),
    }));
    const res = await run(partner.id, selections);

    if (res.success && res.url && res.filename) {
      setProgress(100);
      const id = addFeedFile({
        filename: res.filename,
        url: res.url,
        partner: partner.label,
        merchants: [...selectedMerchants],
        total,
      });
      setJustDoneId(id);
      triggerDownload(res.filename, res.url); // auto-download once; it also stays in the list below
      toast.success("Your Excel is ready");
    } else {
      toast.error(res.message || "Failed to generate feed");
    }
  };

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <BackButton />
              <div>
              <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
                Product Feed Generator
              </h1>
              <p className="text-neutral-500 mt-1 text-sm">
                Pull affiliate-ready products from a partner's merchants and get
                back one combined, CMS-tagged Excel file.
              </p>
              </div>
            </div>
            <GuideModal title="How to use the Product Feed Generator">
              <div className="space-y-4">
                <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-600">
                  <li>
                    Pick a <span className="font-semibold">partner</span>{" "}
                    (ChineseAN for now).
                  </li>
                  <li>
                    Tick the <span className="font-semibold">merchants</span>{" "}
                    you want — you can select several.
                  </li>
                  <li>
                    For each merchant, choose how many products to pull
                    (50/100/150/200 or a custom number).
                  </li>
                  <li>
                    Click <span className="font-semibold">Generate Excel</span>{" "}
                    — all merchants come back in one file, each row with the
                    product, affiliate link, price, and CMS tags.
                  </li>
                </ol>
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <p className="text-xs text-neutral-600">
                    Tip: keep the combined total at or below {COMBINED_MAX}{" "}
                    products so the file generates before the request times out.
                  </p>
                </div>
              </div>
            </GuideModal>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full animate-stripe-grow"
            style={{
              background:
                "linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)",
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: partner → merchants → generate */}
          <div className="lg:col-span-2 glass-card rounded-2xl">
          {/* Partner */}
          <div className="p-6">
            <label className="block text-sm font-semibold text-neutral-950 mb-2">
              Partner
            </label>
            <div className="relative max-w-sm">
              <select
                value={partnerId}
                onChange={(e) => {
                  setPartnerId(e.target.value);
                  setCounts({});
                }}
                className={selectClass}
              >
                {PARTNERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <svg
                className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  d="M6 9l6 6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Merchants + per-merchant count */}
          <div className="p-6 pt-0">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-950">
                Merchants
              </h2>
              <span className="text-xs text-neutral-500">
                {selectedMerchants.length} selected · {total} products
              </span>
            </div>

            <div className="space-y-3">
              {partner.merchants.map((merchant) => {
                const isSelected = merchant in counts;
                return (
                  <div
                    key={merchant}
                    className={`rounded-xl border transition-colors ${
                      isSelected
                        ? "border-neutral-300 bg-white"
                        : "border-neutral-200 bg-neutral-50/50"
                    }`}
                  >
                    <label className="flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMerchant(merchant)}
                        className="w-4 h-4 rounded border-neutral-300 accent-neutral-950 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-neutral-800">
                        {merchant}
                      </span>
                    </label>

                    {isSelected && (
                      <div className="px-4 pb-4 pt-1">
                        <p className="text-xs text-neutral-500 mb-2">
                          Number of products
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {COUNT_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setCount(merchant, preset)}
                              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                                counts[merchant] === preset
                                  ? "border-neutral-950 bg-neutral-950 text-white"
                                  : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={1}
                            max={MAX_PER_MERCHANT}
                            value={counts[merchant]}
                            onChange={(e) =>
                              setCount(
                                merchant,
                                Math.max(0, parseInt(e.target.value, 10) || 0),
                              )
                            }
                            placeholder="Custom"
                            className="w-24 px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer: warning + generate + progress */}
          <div className="p-6 space-y-4">
            {overCap && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-semibold text-yellow-800">
                  Large pull
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  {total} products is above the recommended {COMBINED_MAX}. The
                  feed may time out before the file is ready — consider lowering
                  the counts.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                onClick={handleGenerate}
                disabled={isLoading || selectedMerchants.length === 0}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? "Generating…" : "Generate Excel"}
              </button>

              {isLoading && (
                <div className="flex-1 min-w-0">
                  <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-150 ease-out"
                      style={{
                        width: `${progress}%`,
                        background:
                          "linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500 mt-1.5">
                    <span>Pulling &amp; tagging products…</span>
                    <span>
                      {Math.round(progress)}% · {Math.round(elapsed)}s
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Right: files generated this session */}
          <div className="lg:col-span-1 glass-card rounded-2xl p-5 lg:sticky lg:top-24">
            <h2 className="text-sm font-semibold text-neutral-950 mb-3">Files</h2>

            {history.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-10 h-10 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                  <svg
                    className="w-5 h-5 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V18a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-xs text-neutral-500">
                  Your generated files will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((item: FeedHistoryItem) => {
                  const success = item.id === justDoneId;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 ${
                        success
                          ? "border-green-200 bg-green-50 animate-fade-slide-up"
                          : "border-neutral-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            success ? "bg-green-100" : "bg-neutral-100"
                          }`}
                        >
                          {success ? (
                            <svg
                              className="w-4 h-4 text-green-600"
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
                          ) : (
                            <svg
                              className="w-4 h-4 text-neutral-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V18a2 2 0 01-2 2z"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-semibold truncate ${
                              success ? "text-green-900" : "text-neutral-800"
                            }`}
                          >
                            {success ? "Your Excel is ready" : item.filename}
                          </p>
                          <p
                            className={`text-xs truncate ${
                              success ? "text-green-700" : "text-neutral-500"
                            }`}
                          >
                            {success
                              ? item.filename
                              : `${shortTime(item.createdAt)} · ${item.total} products`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => triggerDownload(item.filename, item.url)}
                        className={`mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors active:scale-[0.98] ${
                          success
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-white border border-neutral-200 text-neutral-800 hover:border-neutral-400"
                        }`}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                          />
                        </svg>
                        Download
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
