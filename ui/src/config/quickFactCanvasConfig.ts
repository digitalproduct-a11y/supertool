// Quick Fact carousel canvas config (portrait 1080×1350).
//
// The CMS Quick Fact post (n8n workflow uYavn7y5GXBezjkw) is rendered as a
// client-side Fabric.js carousel: a dark "cover" slide + one accent-colored
// "fact" slide per fact. The brand's accent (brand_hex) is injected at render
// time — never hardcode a brand color here.
//
// Two design references drive this:
//   • cover  → dark bg, rounded hero image, accent key-phrase chip, big title, summary
//   • fact   → dark bg, large rounded accent card holding one fact (number + header + body)
//
// Geometry that's purely positional lives in QuickFactSlideCanvas; this file
// holds the dimensions, palette, and per-language typography so they can be
// tuned without touching render code.

export const QUICK_FACT_CANVAS = { width: 1080, height: 1350 } as const;

// Per-brand footer strip image (full-bleed at the bottom of every slide).
// Keyed by brand name lowercased. Served same-origin from /public so Fabric can
// export the canvas (toDataURL) without tainting. Brands without an entry fall
// back to the text footer in QuickFactSlideCanvas.
export const QUICK_FACT_FOOTER: Record<string, string> = {
  "astro awani": "/quickfact/awani-footer.png",
};

export interface QuickFactTypography {
  coverTitle: number;
  coverSummary: number;
  coverKeyPhrase: number;
  factHeader: number;
  factBody: number;
  factNumber: number;
  badge: number;
  footer: number;
  lineHeight: number;
}

// Per language family (matches the brand "category" field: Chinese | Malay | English).
// CJK glyphs are wider and need a touch more line-height; Latin can run tighter.
export const TYPOGRAPHY_BY_CATEGORY: Record<string, QuickFactTypography> = {
  Chinese: {
    coverTitle: 68,
    coverSummary: 24,
    coverKeyPhrase: 30,
    factHeader: 76,
    factBody: 34,
    factNumber: 40,
    badge: 24,
    footer: 22,
    lineHeight: 1.35,
  },
  Malay: {
    coverTitle: 58,
    coverSummary: 24,
    coverKeyPhrase: 30,
    factHeader: 82,
    factBody: 34,
    factNumber: 40,
    badge: 24,
    footer: 22,
    lineHeight: 1.15,
  },
  English: {
    coverTitle: 72,
    coverSummary: 24,
    coverKeyPhrase: 30,
    factHeader: 82,
    factBody: 34,
    factNumber: 40,
    badge: 24,
    footer: 22,
    lineHeight: 1.15,
  },
};

export function typographyFor(category: string): QuickFactTypography {
  return TYPOGRAPHY_BY_CATEGORY[category] ?? TYPOGRAPHY_BY_CATEGORY.English;
}

export interface QuickFactPalette {
  bg: string; // near-black canvas background
  accent: string; // brand hex — chip / fact card / number
  onAccent: string; // text drawn on top of the accent color
  textPrimary: string; // headline / body on the dark bg
  textMuted: string; // summary / footer on the dark bg
}

// Pick black or white for text sitting on top of the accent color, using the
// W3C relative-luminance threshold so light accents (yellow) get dark text and
// dark accents (navy) get white text.
export function readableOn(hex: string): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return "#0D0D0F";
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? "#0D0D0F" : "#FFFFFF";
}

export function paletteFor(brandHex: string): QuickFactPalette {
  const accent =
    brandHex && /^#?[0-9a-fA-F]{6}$/.test(brandHex)
      ? brandHex.startsWith("#")
        ? brandHex
        : `#${brandHex}`
      : "#FFCC00";
  return {
    bg: "#FBF4EF",
    accent,
    onAccent: readableOn(accent),
    textPrimary: "#0D0D0F",
    textMuted: "#6B7280",
  };
}

// Shared spacing/geometry (px, in 1080×1350 space).
export const QUICK_FACT_LAYOUT = {
  pad: 64, // outer canvas padding
  topRowY: 56, // logo / badge baseline from top
  logoWidth: 220,
  logoMaxHeight: 84,
  corner: 36, // rounded-corner radius for hero + cards
  // cover
  heroTop: 150,
  heroHeight: 560,
  chipPadX: 28,
  chipPadY: 16,
  // fact
  cardTop: 150,
  cardBottom: 170, // distance from canvas bottom to card bottom
  cardPad: 64, // inner padding of the fact card
  // footer strip
  footerBottom: 40, // gap from the canvas bottom edge to the footer
} as const;
