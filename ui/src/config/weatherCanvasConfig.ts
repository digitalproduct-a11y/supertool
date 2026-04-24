// Weather Canvas Layout Config
// Adjust values here to change text positions, sizes, colors, fonts — no code changes needed.

export interface TextLayerStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fill: string;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
}

export interface WeatherCanvasConfig {
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
    mode: "list" | "grid";
    columns: number; // only used in grid mode
    paddingX: number;
    paddingY: number;
    gapY: number;
    startY: number;
    rowHeight: number; // fixed row height for list mode
  };
  title: {
    enabled: boolean;
    text: string;
    style: TextLayerStyle;
    x: number;
    y: number;
  };
  dateHeader: {
    enabled: boolean;
    style: TextLayerStyle;
    x: number;
    y: number;
  };
  dayHeader: {
    enabled: boolean;
    style: TextLayerStyle;
    x: number;
    y: number;
  };
  brandLogo: {
    enabled: boolean;
    width: number;
    x: number;
    y: number;
  };
  // Dynamic sizing: scale text/rows based on post count.
  // Each tier defines a scale multiplier applied to font sizes and row height.
  dynamicSizing: Array<{
    maxCount: number; // apply this tier when posts.length <= maxCount
    scale: number; // multiplier for fontSize and rowHeight
  }>;
  stateBlock: {
    locationName: TextLayerStyle;
    forecast: TextLayerStyle;
    temperature: TextLayerStyle;
    backgroundBox: {
      enabled: boolean;
      fill: string;
      stroke: string;
      strokeWidth: number;
      rx: number;
      ry: number;
      padding: number;
    };
  };
}

// Weather-to-background mapping for grouped mode.
// Order matters: first match wins. Check "ribut" before "hujan" to avoid
// "tiada hujan" matching the "hujan" rule.
export interface WeatherBackgroundRule {
  contains: string;
  publicId: string;
  label: string;
}

export interface WeatherBackgroundsConfig {
  rules: WeatherBackgroundRule[];
  defaultPublicId: string;
  defaultLabel: string;
}

export const DEFAULT_WEATHER_BACKGROUNDS: WeatherBackgroundsConfig = {
  rules: [
    {
      contains: "ribut",
      publicId: "thunderstorm_dxv9fo",
      label: "Ribut Petir",
    },
    { contains: "tiada hujan", publicId: "sunny_zwwu5l", label: "Tiada Hujan" },
    { contains: "hujan", publicId: "rainy_yzh6iu", label: "Hujan" },
  ],
  defaultPublicId: "sunny_zwwu5l",
  defaultLabel: "Cerah",
};

export const DEFAULT_WEATHER_CANVAS_CONFIG: WeatherCanvasConfig = {
  canvas: {
    width: 1080,
    height: 1350,
    backgroundColor: "#1a1a2e",
  },
  backgroundImage: {
    publicId: "Today_s_Weather_xv2kjd",
    cloudName: "dymmqtqyg",
    scaleToFit: true,
  },
  layout: {
    mode: "list",
    columns: 4,
    paddingX: 50,
    paddingY: 30,
    gapY: 6,
    startY: 150,
    rowHeight: 62,
  },
  title: {
    enabled: true,
    text: "Ramalan Cuaca Malaysia",
    style: {
      fontFamily: "Arial",
      fontSize: 42,
      fontWeight: "bold",
      fill: "#ffffff",
      textAlign: "center",
    },
    x: 540,
    y: 100,
  },
  dateHeader: {
    enabled: true,
    style: {
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: "normal",
      fill: "#ffffff",
      textAlign: "center",
    },
    x: 540,
    y: 150,
  },
  dayHeader: {
    enabled: true,
    style: {
      fontFamily: "Arial",
      fontSize: 20,
      fontWeight: "normal",
      fill: "#cccccc",
      textAlign: "center",
    },
    x: 540,
    y: 180,
  },
  brandLogo: {
    enabled: true,
    width: 150,
    x: 540,
    y: 1220,
  },
  dynamicSizing: [
    { maxCount: 1, scale: 3.0 }, // 1 state  — 3x bigger
    { maxCount: 3, scale: 2.2 }, // 2-3 states
    { maxCount: 5, scale: 1.6 }, // 4-5 states
    { maxCount: 10, scale: 1.2 }, // 6-10 states
    { maxCount: 16, scale: 1.0 }, // 11-16 states — base size
  ],
  stateBlock: {
    locationName: {
      fontFamily: "Arial",
      fontSize: 22,
      fontWeight: "bold",
      fill: "#ffffff",
      textAlign: "left",
    },
    forecast: {
      fontFamily: "Arial",
      fontSize: 16,
      fontWeight: "normal",
      fill: "#e0e0e0",
      textAlign: "left",
    },
    temperature: {
      fontFamily: "Arial",
      fontSize: 20,
      fontWeight: "bold",
      fill: "#ffcc00",
      textAlign: "right",
    },
    backgroundBox: {
      enabled: true,
      fill: "transparent",
      stroke: "#ffffff",
      strokeWidth: 1,
      rx: 8,
      ry: 8,
      padding: 14,
    },
  },
};
