// OnThisDay "Bold Modernist" canvas config — absolute coordinates lifted
// directly from the source design HTML (`03 _ Bold Modernist.html`).
// Canvas is 1080×1350 with a single cream background; the dark and blue
// rectangles are positioned blocks, not bands.

export interface OnThisDayCanvasConfig {
  canvas: { width: number; height: number };
  // Whole-canvas cream background.
  cream: string;
  // Dark fill (date square + headline color when on cream).
  dark: string;
  // Accent — blue rectangle behind the giant year, dispatch line, highlight word(s).
  accent: string;
  // Top header strip (logo + "ON THIS DAY · VOL. {YEAR}" label).
  header: {
    paddingX: number;
    top: number;
    height: number;
    logo: { width: number; maxHeight: number };
    label: {
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      letterSpacing: number;
    };
  };
  // Blue accent rectangle that bleeds the left edge. Slightly rotated to
  // match the source design's tilted block (see `angle` below).
  accentBox: {
    left: number; // negative = bleeds past canvas edge
    top: number;
    width: number;
    height: number;
    // Rotation in degrees, applied around the rectangle's CENTER. Source
    // HTML uses `matrix(0.999391, -0.0349, 0.0349, 0.999391, 0, 0)` ≈ -2°.
    angle: number;
  };
  // Giant year text overlapping the accent rectangle.
  bigYear: {
    left: number;
    top: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing: number;
    color: string;
    // Rotation in degrees, applied around the text's TOP-LEFT anchor. Set to
    // accentBox.angle to tilt with the blue rectangle, or 0 to keep upright.
    angle: number;
  };
  // Dark CIRCLE top-right that holds the MAY / DD / · YYYY · stack.
  // Sized to overlap the right edge of the giant year (matches source design).
  dateBox: {
    centerX: number;
    centerY: number;
    radius: number;
    paddingY: number;
    monthFontSize: number;
    dayFontSize: number;
    yearFontSize: number;
    monthLetterSpacing: number;
    dayLetterSpacing: number;
    yearLetterSpacing: number;
    color: string;
  };
  // "{line} ON THIS DAY" cluster above the headline. The leading triple-dash
  // glyph is replaced with a real Fabric Line for crisp rendering.
  dispatch: {
    left: number;
    top: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing: number;
    lineWidth: number; // px length of the leading rule
    lineThickness: number; // stroke width
    lineGap: number; // px between line end and label start
  };
  // The big editorial headline (OnThisDayTitle, prefix-stripped).
  headline: {
    left: number;
    top: number;
    maxWidth: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing: number;
    lineHeight: number;
    color: string;
    // Length-based scaling so a 250-char title doesn't overflow the canvas.
    dynamicSizing: Array<{ maxLength: number; scale: number }>;
  };
  // Bottom footer text (kicker + tagline + url slot).
  footer: {
    paddingX: number;
    top: number;
    kicker: { fontFamily: string; fontSize: number; fontWeight: number };
    tagline: {
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      gapAbove: number;
    };
    url: {
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      letterSpacing: number;
    };
  };
}

export const DEFAULT_ONTHISDAY_CANVAS_CONFIG: OnThisDayCanvasConfig = {
  canvas: { width: 1080, height: 1350 },
  cream: "#EDEAE2",
  dark: "#2B1F18",
  accent: "#3F4DF2",
  header: {
    paddingX: 70,
    top: 60,
    height: 42,
    logo: { width: 150, maxHeight: 150 },
    label: {
      fontFamily: "Archivo",
      fontSize: 16,
      fontWeight: 500,
      letterSpacing: 4,
    },
  },
  accentBox: {
    left: -40,
    top: 180,
    width: 720,
    height: 320,
    angle: -2,
  },
  bigYear: {
    left: 20,
    top: 190,
    fontFamily: "Archivo",
    fontSize: 300,
    fontWeight: 800,
    letterSpacing: -16,
    color: "#FFFFFF",
    angle: -2,
  },
  dateBox: {
    // Circle sized to overlap the right edge of the giant year (matches design).
    // cx=840, r=120 → spans x=720..960, biting ~76px into the year.
    centerX: 840,
    centerY: 340,
    radius: 120,
    paddingY: 36,
    monthFontSize: 18,
    dayFontSize: 130,
    yearFontSize: 14,
    monthLetterSpacing: 5,
    dayLetterSpacing: -6,
    yearLetterSpacing: 3,
    color: "#EDEAE2",
  },
  dispatch: {
    left: 70,
    top: 620,
    fontFamily: "Archivo",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 5,
    lineWidth: 64,
    lineThickness: 2,
    lineGap: 16,
  },
  headline: {
    left: 70,
    top: 680,
    maxWidth: 940,
    fontFamily: "Archivo",
    fontSize: 84,
    fontWeight: 800,
    letterSpacing: -2.8,
    lineHeight: 0.96,
    color: "#2B1F18",
    dynamicSizing: [
      { maxLength: 50, scale: 1.0 },
      { maxLength: 90, scale: 0.85 },
      { maxLength: 140, scale: 0.72 },
      { maxLength: 200, scale: 0.6 },
      { maxLength: 9999, scale: 0.5 },
    ],
  },
  footer: {
    paddingX: 70,
    top: 1232,
    kicker: { fontFamily: "Archivo", fontSize: 22, fontWeight: 600 },
    tagline: {
      fontFamily: "Archivo",
      fontSize: 16,
      fontWeight: 400,
      gapAbove: 4,
    },
    url: {
      fontFamily: "Archivo",
      fontSize: 13,
      fontWeight: 400,
      letterSpacing: 3,
    },
  },
};

// Workflow `7bnyqch3TK8Ao77I` (OnThisDay Engine v2) returns this shape per
// event. Keep in sync with the parser node "Parse Wikipedia Table" — any rename
// there must be mirrored here.
export interface OnThisDayEvent {
  onThisDayTitle: string; // "On This Day — …"
  url: string;
  date: string | null; // "DD/MM/YYYY"
  image: string; // empty by default; user can override via upload
  year?: number;
  day?: number;
  month?: number;
  // Optional contiguous span (in title order, verbatim words) the LLM
  // selected as the most prominent subject phrase. The canvas prefers this
  // over the local heuristic; missing/empty falls back to pickHighlightTerms.
  highlightTerms?: string[];
}

export interface OnThisDayResponse {
  success: boolean;
  status: "found" | "not_found" | "error";
  error?: string;
  todayEvents: OnThisDayEvent[];
  monthEvents: OnThisDayEvent[];
}
