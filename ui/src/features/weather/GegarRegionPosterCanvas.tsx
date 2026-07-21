import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";
import {
  StaticCanvas,
  FabricImage,
  Rect,
  Text,
  Textbox,
  Gradient,
} from "fabric";
import type { GegarRegion } from "../../hooks/useWeatherMalaysia";
import type { WeatherSinglePostCanvasHandle } from "./WeatherSinglePostCanvas";
import { BRAND_LOGO_IDS } from "../../constants/brands";
import { loadBrandFont } from "../../utils/brandFonts";
import { brandLogoUrl } from "../../utils/imageProvider";
import { WEATHER_ICON_PATHS, type WeatherIconKey } from "./weatherConditionMap";

interface GegarRegionPosterCanvasProps {
  region: GegarRegion;
  brand: string;
  date?: string;
  day?: string;
  fontUse?: string | null;
  brandColor?: string | null;
  onClick?: () => void;
}

// ─── Fixed FB-friendly 4:5 portrait (no feed cropping) ───────────────────────
const W = 1080;
const H = 1350;
const PADDING_X = 48;

const HERO_TOP = 124;
const HERO_H = 176;
const GRID_TOP = HERO_TOP + HERO_H + 20;
const GRID_BOTTOM = H - 72;
const COLS = 3;
const GAP_X = 14;
const GAP_Y = 14;
const CELL_W = (W - PADDING_X * 2 - GAP_X * (COLS - 1)) / COLS;
// Fixed row budget so district cards are the SAME size on every state poster.
// East-Coast states have up to 11 districts → 4 rows of 3; states with fewer
// (e.g. Terengganu, 8 → 3 rows) keep identical cards and leave bottom space.
const MAX_ROWS = 4;

function loadHTMLImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    el.src = src;
  });
}

// Fabric v6 mishandles numeric weights when the exact face isn't loaded; clamp
// to strings present in our @import and collapse 700+ to "bold".
function normaliseFontWeight(weight: string | number): string {
  if (typeof weight === "string") return weight;
  if (weight >= 700) return "bold";
  if (weight <= 300) return "300";
  return String(weight);
}

interface TextStyle {
  fontFamily?: string;
  fontSize: number;
  fontWeight: string | number;
  fill: string;
  lineHeight?: number;
  charSpacing?: number;
  uppercase?: boolean;
}

function makeText(
  content: string,
  style: TextStyle,
  opts: {
    left: number;
    top: number;
    originX?: "left" | "center" | "right";
    originY?: "top" | "center" | "bottom";
    fontFamily?: string;
  },
): Text {
  return new Text(style.uppercase ? content.toUpperCase() : content, {
    left: opts.left,
    top: opts.top,
    fontFamily: opts.fontFamily ?? style.fontFamily ?? "Inter",
    fontSize: style.fontSize,
    fontWeight: normaliseFontWeight(style.fontWeight),
    fill: style.fill,
    lineHeight: style.lineHeight ?? 1.16,
    charSpacing: style.charSpacing ?? 0,
    originX: opts.originX ?? "left",
    originY: opts.originY ?? "top",
    selectable: false,
    evented: false,
  });
}

function makeTextbox(
  content: string,
  style: TextStyle,
  opts: { left: number; top: number; width: number; fontFamily?: string },
): Textbox {
  return new Textbox(style.uppercase ? content.toUpperCase() : content, {
    left: opts.left,
    top: opts.top,
    width: opts.width,
    fontFamily: opts.fontFamily ?? style.fontFamily ?? "Inter",
    fontSize: style.fontSize,
    fontWeight: normaliseFontWeight(style.fontWeight),
    fill: style.fill,
    lineHeight: style.lineHeight ?? 1.2,
    charSpacing: style.charSpacing ?? 0,
    splitByGrapheme: false,
    selectable: false,
    evented: false,
  });
}

// CSS linear-gradient(160deg) → Fabric pixel coords (mirrors single-post canvas).
function build160LinearCoords(width: number, height: number) {
  const angleRad = (160 * Math.PI) / 180;
  const dx = Math.sin(angleRad);
  const dy = -Math.cos(angleRad);
  const cx = width / 2;
  const cy = height / 2;
  const halfDiag = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  return {
    x1: cx - dx * halfDiag,
    y1: cy - dy * halfDiag,
    x2: cx + dx * halfDiag,
    y2: cy + dy * halfDiag,
  };
}

function safeIconScale(img: HTMLImageElement, target: number): number {
  const w = img.naturalWidth || img.width || target;
  const h = img.naturalHeight || img.height || target;
  const longest = Math.max(w, h);
  return longest > 0 ? target / longest : 1;
}

const ICON_KEYS: WeatherIconKey[] = ["sun", "rain", "thunder", "haze"];

export const GegarRegionPosterCanvas = forwardRef<
  WeatherSinglePostCanvasHandle,
  GegarRegionPosterCanvasProps
>(function GegarRegionPosterCanvas(
  { region, brand, date, day, fontUse, brandColor, onClick },
  ref,
) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<StaticCanvas | null>(null);
  const [ready, setReady] = useState(false);

  const renderCanvas = useCallback(
    async (canvas: StaticCanvas) => {
      canvas.clear();
      canvas.backgroundColor = "#0F172A";
      const brandFamily = await loadBrandFont(fontUse);

      try {
        if (typeof document !== "undefined" && document.fonts) {
          await Promise.all([
            document.fonts.load("300 36px Inter"),
            document.fonts.load("400 14px Inter"),
            document.fonts.load("600 12px Inter"),
            document.fonts.load("bold 56px Inter"),
            ...(brandFamily
              ? [document.fonts.load(`bold 56px "${brandFamily}"`)]
              : []),
          ]);
        }
      } catch {
        // proceed — Fabric falls back to the next font in the chain
      }

      // ── Background gradient + decorative orbs ───────────────────────────
      canvas.add(
        new Rect({
          left: 0,
          top: 0,
          width: W,
          height: H,
          fill: new Gradient({
            type: "linear",
            gradientUnits: "pixels",
            coords: build160LinearCoords(W, H),
            colorStops: [
              { offset: 0, color: "#0F172A" },
              { offset: 0.4, color: "#1E293B" },
              { offset: 1, color: "#334155" },
            ],
          }),
          selectable: false,
          evented: false,
        }),
      );
      const orbs = [
        { cx: 540, cy: -120, r: 520, fill: "#8B5CF6", opacity: 0.18 },
        { cx: 980, cy: H - 180, r: 360, fill: "#38BDF8", opacity: 0.12 },
      ];
      for (const orb of orbs) {
        const d = orb.r * 2;
        canvas.add(
          new Rect({
            left: orb.cx - orb.r,
            top: orb.cy - orb.r,
            width: d,
            height: d,
            fill: new Gradient({
              type: "radial",
              gradientUnits: "pixels",
              coords: { x1: orb.r, y1: orb.r, r1: 0, x2: orb.r, y2: orb.r, r2: orb.r },
              colorStops: [
                { offset: 0, color: orb.fill },
                { offset: 1, color: "rgba(255,255,255,0)" },
              ],
            }),
            opacity: orb.opacity,
            selectable: false,
            evented: false,
          }),
        );
      }

      // ── Preload icons ───────────────────────────────────────────────────
      const iconCache = new Map<WeatherIconKey, HTMLImageElement>();
      await Promise.all(
        ICON_KEYS.map(async (k) => {
          try {
            iconCache.set(k, await loadHTMLImage(WEATHER_ICON_PATHS[k]));
          } catch (err) {
            console.warn(`[gegar-weather] icon load failed: ${k}`, err);
          }
        }),
      );

      const leftX = PADDING_X;
      const rightX = W - PADDING_X;

      // ── Header: brand logo (left) ←→ eyebrow + day/date (right) ─────────
      const headerY = 48;
      const headerCenterY = headerY + 20;
      if (brand) {
        const logoId = BRAND_LOGO_IDS[brand as keyof typeof BRAND_LOGO_IDS] ?? "";
        if (logoId) {
          try {
            const logoImg = await FabricImage.fromURL(
              brandLogoUrl(logoId),
              { crossOrigin: "anonymous" },
            );
            logoImg.scaleToWidth(96);
            logoImg.set({ left: leftX, top: headerCenterY, originX: "left", originY: "center", selectable: false, evented: false });
            canvas.add(logoImg);
          } catch {
            // proceed without logo
          }
        }
      }

      const eyebrowStyle: TextStyle = { fontSize: 12, fontWeight: 600, fill: "rgba(255,255,255,0.6)", uppercase: true, charSpacing: 340 };
      const dayStyle: TextStyle = { fontSize: 12, fontWeight: 600, fill: "rgba(255,255,255,0.65)", uppercase: true, charSpacing: 320 };
      const dateStyle: TextStyle = { fontSize: 18, fontWeight: 700, fill: "#ffffff" };
      const RIGHT_BUFFER = 4;
      if (day) {
        const t = makeText(day, dayStyle, { left: 0, top: headerY, originX: "left" });
        (t as unknown as { initDimensions: () => void }).initDimensions();
        t.set({ left: rightX - t.getScaledWidth() - RIGHT_BUFFER });
        canvas.add(t);
      }
      if (date) {
        const [yr, mo, dy] = date.split("-");
        const formatted = yr && mo && dy ? `${dy}/${mo}/${yr}` : date;
        const t = makeText(formatted, dateStyle, { left: 0, top: headerY + 18, originX: "left" });
        (t as unknown as { initDimensions: () => void }).initDimensions();
        t.set({ left: rightX - t.getScaledWidth() - RIGHT_BUFFER });
        canvas.add(t);
      }
      canvas.add(makeText("Ramalan Cuaca Daerah", eyebrowStyle, { left: leftX, top: headerY + 56 }));

      // ── Hero strip ──────────────────────────────────────────────────────
      const heroW = W - PADDING_X * 2;
      canvas.add(
        new Rect({ left: leftX, top: HERO_TOP, width: heroW, height: HERO_H, rx: 28, ry: 28, fill: "rgba(255,255,255,0.10)", stroke: "rgba(255,255,255,0.15)", strokeWidth: 1, selectable: false, evented: false }),
      );
      const accent = brandColor && brandColor.toLowerCase() !== "#000000" ? brandColor : "#00E5D4";
      canvas.add(
        new Rect({ left: leftX, top: HERO_TOP + 28, width: 6, height: HERO_H - 56, rx: 3, ry: 3, fill: accent, selectable: false, evented: false }),
      );

      const heroInnerLeft = leftX + 38;
      const heroInnerTop = HERO_TOP + 30;
      canvas.add(makeText("Negeri", { fontSize: 12, fontWeight: 600, fill: "rgba(255,255,255,0.55)", uppercase: true, charSpacing: 420 }, { left: heroInnerLeft, top: heroInnerTop }));
      canvas.add(
        makeText(region.state, { fontSize: 56, fontWeight: 800, fill: "#ffffff", lineHeight: 1.0 }, {
          left: heroInnerLeft,
          top: heroInnerTop + 22,
          fontFamily: brandFamily || undefined,
        }),
      );
      canvas.add(
        makeTextbox(region.hero.headline, { fontSize: 17, fontWeight: 600, fill: "rgba(255,255,255,0.78)" }, {
          left: heroInnerLeft,
          top: heroInnerTop + 100,
          width: 540,
        }),
      );

      // Hero right column: icon + temp range + label
      const heroRightX = leftX + heroW - 40;
      const heroIcon = iconCache.get(region.hero.hero_icon_key);
      if (heroIcon) {
        const img = new FabricImage(heroIcon, { originX: "right", originY: "center", left: heroRightX - 180, top: HERO_TOP + HERO_H / 2, selectable: false, evented: false });
        img.scale(safeIconScale(heroIcon, 96));
        canvas.add(img);
      }
      const tempTop = HERO_TOP + HERO_H / 2 - 24;
      canvas.add(makeText(`${region.hero.min}° – ${region.hero.max}°`, { fontSize: 44, fontWeight: 200, fill: "#ffffff", lineHeight: 1.0 }, { left: heroRightX, top: tempTop, originX: "right" }));
      canvas.add(makeText("Julat Suhu", { fontSize: 11, fontWeight: 600, fill: "rgba(255,255,255,0.55)", uppercase: true, charSpacing: 320 }, { left: heroRightX, top: tempTop + 52, originX: "right" }));

      // ── District grid (3 cols, fills the remaining height) ──────────────
      const districts = region.districts;
      const gridH = GRID_BOTTOM - GRID_TOP;
      // Card height fixed against MAX_ROWS so it matches across all 3 posters.
      const cellH = (gridH - GAP_Y * (MAX_ROWS - 1)) / MAX_ROWS;

      const cardName: TextStyle = { fontSize: 24, fontWeight: 800, fill: "#ffffff", lineHeight: 1.05 };
      const cardWhen: TextStyle = { fontSize: 11, fontWeight: 600, fill: "rgba(255,255,255,0.5)", uppercase: true, charSpacing: 200 };
      const cardAvg: TextStyle = { fontSize: 40, fontWeight: 300, fill: "#ffffff", lineHeight: 1.0 };
      const cardMinMaxLabel: TextStyle = { fontSize: 11, fontWeight: 600, fill: "rgba(255,255,255,0.5)", uppercase: true, charSpacing: 160 };
      const cardMinMaxValue: TextStyle = { fontSize: 13, fontWeight: 600, fill: "rgba(255,255,255,0.72)" };
      const cardForecast: TextStyle = { fontSize: 13, fontWeight: 500, fill: "rgba(255,255,255,0.7)", lineHeight: 1.3 };

      districts.forEach((d, idx) => {
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        const cellX = PADDING_X + col * (CELL_W + GAP_X);
        const cellY = GRID_TOP + row * (cellH + GAP_Y);

        canvas.add(
          new Rect({ left: cellX, top: cellY, width: CELL_W, height: cellH, rx: 20, ry: 20, fill: "rgba(255,255,255,0.10)", stroke: "rgba(255,255,255,0.12)", strokeWidth: 1, selectable: false, evented: false }),
        );

        const cPadX = 18;
        const innerX = cellX + cPadX;
        const innerRight = cellX + CELL_W - cPadX;
        const innerBottom = cellY + cellH - 16;

        // Top-right icon
        const cellIcon = iconCache.get(d.icon_key);
        if (cellIcon) {
          const img = new FabricImage(cellIcon, { originX: "right", originY: "top", left: innerRight, top: cellY + 18, selectable: false, evented: false });
          img.scale(safeIconScale(cellIcon, 46));
          canvas.add(img);
        }

        // District name (brand font) + when
        const nameW = Math.max(80, CELL_W - cPadX * 2 - 54);
        canvas.add(
          makeTextbox(d.name, cardName, { left: innerX, top: cellY + 18, width: nameW, fontFamily: brandFamily || undefined }),
        );
        if (d.summary_when) {
          canvas.add(makeText(d.summary_when, cardWhen, { left: innerX, top: cellY + 54 }));
        }

        // Bottom-anchored: forecast label
        const forecastTop = innerBottom - 32;
        canvas.add(
          makeTextbox(d.summary_forecast, cardForecast, { left: innerX, top: forecastTop, width: CELL_W - cPadX * 2 }),
        );

        // min/max row above forecast
        const minMaxY = forecastTop - 24;
        canvas.add(makeText("min", cardMinMaxLabel, { left: innerX, top: minMaxY }));
        canvas.add(makeText(`${d.min_temp}°`, cardMinMaxValue, { left: innerX + 42, top: minMaxY }));
        canvas.add(makeText("max", cardMinMaxLabel, { left: innerX + 88, top: minMaxY }));
        canvas.add(makeText(`${d.max_temp}°`, cardMinMaxValue, { left: innerX + 130, top: minMaxY }));

        // Avg temp big, above min/max
        canvas.add(makeText(`${d.avg_temp}°`, cardAvg, { left: innerX, top: minMaxY - 50 }));
      });

      // ── Footer ───────────────────────────────────────────────────────────
      const footerStyle: TextStyle = { fontSize: 11, fontWeight: 600, fill: "rgba(255,255,255,0.55)", uppercase: true, charSpacing: 320 };
      const footerY = H - 28;
      canvas.add(makeText("Sumber · MET Malaysia", footerStyle, { left: PADDING_X, top: footerY, originY: "bottom" }));
      canvas.add(makeText(brand, footerStyle, { left: W - PADDING_X, top: footerY, originX: "right", originY: "bottom" }));

      canvas.requestRenderAll();
      canvas.renderAll();
      setReady(true);
    },
    [region, brand, date, day, fontUse, brandColor],
  );

  useEffect(() => {
    if (!canvasElRef.current) return;

    canvasElRef.current.width = W;
    canvasElRef.current.height = H;

    const canvas = new StaticCanvas(canvasElRef.current, {
      width: W,
      height: H,
      backgroundColor: "#0F172A",
    });
    fabricRef.current = canvas;

    let cancelled = false;
    renderCanvas(canvas).then(() => {
      if (cancelled) return;
      const el = canvasElRef.current;
      if (el) {
        el.style.width = "100%";
        el.style.height = "100%";
      }
    });

    return () => {
      cancelled = true;
      canvas.dispose();
      fabricRef.current = null;
      setReady(false);
    };
  }, [renderCanvas]);

  useImperativeHandle(ref, () => ({
    downloadAsPng() {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `weather-gegar-${region.state.toLowerCase()}-${date ?? "today"}.png`;
      link.click();
    },
    getDataUrl() {
      const canvas = fabricRef.current;
      if (!canvas) return null;
      return canvas.toDataURL({ format: "png", multiplier: 2 });
    },
  }));

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`w-full overflow-hidden rounded-xl border border-neutral-200${onClick ? " cursor-pointer hover:opacity-90 transition" : ""}`}
        style={{ maxWidth: 360, aspectRatio: `${W} / ${H}` }}
        onClick={onClick}
      >
        <canvas
          ref={canvasElRef}
          width={W}
          height={H}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
        {!ready && (
          <div className="flex items-center justify-center h-64 text-sm text-neutral-400">
            Rendering preview…
          </div>
        )}
      </div>
    </div>
  );
});
