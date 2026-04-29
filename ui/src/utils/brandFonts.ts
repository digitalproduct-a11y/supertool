// Brand-aware font loader. Resolves a `font_use` value (from the Brand Tone &
// Voice data table) into a CSS font-family that's been registered with
// document.fonts, so Fabric.js renders the correct glyphs on canvas.
//
// `font_use` values come in two shapes:
//   1. A Cloudinary asset reference, e.g. "Fonts:LeagueSpartan-Bold.ttf" —
//      this is the form n8n hands to Cloudinary's `l_text:` overlay engine.
//      Cloudinary does NOT expose these fonts as direct download URLs, so
//      we map each known Cloudinary font reference to its closest free
//      Google Fonts equivalent (table below). The mapping is decoupled
//      from the Cloudinary path so n8n image overlays and client canvases
//      can use different actual font files while staying visually aligned.
//   2. A plain Google Fonts family name, e.g. "Montserrat" — we inject a
//      Google Fonts <link> on first use and wait for it to load.

// Map each known Cloudinary `font_use` value to a Google Fonts equivalent.
// `weight` is the canonical weight to load and to use in `document.fonts.load`;
// the canvas itself can render any weight available in the loaded family.
const CLOUDINARY_TO_GOOGLE: Record<string, { family: string; weight: number }> =
  {
    "Fonts:LeagueSpartan-Bold.ttf": { family: "League Spartan", weight: 700 },
    "fonts:leaguespartan.ttf": { family: "League Spartan", weight: 700 },
    "Fonts:Anton-Regular.ttf": { family: "Anton", weight: 400 },
    "Fonts:ArchivoBlack-Regular.ttf": { family: "Archivo Black", weight: 400 },
    // ITC Avant Garde is a paid typeface — League Spartan is the closest
    // free geometric grotesque match for headline weights.
    "Fonts:ITCAvantGardeStdBold.ttf": { family: "League Spartan", weight: 700 },
    // canvasans is a custom upload — Bebas Neue is the closest free
    // condensed display sans available on Google Fonts.
    "Fonts:canvasans.ttf": { family: "Bebas Neue", weight: 400 },
    // Heavy CJK — Noto Sans SC has full Simplified Chinese coverage.
    "Fonts:SourceHanSansCN-Heavy-2.otf": {
      family: "Noto Sans SC",
      weight: 900,
    },
    "Fonts:方正兰亭特黑简体.ttf": { family: "Noto Sans SC", weight: 900 },
  };

// Cache by raw `font_use` input so repeated calls (same brand re-rendered)
// resolve synchronously after the first network round-trip.
const cache = new Map<string, Promise<string>>();
const injectedGoogleFamilies = new Set<string>();

// The "canonical" weight a brand font ships at. Callers use this to ensure
// the canvas requests a real weight that exists in the font file — single-
// weight families (Anton, Archivo Black, Bebas Neue) only have 400, so a
// fontWeight of 700 either falls back or triggers faux-bold and corrupt
// Textbox metrics. Returns null for plain Google family names where any
// weight in 100–900 is available.
export function getBrandFontWeight(
  fontUse: string | null | undefined,
): number | null {
  if (!fontUse) return null;
  return CLOUDINARY_TO_GOOGLE[fontUse]?.weight ?? null;
}

async function loadGoogleFont(name: string, weights: number[]): Promise<string> {
  if (!injectedGoogleFamilies.has(name)) {
    // Always request 400 + 700 so the canvas can render any weight tier
    // declared in quoteCanvasConfig (e.g. punch is 700, subtitle is 500).
    const wghtList = Array.from(new Set([400, 700, ...weights]))
      .sort((a, b) => a - b)
      .join(";");
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      name,
    ).replace(/%20/g, "+")}:wght@${wghtList}&display=swap`;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    injectedGoogleFamilies.add(name);
  }
  // Trigger metric load so Fabric measures glyphs correctly on first paint.
  // System fonts (e.g. "Times New Roman") resolve immediately.
  const loads = weights.map((w) => document.fonts.load(`${w} 64px "${name}"`));
  await Promise.all([
    ...loads,
    document.fonts.load(`400 32px "${name}"`),
    document.fonts.load(`700 64px "${name}"`),
  ]).catch(() => undefined);
  return name;
}

export function loadBrandFont(
  fontUse: string | null | undefined,
): Promise<string> {
  if (!fontUse) return Promise.resolve("");

  const hit = cache.get(fontUse);
  if (hit) return hit;

  const promise = (async () => {
    try {
      // Translate Cloudinary asset refs to their Google Fonts equivalent.
      const mapped = CLOUDINARY_TO_GOOGLE[fontUse];
      if (mapped) {
        return await loadGoogleFont(mapped.family, [mapped.weight]);
      }
      // Plain Google Fonts family name (e.g. "Montserrat", "Open Sans").
      return await loadGoogleFont(fontUse, [400, 700]);
    } catch (err) {
      // One warning is enough; callers fall back to the canvas default font.
      console.warn(`loadBrandFont: failed to load "${fontUse}"`, err);
      return "";
    }
  })();

  cache.set(fontUse, promise);
  return promise;
}
