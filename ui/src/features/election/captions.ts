// Editable BM caption templates per card type. The editor can tweak the result
// before posting; these just give a sensible, on-brand starting point.

import { getParty } from "../../constants/parties";
import { rankedCandidates, winnerOf, type StateSummary } from "./electionAggregate";
import type { SeatResult } from "./types";

function fmt(n: number): string {
  return n.toLocaleString("en-MY");
}

export function seatCaption(seat: SeatResult): string {
  const w = winnerOf(seat);
  if (!w) {
    const top = rankedCandidates(seat)[0];
    const lead = top ? ` ${top.name} (${getParty(top.party).abbreviation}) mendahului.` : "";
    return `KEPUTUSAN PRN ${seat.state.toUpperCase()}: Kerusi ${seat.seat_id} ${seat.seat_name} belum diisytihar.${lead}`;
  }
  const party = getParty(w.party);
  return [
    `KEPUTUSAN PRN ${seat.state.toUpperCase()}`,
    "",
    `${w.name} (${party.abbreviation}) menang kerusi ${seat.seat_id} ${seat.seat_name} dengan majoriti ${fmt(seat.majority)} undi.`,
  ].join("\n");
}

export function scoreboardCaption(summary: StateSummary): string {
  const lead = summary.leader;
  const head = `KEPUTUSAN TERKINI PRN ${summary.state.toUpperCase()}`;
  const tallyLine = summary.tally
    .slice(0, 5)
    .map((t) => `${t.party.abbreviation} ${t.seats}`)
    .join(" · ");
  const declared =
    summary.totalSeats != null
      ? `${summary.declared}/${summary.totalSeats} kerusi diisytihar.`
      : `${summary.declared} kerusi diisytihar setakat ini.`;
  const leadLine = lead ? `${lead.party.abbreviation} mendahului dengan ${lead.seats} kerusi.` : "";
  return [head, "", tallyLine, "", declared, leadLine].filter(Boolean).join("\n");
}

export function heavyweightCaption(seat: SeatResult): string {
  const ranked = rankedCandidates(seat);
  const w = winnerOf(seat);
  if (w) {
    const party = getParty(w.party);
    return [
      `KERUSI UTAMA · ${seat.state.toUpperCase()}`,
      "",
      `${w.name} (${party.abbreviation}) menang ${seat.seat_id} ${seat.seat_name} dengan majoriti ${fmt(seat.majority)} undi.`,
    ].join("\n");
  }
  const [a, b] = ranked;
  const pair = [a, b]
    .filter(Boolean)
    .map((c) => `${c.name} (${getParty(c.party).abbreviation})`)
    .join(" lawan ");
  return `KERUSI UTAMA · ${seat.state.toUpperCase()}\n\n${seat.seat_id} ${seat.seat_name}: ${pair}.`;
}
