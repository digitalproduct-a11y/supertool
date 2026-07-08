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
// template swaps the white backdrop for baked-in chrome (banner/header/footer),
// so the drawn header/footer chrome is skipped and content lives in the empty
// band between contentTop and the baked footer. Geometry is per-brand because
// each artwork's baked header/footer sit at different heights (fine-tune against
// the rendered image during verification).
export interface ElectionTemplate {
  url: string;
  contentTop: number; // content-start y, below the baked header
  contentBottom: number; // last usable y before the baked footer band
  footerY: number; // baseline for the drawn stats/stamp, above the baked footer
}

export const ELECTION_BG_TEMPLATES: Partial<Record<string, ElectionTemplate>> = {
  "Astro Awani": {
    url: "https://res.cloudinary.com/dymmqtqyg/image/upload/prn2026_johor_bg",
    contentTop: 384,
    contentBottom: 1150,
    footerY: 1180,
  },
  Hotspot: {
    url: "https://res.cloudinary.com/dymmqtqyg/image/upload/prn2026_johor_hotspot_bg",
    contentTop: 264,
    contentBottom: 1000,
    footerY: 1120,
  },
};

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
  hotspotStampSize: 38, // LIVE stamp size for the Hotspot cards
  // Baseline for the Hotspot LIVE stamp — aligned with the baked footer note
  // line ("**欲知…", glyphs ~1150–1170) so the stamp reads as its right-side
  // counterpart instead of floating above the footer band.
  hotspotStampY: 1185,
} as const;
