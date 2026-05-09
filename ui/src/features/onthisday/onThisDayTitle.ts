// Helpers for the OnThisDay canvas — keep title transforms in one place so
// the page (which still shows the original) and the canvas (which shows the
// trimmed version) can't drift.

// Strip the "On This Day —" / "- " / "– " prefix the n8n parser prepends to
// every event. Tolerates extra whitespace and any common dash glyph.
const PREFIX_RE = /^\s*on this day\s*[—–-]\s*/i;

export function stripOnThisDayPrefix(title: string): string {
  return title.replace(PREFIX_RE, "").trim();
}

// Stopwords excluded when picking the highlight token. Kept small — the
// heuristic only needs to skip the most common "filler" words so the longest
// remaining noun-like word wins.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "with", "by", "from", "as", "is", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "his", "her", "their",
  "into", "over", "after", "before", "during", "between", "among", "off",
  "out", "up", "down", "than", "then", "so", "such", "had", "has", "have",
  "did", "does", "do", "will", "would", "can", "could", "may", "might",
]);

// Reduce a URL to its uppercase hostname (no protocol, no `www.`, no path).
// Used by the canvas footer's right-side url slot. Returns "" on bad input.
export function urlToHostnameLabel(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return "";
  }
}

// Heuristic fallback for highlight selection. Now superseded by the LLM-
// derived `highlightTerms` field on the event payload — only used when that
// field is missing/empty (e.g. cached responses from before LLM annotation).
//
// Pick a contiguous run of words to highlight in the (already-trimmed) title.
// Mirrors the source design where 3-4 adjacent words ("S. A. Ganapathy, the")
// share one solid accent block.
//
// Strategy:
//   1. Find the longest non-stopword (≥4 chars) — the "anchor" of the phrase.
//   2. Extend forward by `spanWords-1` tokens so the highlight reads as a noun
//      phrase rather than a single word.
//   3. Return the contiguous tokens in their original casing.
//
// Deterministic — same title always produces the same highlights, so the
// canvas re-renders idempotently while the user edits other fields.
export function pickHighlightTerms(title: string, spanWords = 3): string[] {
  const tokens = title.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  // Pick the index of the longest non-stopword token (≥4 chars). Ties broken
  // by earliest occurrence so the phrase reads naturally.
  let anchorIdx = -1;
  let anchorLen = 0;
  for (let i = 0; i < tokens.length; i++) {
    const bare = tokens[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (bare.length < 4) continue;
    if (STOPWORDS.has(bare.toLowerCase())) continue;
    if (bare.length > anchorLen) {
      anchorLen = bare.length;
      anchorIdx = i;
    }
  }
  if (anchorIdx === -1) return [];

  // Extend forward up to spanWords-1 tokens, but stop at end of sentence.
  const out: string[] = [tokens[anchorIdx]];
  for (let j = 1; j < spanWords && anchorIdx + j < tokens.length; j++) {
    const next = tokens[anchorIdx + j];
    out.push(next);
    if (/[.!?]$/.test(next)) break;
  }
  return out;
}

// Parse "DD/MM/YYYY" → { day, month, year }. Returns null on malformed input.
export function parseEventDate(
  date: string | null | undefined,
): { day: number; month: number; year: number } | null {
  if (!date) return null;
  const parts = date.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((n) => parseInt(n, 10));
  if (!dd || !mm || !yyyy || isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null;
  return { day: dd, month: mm, year: yyyy };
}

export const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;
