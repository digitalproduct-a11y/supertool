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
  Circle,
  Gradient,
} from "fabric";
import type { WeatherPost } from "../../hooks/useWeatherMalaysia";
import { BRAND_LOGO_IDS } from "../../constants/brands";
import { loadBrandFont } from "../../utils/brandFonts";
import { brandLogoUrl } from "../../utils/imageProvider";
import {
  DEFAULT_WEATHER_SINGLE_POST_CONFIG,
  type WeatherSinglePostCanvasConfig,
  type SinglePostTextStyle,
} from "../../config/weatherSinglePostCanvasConfig";
import { WEATHER_ICON_PATHS, type WeatherIconKey } from "./weatherConditionMap";
import {
  adaptWeatherToCanvas,
  type NationalSummary,
  type CanvasStateCell,
} from "./weatherDataAdapter";

export interface WeatherSinglePostCanvasHandle {
  downloadAsPng: () => void;
  getDataUrl: () => string | null;
}

interface WeatherSinglePostCanvasProps {
  posts: WeatherPost[];
  brand: string;
  fontUse?: string | null;
  brandColor?: string | null;
  nationalSummary?: NationalSummary | null;
  config?: WeatherSinglePostCanvasConfig;
  onClick?: () => void;
}

function loadHTMLImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    el.src = src;
  });
}

function applyCase(text: string, style: SinglePostTextStyle): string {
  return style.uppercase ? text.toUpperCase() : text;
}

// Fabric.js v6 handles numeric fontWeights inconsistently when the font face
// for that weight isn't loaded. Convert to string and clamp to weights present
// in our @import (100-600); collapse 700+ to "bold" (the browser will faux-bold
// from the nearest loaded weight).
function normaliseFontWeight(weight: string | number): string {
  if (typeof weight === "string") return weight;
  if (weight >= 700) return "bold";
  if (weight <= 300) return "300";
  return String(weight);
}

function makeStyledText(
  content: string,
  style: SinglePostTextStyle,
  opts: {
    left: number;
    top: number;
    originX?: "left" | "center" | "right";
    originY?: "top" | "center" | "bottom";
    fontFamily?: string;
  },
): Text {
  return new Text(applyCase(content, style), {
    left: opts.left,
    top: opts.top,
    fontFamily: opts.fontFamily ?? style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: normaliseFontWeight(style.fontWeight),
    fill: style.fill,
    textAlign: style.textAlign ?? "left",
    lineHeight: style.lineHeight ?? 1.16,
    charSpacing: style.charSpacing ?? 0,
    originX: opts.originX ?? "left",
    originY: opts.originY ?? "top",
    selectable: false,
    evented: false,
  });
}

function makeStyledTextbox(
  content: string,
  style: SinglePostTextStyle,
  opts: {
    left: number;
    top: number;
    width: number;
    originX?: "left" | "center" | "right";
    fontFamily?: string;
  },
): Textbox {
  return new Textbox(applyCase(content, style), {
    left: opts.left,
    top: opts.top,
    width: opts.width,
    fontFamily: opts.fontFamily ?? style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: normaliseFontWeight(style.fontWeight),
    fill: style.fill,
    textAlign: style.textAlign ?? "left",
    lineHeight: style.lineHeight ?? 1.16,
    charSpacing: style.charSpacing ?? 0,
    originX: opts.originX ?? "left",
    splitByGrapheme: false,
    selectable: false,
    evented: false,
  });
}

// CSS `linear-gradient(160deg, …)` direction vector. CSS angle is clockwise
// from the +Y axis; 160° leans top-left → bottom-right. Map to Fabric's pixel
// coords by projecting the unit vector onto the canvas extents.
function build160LinearCoords(
  W: number,
  H: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const angleRad = (160 * Math.PI) / 180;
  const dx = Math.sin(angleRad);
  const dy = -Math.cos(angleRad); // CSS convention: 0deg points up
  // Project the canvas diagonal onto the gradient direction so the gradient
  // line spans the full visible range.
  const cx = W / 2;
  const cy = H / 2;
  const halfDiag = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
  return {
    x1: cx - dx * halfDiag,
    y1: cy - dy * halfDiag,
    x2: cx + dx * halfDiag,
    y2: cy + dy * halfDiag,
  };
}

export const WeatherSinglePostCanvas = forwardRef<
  WeatherSinglePostCanvasHandle,
  WeatherSinglePostCanvasProps
>(function WeatherSinglePostCanvas(
  {
    posts,
    brand,
    fontUse,
    brandColor,
    nationalSummary,
    config: configProp,
    onClick,
  },
  ref,
) {
  const config = configProp ?? DEFAULT_WEATHER_SINGLE_POST_CONFIG;
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<StaticCanvas | null>(null);
  const [ready, setReady] = useState(false);

  const renderCanvas = useCallback(
    async (canvas: StaticCanvas) => {
      canvas.clear();
      canvas.backgroundColor = config.canvas.backgroundColor;
      const brandFamily = await loadBrandFont(fontUse);

      // Force the browser to load the Inter weights we use before Fabric draws
      // — without this, canvas glyph metrics for unloaded weights collapse to
      // zero width and the text renders invisibly.
      try {
        if (typeof document !== "undefined" && document.fonts) {
          const inter = [
            document.fonts.load("300 36px Inter"),
            document.fonts.load("400 14px Inter"),
            document.fonts.load("500 10px Inter"),
            document.fonts.load("600 12px Inter"),
            document.fonts.load("bold 38px Inter"),
            document.fonts.load("bold 19px Inter"),
          ];
          // Pre-warm the brand font at the exact sizes/weights used in the
          // header so getScaledWidth() returns accurate measurements when
          // we right-anchor the day/date.
          const brand = brandFamily
            ? [
                document.fonts.load(
                  `${config.header.date.dayStyle.fontWeight} ${config.header.date.dayStyle.fontSize}px "${brandFamily}"`,
                ),
                document.fonts.load(
                  `${config.header.date.dateStyle.fontWeight} ${config.header.date.dateStyle.fontSize}px "${brandFamily}"`,
                ),
              ]
            : [];
          await Promise.all([...inter, ...brand]);
        }
      } catch {
        // proceed — Fabric will fallback to the next font in the chain
      }

      const W = config.canvas.width;
      const H = config.canvas.height;

      const view = adaptWeatherToCanvas(posts, nationalSummary ?? null);

      // ── Background gradient ────────────────────────────────────────────
      // Construct gradient with constructor `fill` so Fabric's bounding-cache
      // is consistent on first render (post-construction `.set("fill", grad)`
      // can leave the cache stale on some Fabric v6 builds).
      const linearCoords = build160LinearCoords(W, H);
      const bgGradient = new Gradient({
        type: "linear",
        gradientUnits: "pixels",
        coords: linearCoords,
        colorStops: config.background.gradient.stops.map((s) => ({
          offset: s.offset,
          color: s.color,
        })),
      });
      const bgRect = new Rect({
        left: 0,
        top: 0,
        width: W,
        height: H,
        fill: bgGradient,
        selectable: false,
        evented: false,
      });
      canvas.add(bgRect);

      // ── Decorative blur orbs (radial gradients) ───────────────────────
      for (const orb of config.background.orbs) {
        const orbW = orb.rx * 2;
        const orbH = orb.ry * 2;
        const orbGrad = new Gradient({
          type: "radial",
          gradientUnits: "pixels",
          coords: {
            x1: orbW / 2,
            y1: orbH / 2,
            r1: 0,
            x2: orbW / 2,
            y2: orbH / 2,
            r2: Math.min(orbW, orbH) / 2,
          },
          colorStops: [
            { offset: 0, color: orb.fill },
            { offset: 1, color: "rgba(255,255,255,0)" },
          ],
        });
        canvas.add(
          new Rect({
            left: orb.cx - orbW / 2,
            top: orb.cy - orbH / 2,
            width: orbW,
            height: orbH,
            fill: orbGrad,
            opacity: orb.opacity,
            selectable: false,
            evented: false,
          }),
        );
      }

      // ── Header: brand logo (left) ←→ day & date (right), centered ────
      const headerY = config.header.paddingTop;
      const headerLeftX = config.header.paddingX;
      const headerRightX = W - config.header.paddingX;

      // Day + date stack on the right (always anchored to headerY top)
      const dayStyle = {
        ...config.header.date.dayStyle,
        fontFamily: brandFamily || config.header.date.dayStyle.fontFamily,
      };
      const dateStyle = {
        ...config.header.date.dateStyle,
        fontFamily: brandFamily || config.header.date.dateStyle.fontFamily,
      };

      const dateBlockHeight =
        18 + (config.header.date.dateStyle.fontSize ?? 18);
      const headerCenterY = headerY + dateBlockHeight / 2;

      // Logo, vertically centered with day/date row
      let headerBottom = headerY + dateBlockHeight;
      if (config.header.logo.useBrandLogo && brand) {
        const logoId =
          BRAND_LOGO_IDS[brand as keyof typeof BRAND_LOGO_IDS] ?? "";
        if (logoId) {
          const logoUrl = brandLogoUrl(logoId);
          try {
            const logoImg = await FabricImage.fromURL(logoUrl, {
              crossOrigin: "anonymous",
            });
            logoImg.scaleToWidth(config.header.logo.width);
            logoImg.set({
              left: headerLeftX,
              top: headerCenterY,
              originX: "left",
              originY: "center",
              selectable: false,
              evented: false,
            });
            canvas.add(logoImg);
            headerBottom = Math.max(
              headerBottom,
              headerCenterY + logoImg.getScaledHeight() / 2,
            );
          } catch {
            // proceed without logo
          }
        }
      }

      if (view.day || view.date) {
        // Fabric's originX:"right" can mis-anchor once a brand font with
        // unloaded glyph metrics or non-zero charSpacing is in play (the
        // bounding box is computed before glyphs are measured, then the
        // text overflows the canvas edge). Build the text first, measure
        // its actual width, then place it with originX:"left".
        // 4px buffer absorbs any sub-pixel/measurement drift so the last
        // character can never clip the canvas right edge.
        const RIGHT_BUFFER = 4;
        if (view.day) {
          const dayText = makeStyledText(view.day, dayStyle, {
            left: 0,
            top: headerY,
            originX: "left",
          });
          (dayText as unknown as { initDimensions: () => void }).initDimensions();
          dayText.set({
            left: headerRightX - dayText.getScaledWidth() - RIGHT_BUFFER,
          });
          canvas.add(dayText);
        }
        if (view.date) {
          const [yr, mo, dy] = view.date.split("-");
          const formatted = `${dy}/${mo}/${yr}`;
          const dateText = makeStyledText(formatted, dateStyle, {
            left: 0,
            top: headerY + 18,
            originX: "left",
          });
          (dateText as unknown as { initDimensions: () => void }).initDimensions();
          dateText.set({
            left: headerRightX - dateText.getScaledWidth() - RIGHT_BUFFER,
          });
          canvas.add(dateText);
        }
      }

      // Eyebrow with brand-color dot, beneath the header band
      const eyebrowY = headerBottom + 14;
      const dotColor = brandColor || config.header.brandDot.defaultColor;
      const dotSize = config.header.brandDot.size;
      canvas.add(
        new Circle({
          left: headerLeftX,
          top: eyebrowY + 2,
          radius: dotSize / 2,
          fill: dotColor,
          originX: "left",
          originY: "center",
          selectable: false,
          evented: false,
        }),
      );
      canvas.add(
        makeStyledText(
          config.header.eyebrow.text,
          config.header.eyebrow.style,
          {
            left: headerLeftX + dotSize + 10,
            top: eyebrowY,
            originY: "center",
          },
        ),
      );

      // ── Preload all weather icons (hero + cells) ──────────────────────
      const neededIconKeys = new Set<WeatherIconKey>([view.hero.iconKey]);
      view.cells.forEach((c) => neededIconKeys.add(c.iconKey));
      const iconCache = new Map<WeatherIconKey, HTMLImageElement>();
      await Promise.all(
        Array.from(neededIconKeys).map(async (k) => {
          try {
            iconCache.set(k, await loadHTMLImage(WEATHER_ICON_PATHS[k]));
          } catch (err) {
            console.warn(`[weather] icon load failed: ${k}`, err);
          }
        }),
      );

      const safeIconScale = (img: HTMLImageElement, target: number): number => {
        const w = img.naturalWidth || img.width || target;
        const h = img.naturalHeight || img.height || target;
        const longest = Math.max(w, h);
        return longest > 0 ? target / longest : 1;
      };

      // ── Hero block ────────────────────────────────────────────────────
      const heroX = config.hero.paddingX;
      const heroY = config.hero.top;
      const heroW = W - config.hero.paddingX * 2;
      const heroH = config.hero.height;
      canvas.add(
        new Rect({
          left: heroX,
          top: heroY,
          width: heroW,
          height: heroH,
          rx: config.hero.radius,
          ry: config.hero.radius,
          fill: config.hero.fill,
          stroke: config.hero.stroke,
          strokeWidth: config.hero.strokeWidth,
          selectable: false,
          evented: false,
        }),
      );

      const heroInnerLeft = heroX + config.hero.cardPaddingX;
      const heroInnerTop = heroY + config.hero.cardPaddingY;

      canvas.add(
        makeStyledText(view.hero.eyebrow, config.hero.eyebrow, {
          left: heroInnerLeft,
          top: heroInnerTop,
        }),
      );

      const titleTop = heroInnerTop + config.hero.title.gapAboveTitle;
      const heroTitle = makeStyledTextbox(
        view.hero.title,
        config.hero.title.style,
        {
          left: heroInnerLeft,
          top: titleTop,
          width: config.hero.title.maxWidth,
          fontFamily: config.hero.title.useBrandFont
            ? brandFamily || config.hero.title.style.fontFamily
            : config.hero.title.style.fontFamily,
        },
      );
      canvas.add(heroTitle);

      const titleLineHeight =
        (config.hero.title.style.fontSize ?? 38) *
        (config.hero.title.style.lineHeight ?? 1.05);
      // V2b headlines fit on a single line within `title.maxWidth`. Reserve
      // one line of vertical space; if a future headline wraps, bump
      // `title.maxWidth` or increase `caption.gapAboveCaption` in config.
      const titleApproxH = titleLineHeight;
      const captionTop = titleTop + titleApproxH + config.hero.caption.gapAboveCaption;
      canvas.add(
        makeStyledTextbox(view.hero.caption, config.hero.caption.style, {
          left: heroInnerLeft,
          top: captionTop,
          width: config.hero.caption.maxWidth,
        }),
      );

      // Hero right column: icon + temp range + label
      const heroRightX = heroX + heroW - config.hero.rightInset;
      const heroIcon = iconCache.get(view.hero.iconKey);
      const tempRangeTop = heroY + heroH / 2 + config.hero.tempRangeYOffset;
      if (heroIcon) {
        const iconImg = new FabricImage(heroIcon, {
          originX: "right",
          originY: "center",
          left: heroRightX - config.hero.iconLeftOfTextOffset,
          top: heroY + heroH / 2,
          selectable: false,
          evented: false,
        });
        iconImg.scale(safeIconScale(heroIcon, config.hero.iconSize));
        canvas.add(iconImg);
      }
      canvas.add(
        makeStyledText(view.hero.tempRange, config.hero.tempRange, {
          left: heroRightX,
          top: tempRangeTop,
          originX: "right",
        }),
      );
      canvas.add(
        makeStyledText(view.hero.tempLabel, config.hero.tempLabel, {
          left: heroRightX + config.hero.tempLabelXOffset,
          top: tempRangeTop + config.hero.tempLabelGap,
          originX: "right",
        }),
      );

      // ── Grid of state cards ───────────────────────────────────────────
      const gridX = config.grid.paddingX;
      const gridTop = config.grid.top;
      const gridW = W - config.grid.paddingX * 2;
      const gridBottom = H - config.footer.bottomOffset - 36;
      const gridH = gridBottom - gridTop;
      const { cols, rows, gapX, gapY } = config.grid;
      const cellW = (gridW - gapX * (cols - 1)) / cols;
      const cellH = (gridH - gapY * (rows - 1)) / rows;

      const drawCell = (cell: CanvasStateCell, idx: number) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cellX = gridX + col * (cellW + gapX);
        const cellY = gridTop + row * (cellH + gapY);

        canvas.add(
          new Rect({
            left: cellX,
            top: cellY,
            width: cellW,
            height: cellH,
            rx: config.card.radius,
            ry: config.card.radius,
            fill: config.card.fill,
            stroke: config.card.stroke,
            strokeWidth: config.card.strokeWidth,
            selectable: false,
            evented: false,
          }),
        );

        const innerX = cellX + config.card.paddingX;
        const innerTop = cellY + config.card.paddingTop;
        const innerRight = cellX + cellW - config.card.paddingX;
        const innerBottom = cellY + cellH - config.card.paddingBottom;

        // Top-right icon
        const cellIcon = iconCache.get(cell.iconKey);
        if (cellIcon) {
          const iconImg = new FabricImage(cellIcon, {
            originX: "right",
            originY: "top",
            left: innerRight,
            top: innerTop,
            selectable: false,
            evented: false,
          });
          iconImg.scale(safeIconScale(cellIcon, config.card.iconSize));
          canvas.add(iconImg);
        }

        // State name (top-left)
        const stateNameW = Math.max(
          80,
          cellW - config.card.paddingX * 2 - config.card.iconSize - 8,
        );
        const stateBox = makeStyledTextbox(
          cell.shortName,
          config.card.stateName.style,
          {
            left: innerX,
            top: innerTop,
            width: stateNameW,
            fontFamily: config.card.stateName.useBrandFont
              ? brandFamily || config.card.stateName.style.fontFamily
              : config.card.stateName.style.fontFamily,
          },
        );
        canvas.add(stateBox);

        // State name height assumed at one line for V2b. Override via
        // `card.whenGapAboveWhen` to add/remove space above the when label
        // without touching the component.
        const stateLineH =
          (config.card.stateName.style.fontSize ?? 19) *
          (config.card.stateName.style.lineHeight ?? 1.05);
        const whenTop = innerTop + stateLineH + config.card.whenGapAboveWhen;
        if (cell.when) {
          canvas.add(
            makeStyledText(cell.when, config.card.when, {
              left: innerX,
              top: whenTop,
            }),
          );
        }

        // Bottom block stacked from the bottom up.
        const forecastApproxH =
          (config.card.forecast.fontSize ?? 10) *
          (config.card.forecast.lineHeight ?? 1.3) *
          2; // up to 2 lines
        const forecastTop = innerBottom - forecastApproxH;
        canvas.add(
          makeStyledTextbox(cell.trimmedLabel, config.card.forecast, {
            left: innerX,
            top: forecastTop,
            width: cellW - config.card.paddingX * 2,
          }),
        );

        const minMaxY = forecastTop - 16;
        const minMaxLabelStyle = config.card.minMaxLabel;
        const minMaxValueStyle = config.card.minMaxRow;
        const minLabelX = innerX + config.card.minColumnX;
        const maxLabelX = innerX + config.card.maxColumnX;
        const valueGap = config.card.minMaxLabelValueGap;
        canvas.add(
          makeStyledText("min", minMaxLabelStyle, {
            left: minLabelX,
            top: minMaxY,
          }),
        );
        canvas.add(
          makeStyledText(`${cell.min}°`, minMaxValueStyle, {
            left: minLabelX + valueGap,
            top: minMaxY,
          }),
        );
        canvas.add(
          makeStyledText("max", minMaxLabelStyle, {
            left: maxLabelX,
            top: minMaxY,
          }),
        );
        canvas.add(
          makeStyledText(`${cell.max}°`, minMaxValueStyle, {
            left: maxLabelX + valueGap,
            top: minMaxY,
          }),
        );

        // Avg temp big + "purata", above the min/max row
        const avgY = minMaxY - 40;
        canvas.add(
          makeStyledText(`${cell.avg}°`, config.card.avgTemp, {
            left: innerX,
            top: avgY,
          }),
        );
        // canvas.add(
        //   makeStyledText("purata", config.card.avgLabel, {
        //     left:
        //       innerX + (config.card.avgTemp.fontSize ?? 36) * 0.85 + 10,
        //     top: avgY + (config.card.avgTemp.fontSize ?? 36) - 14,
        //   }),
        // );
      };

      const renderable = view.cells.slice(0, cols * rows);
      renderable.forEach((cell, idx) => drawCell(cell, idx));

      // ── Footer ─────────────────────────────────────────────────────────
      const footerY = H - config.footer.bottomOffset;
      canvas.add(
        makeStyledText(config.footer.leftText, config.footer.style, {
          left: config.footer.paddingX,
          top: footerY,
          originY: "bottom",
        }),
      );
      canvas.add(
        makeStyledText(config.footer.rightText, config.footer.style, {
          left: W - config.footer.paddingX,
          top: footerY,
          originX: "right",
          originY: "bottom",
        }),
      );

      canvas.requestRenderAll();
      canvas.renderAll();
      setReady(true);
    },
    [posts, brand, fontUse, brandColor, nationalSummary, config],
  );

  useEffect(() => {
    if (!canvasElRef.current || posts.length === 0) return;

    canvasElRef.current.width = config.canvas.width;
    canvasElRef.current.height = config.canvas.height;

    const canvas = new StaticCanvas(canvasElRef.current, {
      width: config.canvas.width,
      height: config.canvas.height,
      backgroundColor: config.canvas.backgroundColor,
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
  }, [posts, config, renderCanvas]);

  useImperativeHandle(ref, () => ({
    downloadAsPng() {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `weather-malaysia-single-${posts[0]?.date ?? "today"}.png`;
      link.click();
    },
    getDataUrl() {
      const canvas = fabricRef.current;
      if (!canvas) return null;
      return canvas.toDataURL({ format: "png", multiplier: 2 });
    },
  }));

  const cw = config.canvas.width;
  const ch = config.canvas.height;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`w-full overflow-hidden rounded-xl border border-neutral-200${onClick ? " cursor-pointer hover:opacity-90 transition" : ""}`}
        style={{ maxWidth: 500, aspectRatio: `${cw} / ${ch}` }}
        onClick={onClick}
      >
        <canvas
          ref={canvasElRef}
          width={cw}
          height={ch}
          style={{
            width: "100%",
            height: "100%",
            display: posts.length > 0 ? "block" : "none",
          }}
        />
        {!ready && posts.length > 0 && (
          <div className="flex items-center justify-center h-64 text-sm text-neutral-400">
            Rendering preview…
          </div>
        )}
      </div>
    </div>
  );
});
