// Shared layout + palette constants for the three Election result cards
// (single-seat, scoreboard, heavyweight). All cards are 1080×1350 (FB 4:5),
// rendered with Fabric.js. Editorial "warm paper" theme: cream bg, ink text,
// gold accent, black rules. Astro Awani logo comes from constants/brands.ts;
// party/coalition colours from constants/parties.ts.

export const ELECTION_CANVAS = {
  width: 1080,
  height: 1350,
  bg: "#ffffff", // pure white backdrop
  surface: "#e7e3da", // light gray (scoreboard bar track)
  surfaceAlt: "#eeeae1",
  stroke: "rgba(0,0,0,0.12)", // hairline section dividers
  text: "#1a1a1a", // ink
  textMuted: "#8a857c", // warm muted gray
  textFaint: "#b0aaa0", // warm faint gray
  win: "#c19a6b", // gold accent (reused where a highlight is needed)
  font: "Inter",
  paddingX: 72,
} as const;

export const ELECTION_ACCENT = "#c19a6b"; // gold eyebrow + status dot
export const ELECTION_RULE = "#1a1a1a"; // black header/footer rule
export const MEMILIH_BADGE_URL = "/prn2026-johor-memilih.png";

// Full-canvas background templates (1080×1350) keyed by brand. A brand with a
// template swaps the white backdrop for baked-in chrome (banner, badge, footer,
// logo), so the drawn header/footer chrome is skipped for it.
export const ELECTION_BG_TEMPLATES: Partial<Record<string, string>> = {
  "Astro Awani": "/prn2026-johor-bg.png",
};

// For templated brands, drawn content lives in the empty band between the baked
// header banner and the baked footer. Values are starting points — fine-tune
// against the rendered image during verification.
export const ELECTION_TEMPLATE = {
  contentTop: 384, // content-start y, below the baked banner + flag/pole (bottom ≈348)
  contentBottom: 1150, // last usable y before the baked footer band
  footerY: 1180, // baseline for the repositioned live stamp/stats
} as const;

export const ELECTION_HEADER = {
  paddingTop: 64,
  logoWidth: 132,
  badgeWidth: 200,
  eyebrowSize: 22,
  eyebrowSpacing: 4,
} as const;

export const ELECTION_FOOTER = {
  bottomOffset: 64,
  size: 20,
} as const;
