// Shared Fabric.js helpers for the Election result canvases: font preloading,
// image loading, text factory, brand logo + eyebrow header, footer, and the
// imperative handle shape. Keeps the three card components lean.

import { FabricImage, StaticCanvas, Text } from "fabric";
import { BRAND_LOGO_URLS } from "../../constants/brands";
import { ELECTION_CANVAS, ELECTION_FOOTER, ELECTION_HEADER } from "../../config/electionCanvasConfig";

export interface ElectionCanvasHandle {
  downloadAsPng: (filename?: string) => void;
  getDataUrl: () => string | null;
}

export function loadHTMLImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    el.src = src;
  });
}

// Force the browser to load the Inter weights/sizes we draw before Fabric
// measures glyphs — without this, unloaded weights collapse to zero width and
// text renders invisibly on the canvas.
export async function preloadInter(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("400 16px Inter"),
      document.fonts.load("500 18px Inter"),
      document.fonts.load("600 22px Inter"),
      document.fonts.load("700 28px Inter"),
      document.fonts.load("800 64px Inter"),
      document.fonts.load("900 120px Inter"),
    ]);
  } catch {
    // proceed — Fabric falls back to the next font in the chain
  }
}

interface TextOpts {
  left: number;
  top: number;
  size?: number;
  weight?: string | number;
  fill?: string;
  align?: "left" | "center" | "right";
  originX?: "left" | "center" | "right";
  originY?: "top" | "center" | "bottom";
  spacing?: number; // px letter-spacing
  uppercase?: boolean;
}

export function text(content: string, o: TextOpts): Text {
  const size = o.size ?? 20;
  const weight = typeof o.weight === "number" && o.weight >= 700 ? "bold" : o.weight ?? "400";
  return new Text(o.uppercase ? content.toUpperCase() : content, {
    left: o.left,
    top: o.top,
    fontFamily: ELECTION_CANVAS.font,
    fontSize: size,
    fontWeight: String(weight),
    fill: o.fill ?? ELECTION_CANVAS.text,
    textAlign: o.align ?? "left",
    originX: o.originX ?? "left",
    originY: o.originY ?? "top",
    charSpacing: o.spacing ? (o.spacing * 1000) / size : 0,
    selectable: false,
    evented: false,
  });
}

/** Draws the brand logo (left) + eyebrow label (right of logo). Returns the
 *  y-coordinate just below the header band. */
export async function drawHeader(
  canvas: StaticCanvas,
  brand: string,
  eyebrow: string,
  accent: string,
): Promise<number> {
  const x = ELECTION_CANVAS.paddingX;
  const y = ELECTION_HEADER.paddingTop;
  let logoBottom = y + 40;

  const logoUrl = (BRAND_LOGO_URLS as Record<string, string>)[brand] ?? "";
  if (logoUrl) {
    try {
      const img = await FabricImage.fromURL(logoUrl, { crossOrigin: "anonymous" });
      img.scaleToWidth(ELECTION_HEADER.logoWidth);
      img.set({ left: x, top: y, originX: "left", originY: "top", selectable: false, evented: false });
      canvas.add(img);
      logoBottom = y + img.getScaledHeight();
    } catch {
      // proceed without logo
    }
  }

  // Eyebrow label, right-aligned, with an accent dot.
  canvas.add(
    text(eyebrow, {
      left: ELECTION_CANVAS.width - ELECTION_CANVAS.paddingX,
      top: y + 6,
      size: ELECTION_HEADER.eyebrowSize,
      weight: 700,
      fill: accent,
      originX: "right",
      spacing: ELECTION_HEADER.eyebrowSpacing,
      uppercase: true,
    }),
  );

  return Math.max(logoBottom, y + 40) + 28;
}

export function drawFooter(canvas: StaticCanvas, rightText: string): void {
  const y = ELECTION_CANVAS.height - ELECTION_FOOTER.bottomOffset;
  if (rightText) {
    canvas.add(
      text(rightText, {
        left: ELECTION_CANVAS.width - ELECTION_CANVAS.paddingX,
        top: y,
        size: ELECTION_FOOTER.size,
        weight: 500,
        fill: ELECTION_CANVAS.textFaint,
        originX: "right",
        originY: "bottom",
      }),
    );
  }
}

/** Format a Date-ish ISO string to "DD/MM HH:mm" in MYT for the live stamp. */
export function formatStamp(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const myt = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(myt.getDate())}/${pad(myt.getMonth() + 1)} ${pad(myt.getHours())}:${pad(myt.getMinutes())}`;
  } catch {
    return "";
  }
}
