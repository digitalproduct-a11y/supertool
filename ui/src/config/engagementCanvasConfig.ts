// Engagement post canvas layout — config-driven so all sport topics render
// through one Fabric component (EngagementPostCanvas). Values for EPL/UCL are
// derived from the retired Cloudinary `buildPreviewUrl` (l_text) so the client
// render matches the previous server-composed design.
//
// Coordinate model: 1080x1350 canvas. Text/logo `y` is measured from the anchor
// edge (top or bottom). Fine-tune these during in-app visual QA.

export interface EngagementTextLayer {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  maxWidth: number;
  anchor: "top" | "bottom";
  /** distance (px) from the anchor edge to the layer's top */
  y: number;
}

export interface EngagementCanvasConfig {
  width: number;
  height: number;
  /** photo fill focus: face-aware (fo-face/g_face) or content-aware smart crop (fo-auto/g_auto) */
  photoCrop: "face" | "auto";
  /** bottom→up darkening overlay for text legibility */
  gradient: { startFraction: number; from: string; to: string };
  logo: { position: "top-right" | "bottom-center"; width: number; margin: number };
  headline: EngagementTextLayer;
  subtitle: EngagementTextLayer;
  /** optional gold kicker (e.g. post type) above the headline */
  typeLabel?: Omit<EngagementTextLayer, "fontWeight"> & { fontWeight?: number };
}

// Each topic has its OWN config object so tweaking one never affects another.
// EPL/UCL start identical (bottom-center logo, dark fade, headline @y900); Badminton/
// MotoGP start identical (top-right logo, black→blue gradient, text near the bottom).
// Edit any block below independently.

const EPL_CANVAS: EngagementCanvasConfig = {
  width: 1080,
  height: 1350,
  photoCrop: "auto",
  // Approximates Cloudinary `l_black_fade` — transparent upper, dark lower third.
  gradient: { startFraction: 0.35, from: "rgba(0,0,0,0)", to: "rgba(0,0,0,0.85)" },
  logo: { position: "bottom-center", width: 150, margin: 35 },
  headline: { fontFamily: "Montserrat", fontSize: 90, fontWeight: 700, fill: "#FFFFFF", maxWidth: 900, anchor: "top", y: 900 },
  subtitle: { fontFamily: "Montserrat", fontSize: 38, fontWeight: 400, fill: "#FFFFFF", maxWidth: 850, anchor: "top", y: 1100 },
};

const UCL_CANVAS: EngagementCanvasConfig = {
  width: 1080,
  height: 1350,
  photoCrop: "auto",
  gradient: { startFraction: 0.35, from: "rgba(0,0,0,0)", to: "rgba(0,0,0,0.85)" },
  logo: { position: "bottom-center", width: 150, margin: 35 },
  headline: { fontFamily: "Montserrat", fontSize: 90, fontWeight: 700, fill: "#FFFFFF", maxWidth: 900, anchor: "top", y: 900 },
  subtitle: { fontFamily: "Montserrat", fontSize: 38, fontWeight: 400, fill: "#FFFFFF", maxWidth: 850, anchor: "top", y: 1100 },
};

const BADMINTON_CANVAS: EngagementCanvasConfig = {
  width: 1080,
  height: 1350,
  photoCrop: "auto",
  gradient: { startFraction: 0.3, from: "rgba(0,0,0,0)", to: "rgba(0,13,26,1)" },
  logo: { position: "top-right", width: 150, margin: 20 },
  headline: { fontFamily: "Montserrat", fontSize: 64, fontWeight: 900, fill: "#FFFFFF", maxWidth: 900, anchor: "bottom", y: 300 },
  subtitle: { fontFamily: "Montserrat", fontSize: 36, fontWeight: 300, fill: "#FFFFFF", maxWidth: 900, anchor: "bottom", y: 220 },
};

const MOTOGP_CANVAS: EngagementCanvasConfig = {
  width: 1080,
  height: 1350,
  photoCrop: "auto",
  gradient: { startFraction: 0.3, from: "rgba(0,0,0,0)", to: "rgba(0,13,26,1)" },
  logo: { position: "top-right", width: 150, margin: 20 },
  headline: { fontFamily: "Montserrat", fontSize: 64, fontWeight: 900, fill: "#FFFFFF", maxWidth: 900, anchor: "bottom", y: 300 },
  subtitle: { fontFamily: "Montserrat", fontSize: 36, fontWeight: 300, fill: "#FFFFFF", maxWidth: 900, anchor: "bottom", y: 220 },
};

export const ENGAGEMENT_CANVAS_CONFIGS: Record<string, EngagementCanvasConfig> = {
  epl: EPL_CANVAS,
  ucl: UCL_CANVAS,
  badminton: BADMINTON_CANVAS,
  motogp: MOTOGP_CANVAS,
};

export function getEngagementCanvasConfig(topic: string): EngagementCanvasConfig {
  return ENGAGEMENT_CANVAS_CONFIGS[topic] ?? EPL_CANVAS;
}
