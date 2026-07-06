// Pure, React-free helpers for deriving views over the flat seat feed.
// Unit-testable in isolation.

import { getParty, getStateTotalSeats, seatsToGovern, type Party } from "../../constants/parties";
import type { Candidate, SeatResult } from "./types";

/** A seat is "declared" only once the result is official AND one of its
 *  candidates is marked the winner — no menang is declared until official. */
export function winnerOf(seat: SeatResult): Candidate | null {
  if (!seat.official_result) return null; // no menang until official
  return seat.candidates.find((c) => c.status === "win") ?? null;
}

export function isDeclared(seat: SeatResult): boolean {
  return winnerOf(seat) !== null;
}

/** Candidates sorted by votes descending (highest first). */
export function rankedCandidates(seat: SeatResult): Candidate[] {
  return [...seat.candidates].sort((a, b) => b.vote - a.vote);
}

export interface CoalitionTally {
  partyId: number;
  party: Party;
  seats: number;
}

/**
 * Count declared seats grouped by the winning candidate's party id, sorted by
 * seat count descending. Only seats with a declared winner contribute.
 */
export function tallyByParty(seats: SeatResult[]): CoalitionTally[] {
  const counts = new Map<number, number>();
  for (const seat of seats) {
    const w = winnerOf(seat);
    if (!w) continue;
    counts.set(w.party, (counts.get(w.party) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([partyId, n]) => ({ partyId, party: getParty(partyId), seats: n }))
    .sort((a, b) => b.seats - a.seats || a.partyId - b.partyId);
}

export function declaredCount(seats: SeatResult[]): number {
  return seats.reduce((n, s) => n + (isDeclared(s) ? 1 : 0), 0);
}

/** The party leading the tally, or null if nothing is declared yet. */
export function leader(tally: CoalitionTally[]): CoalitionTally | null {
  return tally[0] ?? null;
}

export interface StateSummary {
  state: string;
  seats: SeatResult[];
  tally: CoalitionTally[];
  declared: number;
  totalSeats: number | undefined;
  toGovern: number | undefined;
  leader: CoalitionTally | null;
}

/** Group seats by state and compute each state's derived summary. */
export function summarizeByState(seats: SeatResult[]): StateSummary[] {
  const byState = new Map<string, SeatResult[]>();
  for (const seat of seats) {
    const list = byState.get(seat.state);
    if (list) list.push(seat);
    else byState.set(seat.state, [seat]);
  }
  return Array.from(byState.entries())
    .map(([state, stateSeats]) => buildStateSummary(state, stateSeats))
    .sort((a, b) => a.state.localeCompare(b.state));
}

export function buildStateSummary(state: string, seats: SeatResult[]): StateSummary {
  const tally = tallyByParty(seats);
  const totalSeats = getStateTotalSeats(state);
  return {
    state,
    seats,
    tally,
    declared: declaredCount(seats),
    totalSeats,
    toGovern: totalSeats != null ? seatsToGovern(totalSeats) : undefined,
    leader: leader(tally),
  };
}

export function listStates(seats: SeatResult[]): string[] {
  return Array.from(new Set(seats.map((s) => s.state))).sort((a, b) => a.localeCompare(b));
}

export interface SeatFilter {
  state?: string;
  /** true = official (Rasmi), false = unofficial (Tidak Rasmi). Omit for both. */
  official?: boolean;
  heavyweight?: boolean;
  q?: string;
}

/**
 * Filter seats by state, official-result flag, heavyweight flag and a free-text
 * query (matches seat id, seat name, parliament name, or candidate name).
 */
export function filterSeats(seats: SeatResult[], f: SeatFilter): SeatResult[] {
  const q = f.q?.trim().toLowerCase();
  return seats.filter((seat) => {
    if (f.state && seat.state !== f.state) return false;
    if (f.heavyweight && seat.is_heavyweight !== 1) return false;
    if (f.official !== undefined && seat.official_result !== f.official) return false;

    if (q) {
      const haystack = [
        seat.seat_id,
        seat.seat_name,
        seat.parliament?.name ?? "",
        seat.parliament?.seat ?? "",
        ...seat.candidates.map((c) => c.name),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Voter turnout as a 0–100 percentage (total votes / registered voters). */
export function turnoutPct(seat: SeatResult): number | null {
  if (!seat.registered_voters) return null;
  const cast = seat.candidates.reduce((n, c) => n + c.vote, 0) + (seat.rejected_votes ?? 0);
  return Math.round((cast / seat.registered_voters) * 1000) / 10;
}

/** Total votes cast across all candidates (excludes rejected votes). */
export function totalVotes(seat: SeatResult): number {
  return seat.candidates.reduce((n, c) => n + c.vote, 0);
}

/** Current lead of the top candidate over the runner-up, from live votes. */
export function liveMargin(seat: SeatResult): number {
  const ranked = rankedCandidates(seat);
  return (ranked[0]?.vote ?? 0) - (ranked[1]?.vote ?? 0);
}

/**
 * Sort seats by momentum so the most relevant rows surface first.
 * - Rasmi (official): biggest majority first.
 * - Tidak Rasmi (unofficial): seats with votes in (leading) first, ordered by
 *   current lead; seats with no votes yet ("Belum") last, ordered by seat id.
 */
export function sortSeatsByMomentum(seats: SeatResult[], official: boolean): SeatResult[] {
  const sorted = [...seats];
  if (official) {
    sorted.sort((a, b) => (b.majority || liveMargin(b)) - (a.majority || liveMargin(a)));
  } else {
    sorted.sort((a, b) => {
      const aHas = totalVotes(a) > 0 ? 1 : 0;
      const bHas = totalVotes(b) > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (aHas === 1) return liveMargin(b) - liveMargin(a);
      return a.seat_id.localeCompare(b.seat_id);
    });
  }
  return sorted;
}
