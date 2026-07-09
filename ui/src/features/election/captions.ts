// Editable caption templates per card type. The editor can tweak the result
// before posting; these just give a sensible, on-brand starting point. BM by
// default; the Hotspot brand (热点) gets Chinese captions. Every caption ends
// with the Johor PRN hub link.

import { getParty } from "../../constants/parties";
import { rankedCandidates, winnerOf, type StateSummary } from "./electionAggregate";
import { isHotspot } from "./electionLabels";
import { zhCandidate, zhSeatName, zhState } from "./hotspotNames";
import { partyZh } from "./partyZh";
import type { SeatResult } from "./types";

const HUB_URL = "https://pru.astroawani.com/prn-johor-2026/hub";

function fmt(n: number): string {
  return n.toLocaleString("en-MY");
}

/** Append the Johor PRN hub link to every caption (both languages). */
function withHub(body: string, zh: boolean): string {
  const label = zh ? "完整成绩" : "Keputusan penuh";
  return `${body}\n\n${label}: ${HUB_URL}`;
}

export function seatCaption(seat: SeatResult, brand: string): string {
  const zh = isHotspot(brand);
  const w = winnerOf(seat);

  if (zh) {
    const state = zhState(seat.state) ?? seat.state;
    const seatName = zhSeatName(seat.seat_id) ?? seat.seat_name;
    if (!w) {
      const top = rankedCandidates(seat)[0];
      const tc = top ? zhCandidate(seat.seat_id, top.name) : null;
      const party = tc?.partyZh ?? (top ? partyZh(top.party) : null);
      const lead = top ? ` ${tc?.zh ?? top.name}（${party ?? getParty(top.party).abbreviation}）暂时领先。` : "";
      return withHub(`${state}州选成绩：${seat.seat_id} - ${seatName} 州议席非正式成绩:${lead}`, true);
    }
    const wc = zhCandidate(seat.seat_id, w.name);
    const party = wc?.partyZh ?? partyZh(w.party) ?? getParty(w.party).abbreviation;
    return withHub(
      [`${state}州选成绩`, "", `${wc?.zh ?? w.name}（${party}）以多数票 ${fmt(seat.majority)} 张胜出 ${seat.seat_id} - ${seatName} 州议席。`].join("\n"),
      true,
    );
  }

  const state = seat.state.toUpperCase();
  if (!w) {
    const top = rankedCandidates(seat)[0];
    const lead = top ? ` ${top.name} (${getParty(top.party).abbreviation}) mendahului.` : "";
    return withHub(`KEPUTUSAN PRN ${state}: Kerusi ${seat.seat_id} ${seat.seat_name} belum diisytihar.${lead}`, false);
  }
  const party = getParty(w.party);
  return withHub(
    [`KEPUTUSAN PRN ${state}`, "", `${w.name} (${party.abbreviation}) menang kerusi ${seat.seat_id} ${seat.seat_name} dengan majoriti ${fmt(seat.majority)} undi.`].join("\n"),
    false,
  );
}

export function scoreboardCaption(summary: StateSummary, brand: string): string {
  const zh = isHotspot(brand);
  const lead = summary.leader;

  if (zh) {
    const state = zhState(summary.state) ?? summary.state;
    const head = `${state}州选最新成绩`;
    const tallyLine = summary.tally
      .filter((t) => t.seats > 0)
      .map((t) => `${partyZh(t.partyId) ?? t.party.abbreviation} ${t.seats}`)
      .join(" · ");
    const declared =
      summary.totalSeats != null
        ? `${summary.declared}/${summary.totalSeats} 议席已宣布。`
        : `目前 ${summary.declared} 席已宣布。`;
    const leadLine = lead ? `${partyZh(lead.partyId) ?? lead.party.abbreviation} 以 ${lead.seats} 席领先。` : "";
    return withHub([head, "", tallyLine, "", declared, leadLine].filter(Boolean).join("\n"), true);
  }

  const head = `KEPUTUSAN TERKINI PRN ${summary.state.toUpperCase()}`;
  const tallyLine = summary.tally
    .filter((t) => t.seats > 0)
    .map((t) => `${t.party.abbreviation} ${t.seats}`)
    .join(" · ");
  const declared =
    summary.totalSeats != null
      ? `${summary.declared}/${summary.totalSeats} kerusi diisytihar.`
      : `${summary.declared} kerusi diisytihar setakat ini.`;
  const leadLine = lead ? `${lead.party.abbreviation} mendahului dengan ${lead.seats} kerusi.` : "";
  return withHub([head, "", tallyLine, "", declared, leadLine].filter(Boolean).join("\n"), false);
}

export function heavyweightCaption(seat: SeatResult, brand: string): string {
  const zh = isHotspot(brand);
  const ranked = rankedCandidates(seat);
  const w = winnerOf(seat);

  if (zh) {
    const state = zhState(seat.state) ?? seat.state;
    const seatName = zhSeatName(seat.seat_id) ?? seat.seat_name;
    if (w) {
      const wc = zhCandidate(seat.seat_id, w.name);
      const party = wc?.partyZh ?? partyZh(w.party) ?? getParty(w.party).abbreviation;
      return withHub(
        [`焦点议席 · ${state}`, "", `${wc?.zh ?? w.name}（${party}）以多数票 ${fmt(seat.majority)} 张胜出 ${seat.seat_id} - ${seatName}。`].join("\n"),
        true,
      );
    }
    const [a, b] = ranked;
    const pair = [a, b]
      .filter(Boolean)
      .map((c) => {
        const cc = zhCandidate(seat.seat_id, c.name);
        return `${cc?.zh ?? c.name}（${cc?.partyZh ?? partyZh(c.party) ?? getParty(c.party).abbreviation}）`;
      })
      .join(" 对垒 ");
    return withHub(`非正式成绩:\n\n${seat.seat_id} - ${seatName}：${pair}。`, true);
  }

  if (w) {
    const party = getParty(w.party);
    return withHub(
      [`KERUSI UTAMA · ${seat.state.toUpperCase()}`, "", `${w.name} (${party.abbreviation}) menang ${seat.seat_id} ${seat.seat_name} dengan majoriti ${fmt(seat.majority)} undi.`].join("\n"),
      false,
    );
  }
  const [a, b] = ranked;
  const pair = [a, b]
    .filter(Boolean)
    .map((c) => `${c.name} (${getParty(c.party).abbreviation})`)
    .join(" lawan ");
  return withHub(`KERUSI UTAMA · ${seat.state.toUpperCase()}\n\n${seat.seat_id} ${seat.seat_name}: ${pair}.`, false);
}
