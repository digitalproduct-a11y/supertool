// Shared layout + palette constants for the three Election result cards
// (single-seat, scoreboard, heavyweight). All cards are 1080×1350 (FB 4:5),
// rendered with Fabric.js. Brand logo + brand hex accent come from
// constants/brands.ts; party/coalition colours from constants/parties.ts.

export const ELECTION_CANVAS = {
  width: 1080,
  height: 1350,
  bg: "#0b1020", // deep navy "results night" backdrop
  surface: "#141b33",
  surfaceAlt: "#1b2444",
  stroke: "rgba(255,255,255,0.08)",
  text: "#f4f6fb",
  textMuted: "#9aa6c4",
  textFaint: "#6b779a",
  win: "#ffd24a", // winner accent (gold)
  font: "Inter",
  paddingX: 72,
} as const;

export const ELECTION_HEADER = {
  paddingTop: 64,
  logoWidth: 132,
  eyebrowSize: 22,
  eyebrowSpacing: 4,
} as const;

export const ELECTION_FOOTER = {
  bottomOffset: 64,
  size: 20,
} as const;
