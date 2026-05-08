// Weather Single Post Canvas — Layout Config (V2b dark theme)
//
// Visual reference: Claude Design's `V2b · Mixed weather mock`. Renders via
// Fabric.js — gradients/translucent fills are approximations (no real
// backdrop-filter on canvas).

export interface SinglePostTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fill: string;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  charSpacing?: number;
  uppercase?: boolean;
}

export interface WeatherSinglePostCanvasConfig {
  canvas: {
    width: number;
    height: number;
    // Solid base fill behind the gradient rect (rarely visible).
    backgroundColor: string;
  };
  background: {
    // Linear gradient applied to a full-canvas Rect. 160deg approximation:
    // start at top-left, end at bottom-right.
    gradient: {
      stops: Array<{ offset: number; color: string }>;
      angleDeg: number;
    };
    // Soft decorative blur orbs (approximated as semi-transparent ellipses).
    orbs: Array<{
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill: string;
      opacity: number;
    }>;
  };
  header: {
    paddingTop: number;
    paddingX: number;
    logo: { width: number; useBrandLogo: boolean };
    eyebrow: {
      text: string;
      style: SinglePostTextStyle;
    };
    brandDot: { size: number; defaultColor: string };
    date: { dayStyle: SinglePostTextStyle; dateStyle: SinglePostTextStyle };
  };
  hero: {
    top: number;
    height: number;
    paddingX: number;
    cardPaddingX: number;
    cardPaddingY: number;
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    eyebrow: SinglePostTextStyle;
    title: {
      style: SinglePostTextStyle;
      useBrandFont: boolean;
      maxWidth: number;
      // Vertical gap from the bottom of the eyebrow to the top of the title.
      gapAboveTitle: number;
    };
    caption: {
      style: SinglePostTextStyle;
      maxWidth: number;
      // Vertical gap from the bottom of the title to the top of the caption.
      gapAboveCaption: number;
    };
    iconSize: number;
    // Horizontal padding from the hero's outer right edge to the icon/temp
    // column. Increase to push the icon and temp readout further from the edge.
    rightInset: number;
    // Horizontal offset from `rightInset` (positive = further left) for the
    // weather icon. Independent of the temp text so they can be tuned apart.
    iconLeftOfTextOffset: number;
    // Vertical offset from the hero centre line for the temp range readout.
    tempRangeYOffset: number;
    // Vertical gap below the temp range to the small "SUHU NASIONAL" label.
    tempLabelGap: number;
    // Independent horizontal nudge for "SUHU NASIONAL" only, in pixels.
    // Negative = further left of the right column anchor; positive = right.
    tempLabelXOffset: number;
    tempRange: SinglePostTextStyle;
    tempLabel: SinglePostTextStyle;
  };
  grid: {
    top: number;
    paddingX: number;
    paddingBottom: number;
    gapX: number;
    gapY: number;
    cols: number;
    rows: number;
  };
  card: {
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    paddingX: number;
    paddingTop: number;
    paddingBottom: number;
    iconSize: number;
    stateName: { style: SinglePostTextStyle; useBrandFont: boolean };
    when: SinglePostTextStyle;
    // Explicit vertical gap from the bottom of the state name to the top of
    // the "summary_when" small-caps label. Replaces an earlier dynamic
    // calc that always reserved space for two state-name lines.
    whenGapAboveWhen: number;
    avgTemp: SinglePostTextStyle;
    avgLabel: SinglePostTextStyle;
    minMaxRow: SinglePostTextStyle;
    minMaxLabel: SinglePostTextStyle;
    // Horizontal offset (px from card's inner-left edge) for the "MIN" column.
    minColumnX: number;
    // Horizontal offset (px from card's inner-left edge) for the "MAX" column.
    maxColumnX: number;
    // Gap (px) from a label ("MIN" / "MAX") to its numeric value.
    minMaxLabelValueGap: number;
    forecast: SinglePostTextStyle;
  };
  footer: {
    bottomOffset: number;
    paddingX: number;
    leftText: string;
    rightText: string;
    style: SinglePostTextStyle;
  };
}

export const DEFAULT_WEATHER_SINGLE_POST_CONFIG: WeatherSinglePostCanvasConfig =
  {
    canvas: {
      width: 1080,
      height: 1350,
      backgroundColor: "#0F172A",
    },
    background: {
      gradient: {
        angleDeg: 160,
        stops: [
          { offset: 0, color: "#0F172A" },
          { offset: 0.4, color: "#1E293B" },
          { offset: 1, color: "#334155" },
        ],
      },
      orbs: [
        // Top purple glow (approximates V2b's bgBlur)
        { cx: 540, cy: -120, rx: 600, ry: 360, fill: "#8B5CF6", opacity: 0.18 },
        // Bottom-right cyan glow (approximates V2b's bgBlur2)
        { cx: 980, cy: 1200, rx: 360, ry: 360, fill: "#38BDF8", opacity: 0.12 },
      ],
    },
    header: {
      paddingTop: 48,
      paddingX: 48,
      logo: { width: 90, useBrandLogo: true },
      eyebrow: {
        text: "",
        style: {
          fontFamily: "Inter",
          fontSize: 13,
          fontWeight: 600,
          fill: "rgba(255,255,255,0.78)",
          textAlign: "left",
          uppercase: true,
          charSpacing: 280,
        },
      },
      brandDot: { size: 0, defaultColor: "#EF4444" },
      date: {
        dayStyle: {
          fontFamily: "Inter",
          fontSize: 12,
          fontWeight: 600,
          fill: "rgba(255,255,255,0.65)",
          textAlign: "right",
          uppercase: true,
          charSpacing: 440,
        },
        dateStyle: {
          fontFamily: "Inter",
          fontSize: 18,
          fontWeight: 700,
          fill: "#ffffff",
          textAlign: "right",
        },
      },
    },
    hero: {
      top: 130,
      height: 150,
      paddingX: 48,
      cardPaddingX: 32,
      cardPaddingY: 22,
      radius: 28,
      fill: "rgba(255,255,255,0.10)",
      stroke: "rgba(255,255,255,0.15)",
      strokeWidth: 1,
      eyebrow: {
        fontFamily: "Inter",
        fontSize: 11,
        fontWeight: 600,
        fill: "rgba(255,255,255,0.65)",
        textAlign: "left",
        uppercase: true,
        charSpacing: 500,
      },
      title: {
        useBrandFont: true,
        maxWidth: 540,
        gapAboveTitle: 14,
        style: {
          fontFamily: "Inter",
          fontSize: 38,
          fontWeight: 800,
          fill: "#ffffff",
          textAlign: "left",
          lineHeight: 1.05,
        },
      },
      caption: {
        maxWidth: 540,
        gapAboveCaption: 6,
        style: {
          fontFamily: "Inter",
          fontSize: 14,
          fontWeight: 400,
          fill: "rgba(255,255,255,0.72)",
          textAlign: "left",
          lineHeight: 1.4,
        },
      },
      iconSize: 84,
      rightInset: 32,
      iconLeftOfTextOffset: 220,
      tempRangeYOffset: -18,
      tempLabelGap: 50,
      tempLabelXOffset: -50,
      tempRange: {
        fontFamily: "Inter",
        fontSize: 44,
        fontWeight: 200,
        fill: "#ffffff",
        textAlign: "right",
        lineHeight: 1.0,
      },
      tempLabel: {
        fontFamily: "Inter",
        fontSize: 11,
        fontWeight: 600,
        fill: "rgba(255,255,255,0.6)",
        textAlign: "right",
        uppercase: true,
        charSpacing: 360,
      },
    },
    grid: {
      top: 332,
      paddingX: 48,
      paddingBottom: 60,
      gapX: 12,
      gapY: 12,
      cols: 4,
      rows: 4,
    },
    card: {
      radius: 20,
      fill: "rgba(255,255,255,0.10)",
      stroke: "rgba(255,255,255,0.12)",
      strokeWidth: 1,
      paddingX: 14,
      paddingTop: 16,
      paddingBottom: 14,
      iconSize: 44,
      stateName: {
        useBrandFont: true,
        style: {
          fontFamily: "Inter",
          fontSize: 20,
          fontWeight: 800,
          fill: "#ffffff",
          textAlign: "left",
          lineHeight: 1.05,
        },
      },
      when: {
        fontFamily: "Inter",
        fontSize: 10,
        fontWeight: 600,
        fill: "rgba(255,255,255,0.55)",
        textAlign: "left",
        uppercase: true,
        charSpacing: 240,
      },
      whenGapAboveWhen: 4,
      avgTemp: {
        fontFamily: "Inter",
        fontSize: 36,
        fontWeight: 300,
        fill: "#ffffff",
        textAlign: "left",
        lineHeight: 1.0,
      },
      avgLabel: {
        fontFamily: "Inter",
        fontSize: 10,
        fontWeight: 600,
        fill: "rgba(255,255,255,0.55)",
        textAlign: "left",
        uppercase: true,
        charSpacing: 120,
      },
      minMaxRow: {
        fontFamily: "Inter",
        fontSize: 12,
        fontWeight: 600,
        fill: "rgba(255,255,255,0.7)",
        textAlign: "left",
      },
      minMaxLabel: {
        fontFamily: "Inter",
        fontSize: 12,
        fontWeight: 600,
        fill: "rgba(255,255,255,0.5)",
        textAlign: "left",
        uppercase: true,
        charSpacing: 200,
      },
      minColumnX: 0,
      maxColumnX: 70,
      minMaxLabelValueGap: 36,
      forecast: {
        fontFamily: "Inter",
        fontSize: 14,
        fontWeight: 500,
        fill: "rgba(255,255,255,0.72)",
        textAlign: "left",
        lineHeight: 1.3,
      },
    },
    footer: {
      bottomOffset: 28,
      paddingX: 48,
      leftText: "Sumber · MET Malaysia",
      rightText: "",
      style: {
        fontFamily: "Inter",
        fontSize: 11,
        fontWeight: 600,
        fill: "rgba(255,255,255,0.55)",
        textAlign: "left",
        uppercase: true,
        charSpacing: 320,
      },
    },
  };
