import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";
import { StaticCanvas, FabricImage, Rect, Circle, Line, Text, Textbox } from "fabric";
// FabricImage stays imported — still used for the brand logo in the top header.
import {
  DEFAULT_ONTHISDAY_CANVAS_CONFIG,
  type OnThisDayCanvasConfig,
} from "../../config/onThisDayCanvasConfig";
import { BRAND_LOGO_IDS } from "../../constants/brands";
import {
  MONTH_NAMES,
  parseEventDate,
  stripOnThisDayPrefix,
  urlToHostnameLabel,
} from "./onThisDayTitle";

export interface OnThisDayCanvasHandle {
  downloadAsPng: () => void;
  getDataUrl: () => string | null;
}

export interface OnThisDayCanvasProps {
  // Already-edited title from the page (raw, including any "On This Day —"
  // prefix the user left in). The canvas strips the prefix internally.
  title: string;
  // "DD/MM/YYYY" — drives giant year + date stack. When null both are hidden.
  date: string | null;
  brand: string;
  config?: OnThisDayCanvasConfig;
  // Source URL of the event — rendered (uppercase, hostname-only) in the
  // bottom-right footer slot. Empty falls back to a KULT branding placeholder.
  eventUrl?: string | null;
  // LLM-derived highlight phrase (verbatim, contiguous title tokens). When
  // present and non-empty, takes precedence over the local heuristic.
  highlightTerms?: string[];
  // Optional override for the accent color (blue rect, dispatch line,
  // highlight background). Sourced from the Brand Tone & Voice data table's
  // `brand_hex` column. Falls back to `config.accent` when null/undefined.
  accentColor?: string | null;
  // Optional override for the canvas background. Falls back to `config.cream`.
  backgroundColor?: string | null;
  // Brand-specific text color overrides (used when canvas background changes
  // and the default dark-on-cream text would lose contrast). Each falls back
  // to the corresponding default in config.
  headerLabelColor?: string | null;  // "ON THIS DAY" top-left label
  bigYearColor?: string | null;      // giant year text
  headlineColor?: string | null;     // headline body fill
  // Highlighted phrase fill. Defaults to the resolved headline color when not
  // overridden, so the accent block sits behind same-coloured glyphs as the
  // surrounding body. Override when the highlight needs to invert (e.g. dark
  // text on a near-bg-coloured accent block).
  highlightTextColor?: string | null;
  footerColor?: string | null;       // bottom strip kicker / tagline / url
  // Date circle (top-right) — fill of the circle and text inside it.
  dateCircleColor?: string | null;
  dateCircleTextColor?: string | null;
  onClick?: () => void;
}

// Pre-load every weight the canvas paints with so Fabric's first measureText
// sees real metrics instead of fallback widths (otherwise the headline wraps
// mid-word and never reflows after the real font swaps in).
function loadFonts(family: string): Promise<unknown> {
  return Promise.all([
    document.fonts.load(`400 13px ${family}`),
    document.fonts.load(`500 16px ${family}`),
    document.fonts.load(`600 22px ${family}`),
    document.fonts.load(`700 16px ${family}`),
    document.fonts.load(`800 84px ${family}`),
    document.fonts.load(`800 130px ${family}`),
    document.fonts.load(`800 320px ${family}`),
  ]).then(() => document.fonts.ready);
}

// Convert design letter-spacing (px-relative-to-fontSize) to Fabric's charSpacing
// (1/1000 em units). Same conversion used in QuoteCanvas.tsx.
function ls(letterSpacingPx: number, fontSize: number): number {
  return (letterSpacingPx * 1000) / fontSize;
}

// CJK glyphs (Han, Hiragana, Katakana, Hangul, full-width punctuation) render
// roughly 2× the width of Latin chars at the same font-size. Count them as
// 2 units when picking a dynamic-size tier so a 40-char Chinese headline
// scales like an 80-char English one and doesn't bleed past the canvas edge.
const CJK_RE =
  /[　-〿぀-ゟ゠-ヿ一-鿿가-힯＀-￯]/;
function visualLength(text: string): number {
  let n = 0;
  for (const ch of text) n += CJK_RE.test(ch) ? 2 : 1;
  return n;
}

export const OnThisDayCanvas = forwardRef<
  OnThisDayCanvasHandle,
  OnThisDayCanvasProps
>(function OnThisDayCanvas(
  {
    title,
    date,
    brand,
    config: configProp,
    eventUrl,
    highlightTerms: highlightTermsProp,
    accentColor,
    backgroundColor,
    headerLabelColor,
    bigYearColor,
    headlineColor,
    highlightTextColor,
    footerColor,
    dateCircleColor,
    dateCircleTextColor,
    onClick,
  },
  ref,
) {
  const config = configProp ?? DEFAULT_ONTHISDAY_CANVAS_CONFIG;
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<StaticCanvas | null>(null);
  const [ready, setReady] = useState(false);

  const renderCanvas = useCallback(
    async (
      canvas: StaticCanvas,
      isCancelled: () => boolean = () => false,
    ): Promise<boolean> => {
      try {
        canvas.clear();
        const { width, height } = config.canvas;

        await loadFonts("Archivo");
        if (isCancelled()) return false;

        const trimmedTitle = stripOnThisDayPrefix(title);
        const parsedDate = parseEventDate(date);
        // Brand-specific accent overrides the default electric blue when
        // the data table has a brand_hex; otherwise fall back to config.accent.
        const accent =
          accentColor && /^#[0-9a-f]{6}$/i.test(accentColor)
            ? accentColor
            : config.accent;
        const bg =
          backgroundColor && /^#[0-9a-f]{6}$/i.test(backgroundColor)
            ? backgroundColor
            : config.cream;
        const isHex = (v: string | null | undefined) =>
          !!v && /^#[0-9a-f]{6}$/i.test(v);
        const labelFill = isHex(headerLabelColor) ? headerLabelColor! : config.dark;
        const yearFill = isHex(bigYearColor) ? bigYearColor! : config.bigYear.color;
        const headlineFill = isHex(headlineColor)
          ? headlineColor!
          : config.headline.color;
        const highlightFill = isHex(highlightTextColor)
          ? highlightTextColor!
          : headlineFill;
        const footerFill = isHex(footerColor) ? footerColor! : config.dark;
        const dateCircleFill = isHex(dateCircleColor)
          ? dateCircleColor!
          : config.dark;
        const dateCircleTextFill = isHex(dateCircleTextColor)
          ? dateCircleTextColor!
          : config.dateBox.color;
        // The n8n webhook is now the single source of truth for highlight
        // selection (LLM with a server-side deterministic fallback). We
        // render no highlight if the prop is empty/missing.
        const highlightTerms = highlightTermsProp ?? [];

        // ─── Layer 1: full-canvas background fill ────────────────────────
        canvas.add(
          new Rect({
            left: 0,
            top: 0,
            width,
            height,
            fill: bg,
            selectable: false,
            evented: false,
          }),
        );

        // ─── Layer 2: blue accent rectangle (or uploaded photo) ──────────
        // Tilted by `ab.angle` degrees around the rect's center to match the
        // source design's slanted block.
        const ab = config.accentBox;
        const abCx = ab.left + ab.width / 2;
        const abCy = ab.top + ab.height / 2;
        // Helper: build the tilted accent rect (center-anchored so the angle
        // doesn't drift the bleed off the left edge).
        const makeAccentRect = (props: {
          fill?: string;
          opacity?: number;
        }): Rect =>
          new Rect({
            left: abCx,
            top: abCy,
            width: ab.width,
            height: ab.height,
            originX: "center",
            originY: "center",
            angle: ab.angle,
            fill: props.fill,
            opacity: props.opacity,
            selectable: false,
            evented: false,
          });

        canvas.add(makeAccentRect({ fill: accent }));

        // ─── Layer 3: dark date CIRCLE (top-right, overlaps the year) ───
        const db = config.dateBox;
        canvas.add(
          new Circle({
            left: db.centerX,
            top: db.centerY,
            radius: db.radius,
            originX: "center",
            originY: "center",
            fill: dateCircleFill,
            selectable: false,
            evented: false,
          }),
        );

        // ─── Layer 4: top header — label (left) + brand logo (right) ───
        const hd = config.header;
        const headerY = hd.top + hd.height / 2;
        canvas.add(
          new Text("ON THIS DAY", {
            fontFamily: hd.label.fontFamily,
            fontSize: hd.label.fontSize,
            fontWeight: hd.label.fontWeight,
            fill: labelFill,
            charSpacing: ls(hd.label.letterSpacing, hd.label.fontSize),
            left: hd.paddingX,
            top: headerY,
            originX: "left",
            originY: "center",
            selectable: false,
            evented: false,
          }),
        );

        const logoId = BRAND_LOGO_IDS[brand as keyof typeof BRAND_LOGO_IDS];
        if (logoId) {
          try {
            const logoUrl = `https://res.cloudinary.com/dymmqtqyg/image/upload/${logoId}`;
            const logo = await FabricImage.fromURL(logoUrl, {
              crossOrigin: "anonymous",
            });
            if (isCancelled()) return false;
            logo.scaleToWidth(hd.logo.width);
            if (logo.getScaledHeight() > hd.logo.maxHeight) {
              logo.scaleToHeight(hd.logo.maxHeight);
            }
            logo.set({
              left: width - hd.paddingX,
              top: headerY,
              originX: "right",
              originY: "center",
              selectable: false,
              evented: false,
            });
            canvas.add(logo);
          } catch {
            // Logo failed — leave the slot empty
          }
        }

        // ─── Layer 5: giant year (overlaps the accent rectangle) ────────
        if (parsedDate) {
          const by = config.bigYear;
          canvas.add(
            new Text(String(parsedDate.year), {
              fontFamily: by.fontFamily,
              fontSize: by.fontSize,
              fontWeight: by.fontWeight,
              fill: yearFill,
              charSpacing: ls(by.letterSpacing, by.fontSize),
              lineHeight: 0.85,
              left: by.left,
              top: by.top,
              originX: "left",
              originY: "top",
              angle: by.angle,
              selectable: false,
              evented: false,
            }),
          );
        }

        // ─── Layer 6: date stack inside the dark circle ─────────────────
        if (parsedDate) {
          const monthName = MONTH_NAMES[(parsedDate.month - 1) % 12] ?? "";
          const dayStr = String(parsedDate.day).padStart(2, "0");
          const yearLine = `·  ${parsedDate.year}  ·`;

          // Stack centered inside the circle: month at top, day in middle, year at bottom.
          const cx = db.centerX;
          const top = db.centerY - db.radius + db.paddingY;
          const bottom = db.centerY + db.radius - db.paddingY;

          const month = new Text(monthName, {
            fontFamily: "Archivo",
            fontSize: db.monthFontSize,
            fontWeight: 500,
            fill: dateCircleTextFill,
            charSpacing: ls(db.monthLetterSpacing, db.monthFontSize),
            left: cx,
            top,
            originX: "center",
            originY: "top",
            selectable: false,
            evented: false,
          });
          canvas.add(month);

          const day = new Text(dayStr, {
            fontFamily: "Archivo",
            fontSize: db.dayFontSize,
            fontWeight: 800,
            fill: dateCircleTextFill,
            charSpacing: ls(db.dayLetterSpacing, db.dayFontSize),
            lineHeight: 0.9,
            left: cx,
            // Day is the visual anchor — center it on the circle.
            top: db.centerY,
            originX: "center",
            originY: "center",
            selectable: false,
            evented: false,
          });
          canvas.add(day);

          const year = new Text(yearLine, {
            fontFamily: "Archivo",
            fontSize: db.yearFontSize,
            fontWeight: 400,
            fill: dateCircleTextFill,
            charSpacing: ls(db.yearLetterSpacing, db.yearFontSize),
            left: cx,
            top: bottom,
            originX: "center",
            originY: "bottom",
            selectable: false,
            evented: false,
          });
          canvas.add(year);
        }

        // ─── Layer 7: dispatch — real horizontal line + UPPERCASE label ─
        const d = config.dispatch;
        // Vertically centre the rule on the label's optical mid-line. Using
        // fontSize * 0.55 (cap-height heuristic) reads as a baseline-aligned
        // rule across browsers without measuring metrics directly.
        const lineY = d.top + d.fontSize * 0.55;
        canvas.add(
          new Line(
            [d.left, lineY, d.left + d.lineWidth, lineY],
            {
              stroke: accent,
              strokeWidth: d.lineThickness,
              selectable: false,
              evented: false,
            },
          ),
        );
        canvas.add(
          new Text("ON THIS DAY", {
            fontFamily: d.fontFamily,
            fontSize: d.fontSize,
            fontWeight: d.fontWeight,
            fill: accent,
            charSpacing: ls(d.letterSpacing, d.fontSize),
            left: d.left + d.lineWidth + d.lineGap,
            top: d.top,
            originX: "left",
            originY: "top",
            selectable: false,
            evented: false,
          }),
        );

        // ─── Layer 8: headline (with accent-colored highlight word) ─────
        const h = config.headline;
        const titleVisualLen = visualLength(trimmedTitle);
        const sizeTier = h.dynamicSizing.find(
          (t) => titleVisualLen <= t.maxLength,
        );
        const headlineFontSize = Math.round(h.fontSize * (sizeTier?.scale ?? 1));

        // CJK runs have no word boundaries, so Fabric's default word-wrap
        // treats the whole run as one unbreakable word and overflows the box.
        // splitByGrapheme=true wraps at any character, which is what CJK needs.
        const titleHasCJK = CJK_RE.test(trimmedTitle);
        const headline = new Textbox(trimmedTitle, {
          fontFamily: h.fontFamily,
          fontSize: headlineFontSize,
          fontWeight: h.fontWeight,
          fill: headlineFill,
          lineHeight: h.lineHeight,
          charSpacing: ls(h.letterSpacing, headlineFontSize),
          width: h.maxWidth,
          left: h.left,
          top: h.top,
          textAlign: "left",
          splitByGrapheme: titleHasCJK,
          selectable: false,
          evented: false,
        });

        // Highlight a contiguous phrase (e.g. "S. A. Ganapathy, the") with a
        // solid accent block behind cream text — matches the source design.
        // Strategy: for each wrapped line, find the longest substring of the
        // joined highlight phrase that appears in that line, then patch
        // per-char styles (fill + textBackgroundColor) for those positions.
        if (highlightTerms.length) {
          // Fabric v6's `styles` map keys per UNWRAPPED line (split by \n) —
          // our title has no newlines, so everything lives on `styles[0]`.
          // Match the phrase in the flat title and stamp per-char styles by
          // absolute character index.
          interface FabricTextboxInternal {
            styles: Record<
              number,
              Record<
                number,
                { fill: string; textBackgroundColor: string; fontWeight?: number | string }
              >
            >;
            dirty?: boolean;
          }
          const internal = headline as unknown as FabricTextboxInternal;

          const titleLc = trimmedTitle.toLowerCase();
          const phraseLc = highlightTerms.join(" ").toLowerCase();

          // Try exact phrase first; fall back to longest contiguous
          // substring of the phrase that exists verbatim in the title (the
          // LLM occasionally tweaks punctuation/spacing).
          let matchStart = titleLc.indexOf(phraseLc);
          let matchLen = phraseLc.length;
          if (matchStart < 0) {
            matchLen = 0;
            for (let ps = 0; ps < phraseLc.length; ps++) {
              for (let pe = phraseLc.length; pe > ps + matchLen; pe--) {
                const sub = phraseLc.slice(ps, pe);
                if (sub.length < 3) continue;
                const idx = titleLc.indexOf(sub);
                if (idx >= 0) {
                  matchStart = idx;
                  matchLen = sub.length;
                  break;
                }
              }
            }
          }

          if (matchStart >= 0 && matchLen > 0) {
            if (!internal.styles[0]) internal.styles[0] = {};
            for (let ci = matchStart; ci < matchStart + matchLen; ci++) {
              // Cream-on-accent matches the source design; the heaviest weight
              // makes the highlighted span visibly outweigh the surrounding
              // headline so the LLM phrase reads as the dominant beat.
              internal.styles[0][ci] = {
                fill: highlightFill,
                textBackgroundColor: accent,
                fontWeight: 900,
              };
            }
            internal.dirty = true;
          }
        }
        canvas.add(headline);

        // ─── Layer 9: footer (kicker + tagline + url slot) ──────────────
        const f = config.footer;
        const kicker = new Text("History, retold daily.", {
          fontFamily: f.kicker.fontFamily,
          fontSize: f.kicker.fontSize,
          fontWeight: f.kicker.fontWeight,
          fill: footerFill,
          left: f.paddingX,
          top: f.top,
          originX: "left",
          originY: "top",
          selectable: false,
          evented: false,
        });
        canvas.add(kicker);

        const taglineText = brand
          ? `An archive series by ${brand}.`
          : "An archive series.";
        canvas.add(
          new Text(taglineText, {
            fontFamily: f.tagline.fontFamily,
            fontSize: f.tagline.fontSize,
            fontWeight: f.tagline.fontWeight,
            fill: footerFill,
            left: f.paddingX,
            top: f.top + f.kicker.fontSize + f.tagline.gapAbove,
            originX: "left",
            originY: "top",
            selectable: false,
            evented: false,
          }),
        );

        const urlLabel = urlToHostnameLabel(eventUrl) || "KULT  ·  DIGITAL KIT";
        canvas.add(
          new Text(urlLabel, {
            fontFamily: f.url.fontFamily,
            fontSize: f.url.fontSize,
            fontWeight: f.url.fontWeight,
            fill: footerFill,
            charSpacing: ls(f.url.letterSpacing, f.url.fontSize),
            left: width - f.paddingX,
            top: f.top + f.kicker.fontSize + f.tagline.gapAbove + 4,
            originX: "right",
            originY: "top",
            selectable: false,
            evented: false,
          }),
        );

        canvas.renderAll();
        return true;
      } catch (e) {
        console.error("OnThisDayCanvas render failed", e);
        return false;
      }
    },
    [
      title,
      date,
      brand,
      config,
      eventUrl,
      highlightTermsProp,
      accentColor,
      backgroundColor,
      headerLabelColor,
      bigYearColor,
      headlineColor,
      highlightTextColor,
      footerColor,
      dateCircleColor,
      dateCircleTextColor,
    ],
  );

  // Double-buffered render (mirrors QuoteCanvas): build the new frame on a
  // detached canvas, then blit it onto the visible canvas in one drawImage
  // so the previous frame stays on screen during async font/image loads.
  const renderGenRef = useRef(0);
  useEffect(() => {
    if (!canvasElRef.current || !title.trim()) return;

    const myGen = ++renderGenRef.current;
    const isCancelled = () => myGen !== renderGenRef.current;
    const { width, height } = config.canvas;

    const offscreenEl = document.createElement("canvas");
    offscreenEl.width = width;
    offscreenEl.height = height;
    // The offscreen canvas's clear color is irrelevant — Layer 1 in
    // renderCanvas paints the actual background rect over it. Keep cream
    // as the literal here; the brand override is handled in renderCanvas.
    const offscreen = new StaticCanvas(offscreenEl, {
      width,
      height,
      backgroundColor: config.cream,
    });

    renderCanvas(offscreen, isCancelled).then((ok) => {
      if (!ok || isCancelled()) {
        offscreen.dispose();
        return;
      }
      const visibleEl = canvasElRef.current;
      if (!visibleEl) {
        offscreen.dispose();
        return;
      }
      if (visibleEl.width !== width) visibleEl.width = width;
      if (visibleEl.height !== height) visibleEl.height = height;
      const ctx = visibleEl.getContext("2d");
      if (ctx) {
        const sourceEl = offscreen.toCanvasElement(1) as HTMLCanvasElement;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(sourceEl, 0, 0);
      }
      visibleEl.style.width = "100%";
      visibleEl.style.height = "100%";

      const prev = fabricRef.current;
      fabricRef.current = offscreen;
      if (prev) prev.dispose();
      setReady(true);
    });
  }, [
    title,
    date,
    brand,
    eventUrl,
    highlightTermsProp,
    accentColor,
    backgroundColor,
    headerLabelColor,
    bigYearColor,
    headlineColor,
    highlightTextColor,
    footerColor,
    dateCircleColor,
    dateCircleTextColor,
    config,
    renderCanvas,
  ]);

  useEffect(() => {
    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    downloadAsPng() {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
      const link = document.createElement("a");
      link.href = dataUrl;
      const slug =
        stripOnThisDayPrefix(title)
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase()
          .slice(0, 50) || "on-this-day";
      link.download = `on-this-day-${slug}.png`;
      link.click();
    },
    getDataUrl() {
      const canvas = fabricRef.current;
      if (!canvas) return null;
      return canvas.toDataURL({ format: "png", multiplier: 1 });
    },
  }));

  const { width: cw, height: ch } = config.canvas;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        className={`w-full overflow-hidden rounded-xl border border-neutral-200${
          onClick ? " cursor-pointer hover:opacity-90 transition" : ""
        }`}
        style={{ maxWidth: 720, aspectRatio: `${cw} / ${ch}` }}
        onClick={onClick}
      >
        <canvas
          ref={canvasElRef}
          width={cw}
          height={ch}
          style={{
            width: "100%",
            height: "100%",
            display: title.trim() ? "block" : "none",
          }}
        />
        {!ready && title.trim() && (
          <div className="flex items-center justify-center h-64 text-sm text-neutral-400">
            Rendering preview...
          </div>
        )}
      </div>
    </div>
  );
});
