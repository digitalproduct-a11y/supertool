// Quote Canvas Layout Config
// Adjust values here to change text positions, sizes, colors, fonts — no code changes needed.

export interface TextLayerStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fill: string;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
}

export interface QuoteCanvasConfig {
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  backgroundImage: {
    publicId: string;
    cloudName: string;
    scaleToFit: boolean;
  };
  layout: {
    paddingX: number;
    paddingY: number;
  };
  brandLogo: {
    enabled: boolean;
    width: number;
    x: number;
    y: number;
  };
  quoteMark: {
    enabled: boolean;
    text: string;
    style: TextLayerStyle;
    x: number;
    y: number;
  };
  quoteText: {
    style: TextLayerStyle;
    maxWidth: number;
    x: number;
    y: number;
  };
  authorName: {
    style: TextLayerStyle;
    x: number;
    offsetY: number; // offset below quote text bottom
  };
  authorTitle: {
    style: TextLayerStyle;
    x: number;
    offsetY: number; // offset below author name
  };
  cutoutImage: {
    enabled: boolean; // Master toggle — when false, skip BG removal entirely
    x: number;
    y: number;
    maxWidth: number;
    maxHeight: number;
    originX: "center" | "left" | "right";
    originY: "center" | "top" | "bottom";
    opacity: number;
  };
  // Dynamic font sizing based on quote length (character count).
  // Each tier defines a scale multiplier applied to quoteText fontSize.
  dynamicSizing: Array<{
    maxLength: number; // apply this tier when quote.length <= maxLength
    scale: number;
  }>;
}

export const DEFAULT_QUOTE_CANVAS_CONFIG: QuoteCanvasConfig = {
  canvas: {
    width: 1080,
    height: 1350,
    backgroundColor: "#1a1a2e",
  },
  backgroundImage: {
    publicId: "quote_bg_default_placeholder",
    cloudName: "dymmqtqyg",
    scaleToFit: true,
  },
  layout: {
    paddingX: 80,
    paddingY: 60,
  },
  brandLogo: {
    enabled: true,
    width: 120,
    x: 540, // center
    y: 1260,
  },
  quoteMark: {
    enabled: true,
    text: "\u201C", // left double quotation mark
    style: {
      fontFamily: "Georgia",
      fontSize: 180,
      fontWeight: "bold",
      fill: "rgba(255, 255, 255, 0.15)",
      textAlign: "center",
    },
    x: 540,
    y: 280,
  },
  quoteText: {
    style: {
      fontFamily: "Georgia",
      fontSize: 42,
      fontWeight: "normal",
      fill: "#ffffff",
      lineHeight: 1.45,
      textAlign: "center",
    },
    maxWidth: 900,
    x: 540,
    y: 500,
  },
  authorName: {
    style: {
      fontFamily: "Arial",
      fontSize: 28,
      fontWeight: "bold",
      fill: "#ffffff",
      textAlign: "center",
    },
    x: 540,
    offsetY: 50,
  },
  authorTitle: {
    style: {
      fontFamily: "Arial",
      fontSize: 22,
      fontWeight: "normal",
      fill: "rgba(255, 255, 255, 0.65)",
      textAlign: "center",
    },
    x: 540,
    offsetY: 12,
  },
  cutoutImage: {
    enabled: true,
    x: 540,
    y: 1200,
    maxWidth: 700,
    maxHeight: 800,
    originX: "center",
    originY: "bottom",
    opacity: 1,
  },
  dynamicSizing: [
    { maxLength: 80, scale: 1.3 },   // short quote
    { maxLength: 150, scale: 1.1 },  // medium
    { maxLength: 250, scale: 1.0 },  // normal
    { maxLength: 400, scale: 0.85 }, // long
    { maxLength: 9999, scale: 0.7 }, // very long
  ],
};
