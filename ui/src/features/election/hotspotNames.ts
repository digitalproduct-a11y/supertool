// Chinese seat / candidate / party names for the Hotspot Johor 2026 template.
// Data generated from 柔佛州选候选人名单.xlsx into data/johorHotspotNames.json,
// keyed by seat id (N1–N56). The live feed references candidates by Malay name,
// so we match on a normalized form (indexing the parenthetical alias too, since
// the feed often uses it, e.g. "NAJIB LEP" for "Kapten Najib（Najib Lep）").

import namesData from "./data/johorHotspotNames.json";

interface HotspotCandidate {
  ms: string[]; // Malay name variants (primary + parenthetical alias)
  zh: string; // Chinese candidate name
  coalitionZh: string; // Chinese coalition (国阵 / 希盟 / 国盟 / …)
  partyZh: string; // Chinese component party (巫统 / 行动党 / …); == coalition when none
}
interface HotspotSeat {
  seatZh: string;
  candidates: HotspotCandidate[];
}

const DATA = namesData as Record<string, HotspotSeat>;

/** Normalize a Malay name for matching: lowercase, drop brackets/punctuation. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[（）()]/g, " ")
    .replace(/['’`.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonicalize a feed seat id to the JSON key form: strip zero-padding
 *  ("N03" → "N3"); ids already unpadded ("N11") pass through unchanged. The
 *  live feed pads to two digits (N01–N09) while the table is keyed N1–N9. */
function seatKey(seatId: string): string {
  const m = /^([A-Za-z]+)0*(\d+)$/.exec(seatId.trim());
  return m ? `${m[1].toUpperCase()}${m[2]}` : seatId.trim();
}

/** Chinese seat name for a seat id, or null if unknown. */
export function zhSeatName(seatId: string): string | null {
  return DATA[seatKey(seatId)]?.seatZh || null;
}

export interface ZhCandidate {
  zh: string;
  coalitionZh: string;
  partyZh: string;
}

/** Match a feed candidate (Malay name) to its Chinese entry within a seat. */
export function zhCandidate(seatId: string, feedName: string): ZhCandidate | null {
  const seat = DATA[seatKey(seatId)];
  if (!seat) return null;
  const key = norm(feedName);
  if (!key) return null;
  // Exact normalized match on any Malay variant.
  for (const c of seat.candidates) {
    if (c.ms.some((m) => norm(m) === key)) {
      return { zh: c.zh, coalitionZh: c.coalitionZh, partyZh: c.partyZh };
    }
  }
  // Prefix/containment fallback (guards against short false positives).
  for (const c of seat.candidates) {
    if (
      c.ms.some((m) => {
        const nm = norm(m);
        return nm.length > 5 && key.length > 5 && (nm.startsWith(key) || key.startsWith(nm));
      })
    ) {
      return { zh: c.zh, coalitionZh: c.coalitionZh, partyZh: c.partyZh };
    }
  }
  return null;
}

/** Chinese state name for the scoreboard headline (only Johor for now). */
const STATE_ZH: Record<string, string> = { Johor: "柔佛" };
export function zhState(state: string): string | null {
  return STATE_ZH[state] ?? null;
}
