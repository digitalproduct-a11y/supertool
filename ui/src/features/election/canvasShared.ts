// Shared Fabric.js helpers for the Election result canvases: font preloading,
// image loading, text factory, brand logo + eyebrow header, footer, and the
// imperative handle shape. Keeps the three card components lean.

import { FabricImage, Rect, StaticCanvas, Text } from "fabric";
import { BRAND_LOGO_URLS } from "../../constants/brands";
import {
  ELECTION_BG_TEMPLATES,
  ELECTION_CANVAS,
  ELECTION_FOOTER,
  ELECTION_HEADER,
  ELECTION_RULE,
  MEMILIH_BADGE_URL,
} from "../../config/electionCanvasConfig";

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
// text renders invisibly on the canvas. Also loads Noto Sans SC, the CJK
// fallback used by Chinese-language brands (e.g. Hotspot) — see text().
export async function preloadInter(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  if (!document.getElementById("election-noto-sc")) {
    const link = document.createElement("link");
    link.id = "election-noto-sc";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700;800;900&display=swap";
    document.head.appendChild(link);
  }
  try {
    await Promise.all([
      document.fonts.load("400 16px Inter"),
      document.fonts.load("500 18px Inter"),
      document.fonts.load("600 22px Inter"),
      document.fonts.load("700 28px Inter"),
      document.fonts.load("800 64px Inter"),
      document.fonts.load("900 120px Inter"),
      document.fonts.load('400 24px "Noto Sans SC"'),
      document.fonts.load('500 24px "Noto Sans SC"'),
      document.fonts.load('700 40px "Noto Sans SC"'),
      document.fonts.load('800 64px "Noto Sans SC"'),
      document.fonts.load('900 96px "Noto Sans SC"'),
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
    // Latin/digits resolve to Inter (metrics unchanged for existing brands);
    // any CJK glyph falls through to Noto Sans SC (Chinese brands e.g. Hotspot).
    fontFamily: `${ELECTION_CANVAS.font}, "Noto Sans SC"`,
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

/** Draws a thin horizontal rule spanning the padded content width. */
export function drawRule(
  canvas: StaticCanvas,
  y: number,
  color: string = ELECTION_RULE,
  thickness = 3,
): void {
  const x = ELECTION_CANVAS.paddingX;
  canvas.add(
    new Rect({
      left: x,
      top: y,
      width: ELECTION_CANVAS.width - x * 2,
      height: thickness,
      fill: color,
      selectable: false,
      evented: false,
    }),
  );
}

/** Draws a rounded progress bar: a full-width track with a proportional fill.
 *  `frac` is clamped to [0,1]; frac <= 0 renders the empty track only. */
export function drawProgressBar(
  canvas: StaticCanvas,
  x: number,
  y: number,
  width: number,
  height: number,
  frac: number,
  fillColor: string,
  trackColor: string = ELECTION_CANVAS.surface,
): void {
  const r = height / 2;
  canvas.add(
    new Rect({
      left: x,
      top: y,
      width,
      height,
      rx: r,
      ry: r,
      fill: trackColor,
      selectable: false,
      evented: false,
    }),
  );
  const clamped = Math.max(0, Math.min(1, frac));
  if (clamped > 0) {
    canvas.add(
      new Rect({
        left: x,
        top: y,
        width: Math.max(height, clamped * width),
        height,
        rx: r,
        ry: r,
        fill: fillColor,
        selectable: false,
        evented: false,
      }),
    );
  }
}

/** Draws the brand logo (left) + JOHOR MEMILIH badge (right) and a black rule
 *  beneath. Returns the y-coordinate just below the header rule.
 *
 *  When the brand has a full-canvas background template, that image already
 *  bakes in the banner/badge/logo, so this sets it as the canvas background and
 *  returns the templated content-start y — skipping the drawn chrome entirely. */
export async function drawHeader(canvas: StaticCanvas, brand: string): Promise<number> {
  const x = ELECTION_CANVAS.paddingX;
  const y = ELECTION_HEADER.paddingTop;

  const tpl = ELECTION_BG_TEMPLATES[brand];
  if (tpl) {
    try {
      const bg = await FabricImage.fromURL(tpl.url, { crossOrigin: "anonymous" });
      bg.scaleToWidth(ELECTION_CANVAS.width);
      bg.set({ left: 0, top: 0, originX: "left", originY: "top", selectable: false, evented: false });
      canvas.backgroundImage = bg;
    } catch {
      // proceed without background — content still draws on white
    }
    return tpl.contentTop;
  }

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

  // JOHOR MEMILIH campaign badge, top-right (same-origin asset from /public).
  let badgeBottom = y + 40;
  try {
    const badge = await FabricImage.fromURL(MEMILIH_BADGE_URL, { crossOrigin: "anonymous" });
    badge.scaleToWidth(ELECTION_HEADER.badgeWidth);
    badge.set({
      left: ELECTION_CANVAS.width - x,
      top: y,
      originX: "right",
      originY: "top",
      selectable: false,
      evented: false,
    });
    canvas.add(badge);
    badgeBottom = y + badge.getScaledHeight();
  } catch {
    // proceed without badge
  }

  const ruleY = Math.max(logoBottom, badgeBottom, y + 40) + 24;
  drawRule(canvas, ruleY);
  return ruleY + 40;
}

/** Draws the footer black rule plus a right-aligned stamp (and optional
 *  left-aligned stats line). For a templated brand the footer chrome is baked
 *  into the background, so the rule is skipped and the stamp/stats sit just
 *  above the baked footer band. */
export function drawFooter(canvas: StaticCanvas, rightText: string, leftText = "", brand = ""): void {
  const tpl = ELECTION_BG_TEMPLATES[brand];
  if (!tpl) {
    const ruleY = ELECTION_CANVAS.height - ELECTION_FOOTER.bottomOffset - 44;
    drawRule(canvas, ruleY);
  }
  const y = tpl ? tpl.footerY : ELECTION_CANVAS.height - ELECTION_FOOTER.bottomOffset;
  if (leftText) {
    canvas.add(
      text(leftText, {
        left: ELECTION_CANVAS.paddingX,
        top: y,
        size: ELECTION_FOOTER.size,
        weight: 600,
        fill: ELECTION_CANVAS.textMuted,
        originY: "bottom",
        uppercase: true,
        spacing: 1,
      }),
    );
  }
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

/** 12-hour Malaysia-time clock, no date, e.g. "5:50PM". */
export function formatTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const myt = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
    let h = myt.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(myt.getMinutes()).padStart(2, "0")}${ampm}`;
  } catch {
    return "";
  }
}
