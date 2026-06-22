import { useMemo, useState } from "react";
import { IconRefresh, IconSearch, IconChevronRight, IconStar } from "@tabler/icons-react";
import { safePartyColor, getParty } from "../../constants/parties";
import {
  buildStateSummary,
  filterSeats,
  listStates,
  rankedCandidates,
  winnerOf,
  type SeatStatusFilter,
} from "./electionAggregate";
import type { SeatResult } from "./types";

interface Props {
  seats: SeatResult[];
  lastUpdated: number | null;
  isLive: boolean;
  onRefresh: () => void;
  onGenerateScoreboard: (state: string) => void;
  onGenerateSeat: (seat: SeatResult) => void;
  onGenerateHeavyweight: (seat: SeatResult) => void;
}

const STATUS_CHIPS: { id: SeatStatusFilter | "heavyweight"; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "won", label: "Menang" },
  { id: "leading", label: "Mendahului" },
  { id: "pending", label: "Belum" },
  { id: "heavyweight", label: "★ Utama" },
];

function timeAgo(ts: number | null): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s lalu`;
  return `${Math.round(s / 60)}m lalu`;
}

export function ElectionDashboard({
  seats,
  lastUpdated,
  isLive,
  onRefresh,
  onGenerateScoreboard,
  onGenerateSeat,
  onGenerateHeavyweight,
}: Props) {
  const states = useMemo(() => listStates(seats), [seats]);
  const [state, setState] = useState<string>(states[0] ?? "");
  const effectiveState = states.includes(state) ? state : states[0] ?? "";
  const [chip, setChip] = useState<SeatStatusFilter | "heavyweight">("all");
  const [q, setQ] = useState("");

  const stateSeats = useMemo(
    () => seats.filter((s) => s.state === effectiveState),
    [seats, effectiveState],
  );
  const summary = useMemo(
    () => buildStateSummary(effectiveState, stateSeats),
    [effectiveState, stateSeats],
  );
  const visibleSeats = useMemo(
    () =>
      filterSeats(stateSeats, {
        status: chip === "heavyweight" ? "all" : chip,
        heavyweight: chip === "heavyweight",
        q,
      }),
    [stateSeats, chip, q],
  );

  const maxSeats = Math.max(1, ...summary.tally.map((t) => t.seats));

  return (
    <div className="space-y-5">
      {/* Sticky scoreboard header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <select
              value={effectiveState}
              onChange={(e) => setState(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              {states.map((s) => (
                <option key={s} value={s}>
                  DUN {s}
                </option>
              ))}
            </select>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <span className={`w-2 h-2 rounded-full ${isLive ? "bg-green-500 animate-pulse" : "bg-neutral-300"}`} />
              {isLive ? "LIVE" : "Tiada sambungan"} · {timeAgo(lastUpdated)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition text-neutral-600"
              title="Refresh now"
            >
              <IconRefresh className="w-4 h-4" />
            </button>
            <button
              onClick={() => onGenerateScoreboard(effectiveState)}
              className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition active:scale-[0.98]"
            >
              Generate scoreboard
            </button>
          </div>
        </div>

        {/* Tally bars */}
        <div className="space-y-2">
          {summary.tally.slice(0, 6).map((t) => {
            const color = safePartyColor(t.party.color);
            return (
              <div key={t.partyId} className="flex items-center gap-3">
                <span className="w-16 text-xs font-bold uppercase" style={{ color }}>
                  {t.party.abbreviation}
                </span>
                <div className="flex-1 h-5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(t.seats / maxSeats) * 100}%`, background: color }}
                  />
                </div>
                <span className="w-8 text-sm font-bold text-neutral-900 text-right">{t.seats}</span>
              </div>
            );
          })}
          {summary.tally.length === 0 && (
            <p className="text-sm text-neutral-400">Tiada keputusan diisytihar lagi.</p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>
            {summary.totalSeats != null
              ? `${summary.declared}/${summary.totalSeats} kerusi diisytihar`
              : `${summary.declared} kerusi diisytihar`}
            {summary.toGovern != null ? ` · ${summary.toGovern} untuk kerajaan` : ""}
          </span>
          {summary.leader && (
            <span className="font-semibold text-neutral-800">
              {summary.leader.party.abbreviation} mendahului
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.id}
            onClick={() => setChip(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              chip === c.id
                ? "bg-neutral-950 text-white"
                : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {c.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <IconSearch className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kerusi / calon"
            className="pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 w-56"
          />
        </div>
      </div>

      {/* Seat rows */}
      <div className="space-y-2">
        {visibleSeats.map((seat) => {
          const w = winnerOf(seat);
          const top = rankedCandidates(seat)[0];
          const shown = w ?? top;
          const party = shown ? getParty(shown.party) : null;
          const color = party ? safePartyColor(party.color) : "#9ca3af";
          return (
            <div
              key={`${seat.state}-${seat.seat_id}`}
              className="group flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-4 py-3 hover:border-neutral-300 transition"
            >
              <span className="w-1.5 h-10 rounded-full shrink-0" style={{ background: color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-900">
                    {seat.seat_id} {seat.seat_name}
                  </span>
                  {seat.is_heavyweight === 1 && (
                    <IconStar className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  )}
                </div>
                <p className="text-xs text-neutral-500 truncate">
                  {w ? (
                    <>
                      <span className="font-medium text-neutral-700">{w.name}</span> ({party?.abbreviation}) menang ·
                      majoriti {seat.majority.toLocaleString("en-MY")}
                    </>
                  ) : top && top.vote > 0 ? (
                    <>{top.name} ({party?.abbreviation}) mendahului</>
                  ) : (
                    "Belum keputusan"
                  )}
                </p>
              </div>
              {seat.is_heavyweight === 1 && (
                <button
                  onClick={() => onGenerateHeavyweight(seat)}
                  className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
                >
                  Utama
                </button>
              )}
              <button
                onClick={() => onGenerateSeat(seat)}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition active:scale-[0.98]"
              >
                Generate <IconChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        {visibleSeats.length === 0 && (
          <div className="text-center py-12 text-sm text-neutral-400">Tiada kerusi sepadan.</div>
        )}
      </div>
    </div>
  );
}
