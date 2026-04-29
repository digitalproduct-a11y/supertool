// Quote Canvas Layout Config (portrait 1080×1350, paper background, brand-color halo)
// Adjust values here to change positions, sizes, colors, fonts — no code changes needed.
// Brand color is injected at render time via getBrandHex(brand) — do not hardcode it here.

export interface TextLayerStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  // "auto" → resolved at render time to the current brand hex
  fill: string;
  fontStyle?: "normal" | "italic";
  lineHeight?: number;
  letterSpacing?: number; // em-relative; Fabric uses charSpacing in 1/1000 em units
  textAlign?: "left" | "center" | "right";
  uppercase?: boolean;
  capitalize?: boolean;
}

export interface TabloidConfig {
  // Photo treatment for the full-bleed image. "none" preserves original colors.
  photoTreatment: "duotone" | "grayscale" | "none";
  bottomGradient: {
    coverageRatio: number; // 0..1 — fraction of canvas height covered (gradient anchored to bottom edge)
    startOpacity: number; // 0..1 — opacity at the gradient's top edge
    endOpacity: number; // 0..1 — opacity at the canvas bottom
    color: string; // hex (e.g. "#000000")
  };
  logo: {
    x: number; // px from left
    y: number; // px from top
    width: number; // target width (px)
    maxHeight: number; // height cap (px)
  };
  sideCircle: {
    // Master toggle. When true AND a URL is supplied via QuoteCanvas's
    // pexelsImageUrl prop, the renderer draws a single circular Pexels image
    // with a thin white halo and an optional drop shadow. Fails silently if
    // the URL is missing or doesn't load. The user-facing on/off lives in
    // QuotePage state.
    enabled: boolean;
    radius: number; // px
    center: { x: number; y: number };
    strokeColor: string;
    strokeWidth: number; // px — halo thickness
    shadow: {
      // Soft drop shadow applied to the halo so the circle "lifts" off the
      // photo (matching the reference design). Disable for a flat sticker look.
      enabled: boolean;
      color: string; // e.g. "rgba(0,0,0,0.5)"
      blur: number; // px
      offsetX: number; // px
      offsetY: number; // px
    };
  };
  bottomStack: {
    bottomPadding: number; // distance from canvas bottom to the last text line
    sidePadding: number; // px inset on each side for the centered text stack
    quoteMark: {
      enabled: boolean;
      text: string;
      style: TextLayerStyle;
      // Gap (px) between the mark's bottom and the punch headline.
      // Negative values pull the punch up underneath the mark for tighter coupling.
      marginBottom: number;
      // Per-mark nudge applied AFTER stack centering. Doesn't affect any other element.
      offsetX: number; // px relative to canvas horizontal center (negative = left)
      offsetY: number; // px relative to its stack-computed top (negative = up, positive = down)
    };
    punch: TextLayerStyle;
    punchMaxWidth: number;
    punchMarginBottom: number;
    subtitle: TextLayerStyle;
    subtitleMarginBottom: number;
    // Per-subtitle nudge applied AFTER stack centering. Doesn't affect the
    // positions of the punch/quote-mark above it or author below.
    subtitleOffsetX: number; // px relative to canvas horizontal center (negative = left)
    subtitleOffsetY: number; // px relative to its stack-computed top (negative = up, positive = down)
    author: TextLayerStyle;
    // Where the author block sits in the bottom stack:
    //   "top"    — kicker above the quote mark (e.g. "AUTHOR • TITLE" → "“" → punch → subtitle)
    //   "bottom" — caption below the subtitle (subtitle → AUTHOR • TITLE)
    // "top" keeps the layout stable as quote_text grows because the author moves with the rest of the stack.
    authorPosition: "top" | "bottom";
    // Gap (px) below the author when authorPosition === "top". Acts as the kicker→quote-mark spacer.
    authorMarginBottom: number;
    // Per-author nudge applied AFTER stack centering. Use only for small alignment tweaks; large offsets break dynamic layout.
    authorOffsetX: number; // px relative to canvas horizontal center (negative = left)
    authorOffsetY: number; // px relative to its stack-computed top (negative = up, positive = down)
  };
  // Dynamic font scaling for the punch headline based on character count
  dynamicSizing: Array<{ maxLength: number; scale: number }>;
  // Dynamic font scaling for the subtitle (quote_text) based on character count.
  // Prevents long quotes from wrapping to too many lines and overlapping the punch.
  subtitleDynamicSizing: Array<{ maxLength: number; scale: number }>;
}

export interface QuoteCanvasConfig {
  // Discriminator for which render path QuoteCanvas should use.
  //   "side-text" — original layout: photo left + fade, text stack right
  //   "tabloid"   — full-bleed photo, dark bottom gradient, bottom-centered headline
  layoutVariant: "side-text" | "tabloid";
  canvas: {
    width: number;
    height: number;
    // Used when backgroundStyle === "solid"
    backgroundColor: string;
    // "paper"       — warm off-white plate + low-opacity grain (most seamless, magazine feel)
    // "radial-wash" — light brand-tinted radial gradient to white at corners
    // "solid"       — flat backgroundColor only
    // "image"       — full-bleed background image (e.g. newspaper texture)
    backgroundStyle: "paper" | "radial-wash" | "solid" | "image";
    paperTexture: {
      color: string; // base fill (e.g. "#FAFAF7")
      grainOpacity: number; // 0..1
    };
    radialWash: {
      centerX: number; // 0..1
      centerY: number; // 0..1
      innerColorMix: number; // 0..1; how much brand color at the center (0 = pure white)
    };
    backgroundImage: {
      url: string; // served from /public — use a leading slash, e.g. "/newspaper_bg.png"
      opacity: number; // 0..1; lower to wash out an aggressive texture
      // Color the photo-fade gradients should fade to under "image" style.
      // Pick a hex that matches the dominant tone of the texture so fades blend in.
      fadeTarget: string;
    };
  };
  // Article photo (used when cutout is OFF or unavailable). Photo bleeds left edge.
  photo: {
    x: number;
    y: number;
    width: number;
    height: number;
    treatment: "duotone" | "grayscale" | "none";
    // Duotone: pixels are mapped from `duotoneDark` (shadows) → `duotoneLight` (highlights)
    // by luminance. Set duotoneLight to "auto" to use the current brand hex.
    duotoneDark: string;
    duotoneLight: string;
    contrast: number; // -1..1 — Fabric Contrast filter, applied after treatment
    brightness: number; // -1..1 — Fabric Brightness filter, applied after treatment
  };
  photoFade: {
    // Right-edge horizontal fade (transparent at startStop → background color at endStop)
    horizontalStart: number; // 0..1 fraction of canvas width
    horizontalEnd: number;
    bottomHeight: number; // px height of bottom-edge fade
  };
  vignette: {
    enabled: boolean;
    centerX: number; // fraction
    centerY: number;
    innerStop: number; // 0..1, where transparent ends
    outerAlpha: number; // 0..1, dark overlay strength at edge
  };
  grain: {
    enabled: boolean;
    opacity: number;
  };
  // Right-side content area
  content: {
    right: number;
    width: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
  };
  quoteMark: {
    enabled: boolean;
    text: string;
    style: TextLayerStyle;
    offsetX: number; // negative pulls left
    // Vertical gap (px) between the quote mark and the intro text below it.
    // The quote mark size DOES NOT affect the text stack — only this gap does.
    gapBelow: number;
  };
  quoteIntro: {
    style: TextLayerStyle;
    maxWidth: number;
    marginBottom: number;
  };
  quotePunch: {
    style: TextLayerStyle;
    maxWidth: number;
    marginBottom: number;
  };
  authorName: {
    style: TextLayerStyle;
    marginBottom: number;
  };
  authorTitle: {
    style: TextLayerStyle;
  };
  brandStrip: {
    enabled: boolean;
    // The logo flows in the centered text stack, AFTER the author title.
    marginTop: number; // px gap between the author title and the logo
    offsetX: number; // px relative to content-column center (negative = left, positive = right)
    offsetY: number; // px vertical fine-tune AFTER stack centering (negative = up, positive = down)
    logo: {
      width: number; // target width (px) — primary size knob
      maxHeight: number; // optional height cap; raise to a large number to disable
    };
  };
  cutoutImage: {
    enabled: boolean;
    x: number;
    y: number;
    maxWidth: number;
    maxHeight: number;
    originX: "center" | "left" | "right";
    originY: "center" | "top" | "bottom";
    opacity: number;
    // When the scaled subject's height is BELOW this fraction of canvas height
    // (e.g. tight bust shots), the cutout is centered vertically on the canvas
    // instead of bottom-anchored — prevents short subjects from looking
    // stranded at the floor.
    centerThreshold: number; // 0..1
    paperCutout: {
      enabled: boolean;
      // Hex color, or "auto" → resolves to getBrandHex(brand) at render time
      color: string;
      // px in source-image space (applied BEFORE the scale-to-fit)
      outlineWidth: number;
      // Optional drop shadow under the silhouette — defaults are off (sticker look)
      shadowOffsetY: number; // px
      shadowBlur: number; // px
      shadowOpacity: number; // 0..1
    };
  };
  // Dynamic font sizing for the punch phrase based on character count
  dynamicSizing: Array<{ maxLength: number; scale: number }>;
  // Tabloid layout knobs — only consulted when layoutVariant === "tabloid"
  tabloid: TabloidConfig;
}

export const DEFAULT_QUOTE_CANVAS_CONFIG: QuoteCanvasConfig = {
  layoutVariant: "side-text",
  canvas: {
    // Portrait 1080w × 1350h (4:5 IG/FB feed). Adjust ONLY here — bitmap follows.
    width: 1080,
    height: 1350,
    backgroundColor: "#ffffff",
    backgroundStyle: "image",
    paperTexture: {
      color: "#FAFAF7", // warm off-white, magazine-page feel
      grainOpacity: 0.07,
    },
    radialWash: {
      centerX: 0.3,
      centerY: 0.5,
      innerColorMix: 0.08, // 8% brand at center, 0% at corners
    },
    backgroundImage: {
      url: "/newspaper_bg.png", // file lives in ui/public/
      opacity: 1,
      fadeTarget: "#f3eee2", // sample of the newspaper's dominant warm-cream tone
    },
  },
  photo: {
    // Photo (used when cutout is OFF). Bleeds the left edge slightly.
    x: -40,
    y: -20,
    width: 600,
    height: 1390,
    // Tonal treatment applied to BOTH the photo and the cutout subject.
    //   "duotone"  — shadows mapped to duotoneDark, highlights to duotoneLight
    //   "grayscale" — desaturate to neutral B&W
    //   "none"     — preserve original colors
    treatment: "duotone",
    duotoneDark: "#000000",
    duotoneLight: "#ffffff", // or "auto" to use the current brand hex as the highlight
    contrast: 0.1,
    brightness: -0.05,
  },
  photoFade: {
    horizontalStart: 0.35,
    horizontalEnd: 0.9,
    bottomHeight: 240,
  },
  vignette: {
    // Lower opacity on the paper background — a heavy vignette would muddy it.
    enabled: true,
    centerX: 0.25,
    centerY: 0.5,
    innerStop: 0.35,
    outerAlpha: 0.15,
  },
  grain: {
    // Standalone grain layer — only used when backgroundStyle !== "paper"
    // (paper preset folds grain into Layer 1 to avoid double-stamping).
    enabled: true,
    opacity: 0.04,
  },
  content: {
    // Right-side editorial column. Edit `width` to widen/narrow the text area.
    right: 0,
    width: 540,
    paddingTop: 110,
    paddingRight: 60,
    paddingBottom: 180,
    paddingLeft: 30,
  },
  quoteMark: {
    // ─── The big opening quote mark above quote_text ──────────────────
    // Resize via style.fontSize WITHOUT affecting the text below — the
    // mark is anchored relative to the intro line and excluded from the
    // vertical text stack height. Adjust gapBelow to control spacing.
    enabled: true,
    text: "“",
    style: {
      fontFamily: "Georgia",
      fontSize: 320, // ← bump freely; text below stays put
      fontWeight: "normal",
      fill: "#000000",
      lineHeight: 0.6,
    },
    offsetX: -6,
    gapBelow: -140, // ← px between the quote mark's bottom and the intro line
    // ──────────────────────────────────────────────────────────────────
  },
  quoteIntro: {
    style: {
      fontFamily: "Barlow",
      fontSize: 26,
      fontWeight: 400,
      fontStyle: "italic",
      fill: "#000000",
      lineHeight: 1.55,
    },
    maxWidth: 440,
    marginBottom: 22,
  },
  quotePunch: {
    style: {
      fontFamily: "Oswald",
      fontSize: 92,
      fontWeight: 700,
      // "auto" → resolved at render time to current brand hex
      fill: "auto",
      lineHeight: 0.95,
      letterSpacing: -0.015,
      uppercase: true,
    },
    maxWidth: 440,
    marginBottom: 32,
  },
  authorName: {
    style: {
      fontFamily: "Barlow",
      fontSize: 28,
      fontWeight: 600,
      fill: "#000000",
    },
    marginBottom: 4,
  },
  authorTitle: {
    style: {
      fontFamily: "Barlow",
      fontSize: 20,
      fontWeight: 400,
      fill: "rgba(0,0,0,0.65)",
      letterSpacing: 0.02,
      capitalize: true,
    },
  },
  brandStrip: {
    enabled: true,
    marginTop: 36, // gap between author title and the logo
    offsetX: -160, // shift logo horizontally; negative pulls left, positive pushes right
    offsetY: 0, // shift logo vertically; negative pulls up, positive pushes down
    logo: {
      width: 240, // ← bump this for a bigger logo
      maxHeight: 100, // height cap; set high to let `width` be the sole control
    },
  },
  cutoutImage: {
    // ─── Tune cutout placement here ─────────────────────────────────────
    enabled: true,
    x: -100, // negative = bleed past left edge (use 0 for flush, +N to inset)
    y: 1400, // anchor Y in canvas coords; with originY:"bottom" this is the floor
    maxWidth: 640, // hard cap — will auto-shrink further if it would cross into the text column
    maxHeight: 1350, // hard cap — full canvas height
    originX: "left", // "left" | "center" | "right"
    originY: "bottom", // "top" | "center" | "bottom"
    opacity: 1,
    centerThreshold: 0.7, // subjects filling <70% canvas height get centered vertically

    paperCutout: {
      // Brand-color silhouette painted around the subject (die-cut sticker effect)
      enabled: true,
      color: "auto", // "auto" → uses current brand hex
      outlineWidth: 16, // px in SOURCE-image space (applied before scale-to-fit)
      shadowOffsetY: 0,
      shadowBlur: 0,
      shadowOpacity: 0,
    },
    // ────────────────────────────────────────────────────────────────────
  },
  dynamicSizing: [
    { maxLength: 16, scale: 1.0 },
    { maxLength: 28, scale: 0.85 },
    { maxLength: 42, scale: 0.72 },
    { maxLength: 9999, scale: 0.6 },
  ],
  // Tabloid block carried for type-completeness; ignored under "side-text".
  tabloid: makeTabloidDefaults(),
};

function makeTabloidDefaults(): TabloidConfig {
  return {
    photoTreatment: "none",
    bottomGradient: {
      coverageRatio: 0.8, // covers bottom 70% of the canvas
      startOpacity: 0,
      endOpacity: 0.92,
      color: "#000000",
    },
    logo: {
      // Top-right anchored: `x` is distance from the RIGHT edge, `y` from the top.
      x: 56,
      y: 56,
      width: 180,
      maxHeight: 96,
    },
    sideCircle: {
      // Pexels-fed decorative circle. URL comes from QuoteCanvas's pexelsImageUrl
      // prop (set in QuotePage from the n8n response). Whether the image is
      // shown is gated client-side by the user's "Side Circle" toggle.
      enabled: true,
      radius: 120,
      center: { x: 200, y: 460 },
      strokeColor: "#ffffff",
      strokeWidth: 8,
      shadow: {
        // Soft drop shadow that gives the circle its "lifted off the photo"
        // look (mirrors the reference design). Tune blur for softness, offsetY
        // for how far it drops, and color/alpha for darkness.
        enabled: true,
        color: "rgba(0,0,0,0.5)",
        blur: 30,
        offsetX: 0,
        offsetY: 8,
      },
    },
    bottomStack: {
      bottomPadding: 60,
      sidePadding: 60,
      quoteMark: {
        enabled: true,
        text: "“",
        style: {
          fontFamily: "Georgia",
          fontSize: 220,
          fontWeight: "normal",
          fill: "#ffffff",
          lineHeight: 0.6,
          textAlign: "center",
        },
        marginBottom: -60, // negative pulls the next element up under the mark
        offsetX: 0,
        offsetY: 50,
      },
      punch: {
        fontFamily: "Oswald",
        fontSize: 108,
        fontWeight: 700,
        fill: "#ffffff",
        lineHeight: 0.96,
        letterSpacing: -0.01,
        textAlign: "center",
        uppercase: true,
      },
      punchMaxWidth: 960,
      punchMarginBottom: 0,
      subtitle: {
        fontFamily: "Barlow",
        fontSize: 22,
        fontWeight: 500,
        fill: "rgba(255,255,255,0.85)",
        lineHeight: 1.4,
        letterSpacing: 0.04,
        textAlign: "center",
        uppercase: true,
      },
      subtitleMarginBottom: 0,
      subtitleOffsetX: 0,
      subtitleOffsetY: 8,
      author: {
        fontFamily: "Barlow",
        fontSize: 18,
        fontWeight: 600,
        fill: "rgba(255,255,255,0.7)",
        letterSpacing: 0.08,
        textAlign: "center",
        uppercase: true,
      },
      // Author renders as a kicker ABOVE the quote mark by default. The whole
      // group (author → quote-mark → punch → subtitle) is bottom-anchored and
      // grows upward together when quote_text is long, so the author and quote
      // mark never collide.
      authorPosition: "top",
      authorMarginBottom: 24,
      authorOffsetX: 0,
      authorOffsetY: 0,
    },
    dynamicSizing: [
      { maxLength: 24, scale: 1.0 },
      { maxLength: 40, scale: 0.85 },
      { maxLength: 60, scale: 0.72 },
      { maxLength: 9999, scale: 0.6 },
    ],
    // Subtitle (quote_text) shrinks as it gets longer so it stays within
    // ~2-3 wrap lines instead of pushing the punch up the canvas.
    subtitleDynamicSizing: [
      { maxLength: 80, scale: 1.0 },
      { maxLength: 140, scale: 0.9 },
      { maxLength: 200, scale: 0.78 },
      { maxLength: 9999, scale: 0.65 },
    ],
  };
}

// Variant config for `Subject Cutout: Off` — full-bleed photo + bottom headline.
// Reuses the canvas dimensions and brand-aware photo treatment knobs from the
// default; switches the layoutVariant and turns off layers the tabloid path
// doesn't draw (vignette, standalone grain, side-stack brand strip, cutout).
export const TABLOID_QUOTE_CANVAS_CONFIG: QuoteCanvasConfig = {
  ...DEFAULT_QUOTE_CANVAS_CONFIG,
  layoutVariant: "tabloid",
  canvas: {
    ...DEFAULT_QUOTE_CANVAS_CONFIG.canvas,
    backgroundStyle: "solid",
    backgroundColor: "#000000",
  },
  vignette: { ...DEFAULT_QUOTE_CANVAS_CONFIG.vignette, enabled: false },
  grain: { ...DEFAULT_QUOTE_CANVAS_CONFIG.grain, enabled: false },
  brandStrip: { ...DEFAULT_QUOTE_CANVAS_CONFIG.brandStrip, enabled: false },
  quoteMark: { ...DEFAULT_QUOTE_CANVAS_CONFIG.quoteMark, enabled: false },
  cutoutImage: { ...DEFAULT_QUOTE_CANVAS_CONFIG.cutoutImage, enabled: false },
  tabloid: makeTabloidDefaults(),
};
