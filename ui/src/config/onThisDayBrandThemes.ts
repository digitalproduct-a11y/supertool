// Per-brand color themes for the OnThisDay canvas.
//
// Layout/typography (positions, font sizes, weights, letter-spacing) lives in
// `onThisDayCanvasConfig.ts`. This file only owns colors.
//
// To brand a new canvas: add an entry to BRAND_ONTHISDAY_THEMES below. Keys
// must match the canonical brand name used in BRAND_HEX (constants/brands.ts).
// Only list properties that differ from DEFAULT_ONTHISDAY_THEME — everything
// omitted falls through to the default.

export type OnThisDayBrandTheme = {
  backgroundColor: string;
  accentColor: string;
  bigYearColor: string;
  headlineColor: string;
  highlightTextColor: string;
  headerLabelColor: string;
  footerColor: string;
  // Top-right date circle: solid fill of the circle itself.
  dateCircleColor: string;
  // Month/day/year text rendered inside the date circle.
  dateCircleTextColor: string;
};

export const DEFAULT_ONTHISDAY_THEME: OnThisDayBrandTheme = {
  backgroundColor: "#EDEAE2",
  accentColor: "#3F4DF2",
  bigYearColor: "#FFFFFF",
  headlineColor: "#2B1F18",
  highlightTextColor: "#FFFFFF",
  headerLabelColor: "#2B1F18",
  footerColor: "#2B1F18",
  dateCircleColor: "#2B1F18",
  dateCircleTextColor: "#EDEAE2",
};

export const BRAND_ONTHISDAY_THEMES: Record<
  string,
  Partial<OnThisDayBrandTheme>
> = {
  "Astro Awani": {
    accentColor: "#ff4500",
  },
  "Astro Arena": {
    accentColor: "#0125B7",
  },
  "Astro Ulagam": {
    accentColor: "#F61533",
  },
  Era: {
    accentColor: "#035034",
    highlightTextColor: "#FFFFFF",
  },
  "Era Sabah": {
    accentColor: "#035034",
    highlightTextColor: "#FFFFFF",
  },
  "Era Sarawak": {
    accentColor: "#035034",
    highlightTextColor: "#FFFFFF",
  },
  Gegar: {
    accentColor: "#009BDC",
    highlightTextColor: "#FFFFFF",
  },
  Gempak: {
    accentColor: "#e50448",
    highlightTextColor: "#FFFFFF",
  },
  Goxuan: {
    backgroundColor: "#EDEAE2",
    accentColor: "#010103",
    bigYearColor: "#FFFFFF",
    headlineColor: "#2B1F18",
    highlightTextColor: "#FFFFFF",
    headerLabelColor: "#2B1F18",
    footerColor: "#2B1F18",
    dateCircleColor: "#2B1F18",
    dateCircleTextColor: "#EDEAE2",
  },
  Hitz: {
    highlightTextColor: "#FFFFFF",
  },
  Hotspot: {
    backgroundColor: "#c01e2e",
    accentColor: "#EDEAE2",
    headerLabelColor: "#EDEAE2",
    bigYearColor: "#2B1F18",
    headlineColor: "#EDEAE2",
    highlightTextColor: "#2B1F18",
    footerColor: "#EDEAE2",
  },
  Impiana: {
    accentColor: "#280C32",
  },
  Keluarga: {
    accentColor: "#63412E",
  },
  Lite: {
    accentColor: "#00305A",
  },
  Maskulin: {
    accentColor: "#1A1A1A",
  },
  "Media Hiburan": {
    accentColor: "#048DD3",
  },
  Meletop: {
    accentColor: "#400E87",
  },
  Melody: {
    accentColor: "#FFFFFF",
    bigYearColor: "#010103",
    highlightTextColor: "#010103",
  },
  "Mingguan Wanita": {
    backgroundColor: "#C7161E",
    accentColor: "#EDEAE2",
    headerLabelColor: "#EDEAE2",
    bigYearColor: "#2B1F18",
    headlineColor: "#EDEAE2",
    highlightTextColor: "#2B1F18",
    footerColor: "#EDEAE2",
  },
  Mix: {
    accentColor: "#17A4B6",
  },
  MY: {
    accentColor: "#E0D2C5",
    bigYearColor: "#2B1F18",
    highlightTextColor: "#2B1F18",
  },
  Nona: {
    accentColor: "#EDEAE2",
    backgroundColor: "#1A1A1A",
    footerColor: "#EDEAE2",
    bigYearColor: "#000000",
    headlineColor: "#EDEAE2",
    highlightTextColor: "#1A1A1A",
    headerLabelColor: "#EDEAE2",
    dateCircleColor: "#EDEAE2",
    dateCircleTextColor: "#1A1A1A",
  },
  "Pa&Ma": {
    accentColor: "#280C32",
    backgroundColor: "#FDF6A5",
    dateCircleTextColor: "#FDF6A5",
  },
  Raaga: {
    accentColor: "#280C32",
  },
  Rasa: {
    accentColor: "#E91D26",
  },
  Remaja: {
    accentColor: "#EA1C9B",
  },
  "Roda Panas": {
    accentColor: "#000000",
  },
  "Rojak Daily": {
    accentColor: "#FFFFFF",
    backgroundColor: "#000000",
    headlineColor: "#FFFFFF",
    highlightTextColor: "#2B1F18",
    bigYearColor: "#2B1F18",
    footerColor: "#FFFFFF",
    headerLabelColor: "#FFFFFF",
  },
  Sinar: {
    accentColor: "#63412E",
  },
  "Stadium Astro": {
    accentColor: "#0125B7",
  },
  XUAN: {
    accentColor: "#3FB8C2",
  },
  Zayan: {
    accentColor: "#D792EA",
  },
};
