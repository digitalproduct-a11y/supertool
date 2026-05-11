// Brand-aware font loader. Resolves a `font_use` value (from the Brand Tone &
// Voice data table at n8n table WrA94W8RTzSvEhyS) into a CSS font-family
// that's been registered with document.fonts, so Fabric.js renders the
// correct glyphs on canvas.
//
// `font_use` values come in two shapes:
//   1. A Cloudinary asset reference, e.g. "Fonts:LeagueSpartan-Bold.ttf" —
//      this is the form n8n hands to Cloudinary's `l_text:` overlay engine.
//      We bundle the same .ttf/.otf files locally under `/fonts/` and
//      register them via @font-face so the on-screen preview matches the
//      Cloudinary output exactly (and loads instantly, no network round-
//      trip to Google Fonts).
//   2. A plain Google Fonts family name, e.g. "Montserrat" — we inject a
//      Google Fonts <link> on first use and wait for it to load.

type LocalFont = { family: string; weight: number; src: string };

// Map each known Cloudinary `font_use` value to a local font file under
// `ui/public/fonts/`. The `family` is the CSS font-family string we declare
// in @font-face and that Fabric uses on the canvas. `weight` is the canonical
// weight to load and to use in `document.fonts.load`.
const CLOUDINARY_TO_LOCAL: Record<string, LocalFont> = {
  "Fonts:LeagueSpartan-Bold.ttf": {
    family: "League Spartan",
    weight: 700,
    src: "/fonts/LeagueSpartan-Bold.ttf",
  },
  "fonts:leaguespartan.ttf": {
    family: "League Spartan",
    weight: 400,
    src: "/fonts/leaguespartan.ttf",
  },
  "Fonts:Anton-Regular.ttf": {
    family: "Anton",
    weight: 400,
    src: "/fonts/Anton-Regular.ttf",
  },
  "Fonts:ArchivoBlack-Regular.ttf": {
    family: "Archivo Black",
    weight: 400,
    src: "/fonts/ArchivoBlack-Regular.ttf",
  },
  "Fonts:ITCAvantGardeStdBold.ttf": {
    family: "ITC Avant Garde Std",
    weight: 700,
    src: "/fonts/ITCAvantGardeStd-Bold.ttf",
  },
  "Fonts:canvasans.ttf": {
    family: "Canva Sans",
    weight: 400,
    src: "/fonts/CanvaSans-VF.ttf",
  },
  "Fonts:OpenSans-Regular.ttf": {
    family: "Open Sans",
    weight: 400,
    src: "/fonts/OpenSans-Regular.ttf",
  },
  "Fonts:OpenSans-Bold.ttf": {
    family: "Open Sans",
    weight: 700,
    src: "/fonts/OpenSans-Bold.ttf",
  },
  "Fonts:SourceHanSansCN-Heavy-2.otf": {
    family: "Source Han Sans CN",
    weight: 900,
    src: "/fonts/SourceHanSansCN-Heavy-2.otf",
  },
  "Fonts:方正兰亭特黑简体.ttf": {
    family: "FZ LanTingHei S",
    weight: 900,
    // URL-encode the CJK filename so the browser fetches it correctly.
    src: `/fonts/${encodeURIComponent("方正兰亭特黑简体.ttf")}`,
  },
};

// Cache by raw `font_use` input so repeated calls (same brand re-rendered)
// resolve synchronously after the first network round-trip.
const cache = new Map<string, Promise<string>>();
const injectedGoogleFamilies = new Set<string>();
const injectedLocalFamilies = new Set<string>();

// The "canonical" weight a brand font ships at. Callers use this to ensure
// the canvas requests a real weight that exists in the font file — single-
// weight families (Anton, Archivo Black) only have 400, so a fontWeight of
// 700 either falls back or triggers faux-bold and corrupt Textbox metrics.
// Returns null for plain Google family names where any weight in 100–900 is
// available.
export function getBrandFontWeight(
  fontUse: string | null | undefined,
): number | null {
  if (!fontUse) return null;
  return CLOUDINARY_TO_LOCAL[fontUse]?.weight ?? null;
}

function injectFontFace(family: string, weight: number, src: string): void {
  if (injectedLocalFamilies.has(family)) return;
  const style = document.createElement("style");
  style.dataset.brandFont = family;
  style.textContent = `@font-face{font-family:"${family}";src:url("${src}");font-weight:${weight};font-style:normal;font-display:swap;}`;
  document.head.appendChild(style);
  injectedLocalFamilies.add(family);
}

async function loadLocalFont(font: LocalFont): Promise<string> {
  injectFontFace(font.family, font.weight, font.src);
  // Trigger metric load so Fabric measures glyphs correctly on first paint.
  await document.fonts
    .load(`${font.weight} 64px "${font.family}"`)
    .catch(() => undefined);
  return font.family;
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
      // Cloudinary asset ref → bundled local font file.
      const local = CLOUDINARY_TO_LOCAL[fontUse];
      if (local) {
        return await loadLocalFont(local);
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
