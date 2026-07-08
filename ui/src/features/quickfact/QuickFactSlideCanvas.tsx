import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";
import { StaticCanvas, FabricImage, Rect, Circle, Text, Textbox } from "fabric";
import { BRAND_LOGO_IDS } from "../../constants/brands";
import { withSubjectAwareCrop } from "../../utils/cloudinary";
import { loadBrandFont } from "../../utils/brandFonts";
import {
  QUICK_FACT_CANVAS,
  QUICK_FACT_LAYOUT as L,
  QUICK_FACT_FOOTER,
  typographyFor,
  paletteFor,
  type QuickFactPalette,
} from "../../config/quickFactCanvasConfig";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as
  | string
  | undefined;

export type QuickFactSlide =
  | {
      kind: "cover";
      title: string;
      summary: string;
      keyPhrase: string;
      /** Cloudinary public_id or full upload URL for the hero. */
      heroSource: string;
    }
  | {
      kind: "fact";
      index: number; // 0-based
      header: string;
      body: string;
      sectionLabel: string;
    };

export interface QuickFactSlideCanvasHandle {
  getDataUrl: () => string | null;
  downloadAsPng: (fileName?: string) => void;
}

interface QuickFactSlideCanvasProps {
  slide: QuickFactSlide;
  brand: string;
  brandHex: string;
  logoPublicId?: string;
  fontUse?: string | null;
  category: string;
  domain: string;
  dateStr: string;
  onClick?: () => void;
}

const { width: W, height: H } = QUICK_FACT_CANVAS;

// Shared vertical center for the top row, so the logo and the date/section label
// align on the same midline regardless of their individual heights.
const ROW_CENTER_Y = L.topRowY + L.logoMaxHeight / 2;

// Slides export at this multiple of the 1080×1350 canvas (so downloads/posts are
// 2160×2700 and text/footer stay sharp on zoom). On-screen preview stays 1×.
const EXPORT_SCALE = 2;

// Resolve a hero source to a subject-aware cropped, CORS-safe Cloudinary URL
// sized for the hero box. Handles three shapes:
//   1. An existing Cloudinary delivery URL (/image/upload/ or /image/fetch/) → used as-is
//   2. A full remote URL (e.g. an article's raw OG image) → proxied through
//      Cloudinary /image/fetch/ so canvas export (toDataURL) isn't tainted
//   3. A bare Cloudinary public_id → resolved to an /image/upload/ URL
function heroUrlFor(source: string, w: number, h: number): string {
  if (!source) return "";
  let url: string;
  if (source.includes("/image/upload/") || source.includes("/image/fetch/")) {
    url = source;
  } else if (/^https?:\/\//i.test(source)) {
    // Single-encode the remote URL (incl. any query string) for Cloudinary fetch.
    url = CLOUD_NAME
      ? `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${encodeURIComponent(source)}`
      : source;
  } else {
    url = CLOUD_NAME
      ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${source}`
      : source;
  }
  return withSubjectAwareCrop(url, w, h);
}

export const QuickFactSlideCanvas = forwardRef<
  QuickFactSlideCanvasHandle,
  QuickFactSlideCanvasProps
>(function QuickFactSlideCanvas(
  {
    slide,
    brand,
    brandHex,
    logoPublicId,
    fontUse,
    category,
    domain,
    dateStr,
    onClick,
  },
  ref,
) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<StaticCanvas | null>(null);
  const [ready, setReady] = useState(false);

  const renderCanvas = useCallback(
    async (
      canvas: StaticCanvas,
      isCancelled: () => boolean,
    ): Promise<boolean> => {
      try {
        canvas.clear();
        const pal = paletteFor(brandHex, brand);
        const typo = typographyFor(category);
        const isCJK = category === "Chinese";

        // Resolve fonts before any Textbox is constructed so glyph metrics are
        // measured against the real font (prevents phantom wrapping / clipping,
        // crucial for CJK). Fall back to a sensible family per language.
        const fallback = isCJK ? "Noto Sans SC" : "Montserrat";
        let family = "Montserrat";
        try {
          const loaded =
            (await loadBrandFont(fontUse)) || (await loadBrandFont(fallback));
          family = loaded || fallback;
          await document.fonts.ready;
          const ctx = (canvas.getElement() as HTMLCanvasElement).getContext(
            "2d",
          );
          if (ctx) {
            const prev = ctx.font;
            for (const size of [
              typo.coverTitle,
              typo.factHeader,
              typo.factBody,
              typo.coverSummary,
            ]) {
              ctx.font = `700 ${size}px "${family}"`;
              ctx.measureText("AGWMQ汉字");
            }
            ctx.font = prev;
          }
        } catch {
          /* fall back to default family */
        }
        if (isCancelled()) return false;

        // Background
        canvas.add(
          new Rect({
            left: 0,
            top: 0,
            width: W,
            height: H,
            fill: pal.bg,
            selectable: false,
            evented: false,
          }),
        );

        // Brand logo (top-left)
        await addLogo(
          canvas,
          logoPublicId ??
            BRAND_LOGO_IDS[brand as keyof typeof BRAND_LOGO_IDS] ??
            "",
          isCancelled,
        );
        if (isCancelled()) return false;

        const handle = brandHandleFor(brand);
        const footerSrc = QUICK_FACT_FOOTER[brand.toLowerCase()] ?? "";
        if (slide.kind === "cover") {
          await renderCover(
            canvas,
            slide,
            pal,
            typo,
            family,
            isCJK,
            handle,
            domain,
            dateStr,
            footerSrc,
            isCancelled,
          );
        } else {
          await renderFact(
            canvas,
            slide,
            pal,
            typo,
            family,
            isCJK,
            handle,
            domain,
            footerSrc,
            isCancelled,
          );
        }
        if (isCancelled()) return false;

        canvas.renderAll();
        return true;
      } catch (e) {
        console.error("QuickFactSlideCanvas render failed", e);
        return false;
      }
    },
    [slide, brand, brandHex, logoPublicId, fontUse, category, domain, dateStr],
  );

  // Double-buffered render (mirrors QuoteCanvas): build offscreen, blit when done.
  const genRef = useRef(0);
  useEffect(() => {
    if (!canvasElRef.current) return;
    const myGen = ++genRef.current;
    const isCancelled = () => myGen !== genRef.current;
    const offEl = document.createElement("canvas");
    offEl.width = W;
    offEl.height = H;
    const offscreen = new StaticCanvas(offEl, {
      width: W,
      height: H,
      backgroundColor: "#0D0D0F",
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
      if (visibleEl.width !== W) visibleEl.width = W;
      if (visibleEl.height !== H) visibleEl.height = H;
      const ctx = visibleEl.getContext("2d");
      if (ctx) {
        const sourceEl = offscreen.toCanvasElement(1) as HTMLCanvasElement;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(sourceEl, 0, 0);
      }
      const prev = fabricRef.current;
      fabricRef.current = offscreen;
      if (prev) prev.dispose();
      setReady(true);
    });
  }, [renderCanvas]);

  useEffect(() => {
    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getDataUrl() {
      return (
        fabricRef.current?.toDataURL({ format: "png", multiplier: EXPORT_SCALE }) ?? null
      );
    },
    downloadAsPng(fileName?: string) {
      const url = fabricRef.current?.toDataURL({
        format: "png",
        multiplier: EXPORT_SCALE,
      });
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName ?? "quick-fact.png";
      a.click();
    },
  }));

  return (
    <div
      className={`w-full mx-auto rounded-xl overflow-hidden${onClick ? " cursor-pointer hover:opacity-95 transition" : ""}`}
      style={{
        aspectRatio: `${W} / ${H}`,
        position: "relative",
        background: "#0D0D0F",
      }}
      onClick={onClick}
    >
      <canvas
        ref={canvasElRef}
        width={W}
        height={H}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
      {!ready && (
        <div
          style={{ position: "absolute", inset: 0 }}
          className="flex items-center justify-center text-sm text-neutral-500"
        >
          Rendering…
        </div>
      )}
    </div>
  );
});

// ── render helpers ──────────────────────────────────────────────────────────

async function addLogo(
  canvas: StaticCanvas,
  logoId: string,
  isCancelled: () => boolean,
): Promise<void> {
  if (!logoId) return;
  try {
    const url = `https://res.cloudinary.com/dymmqtqyg/image/upload/${logoId}`;
    const logo = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
    if (isCancelled()) return;
    logo.scaleToWidth(L.logoWidth);
    if (logo.getScaledHeight() > L.logoMaxHeight)
      logo.scaleToHeight(L.logoMaxHeight);
    // Top-right, vertically centered on the shared top-row midline.
    logo.set({
      left: W - L.pad,
      top: ROW_CENTER_Y,
      originX: "right",
      originY: "center",
      selectable: false,
      evented: false,
    });
    canvas.add(logo);
  } catch {
    /* logo optional */
  }
}

// Recolor an image to a flat color, preserving its alpha mask. Used to tint the
// (white) footer to the slide's text color so it reads on light or dark
// backgrounds. Same-origin source required (no canvas taint).
function tintImage(
  el: HTMLImageElement | HTMLCanvasElement,
  hex: string,
): HTMLCanvasElement {
  const w = (el as HTMLImageElement).naturalWidth || el.width;
  const h = (el as HTMLImageElement).naturalHeight || el.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.drawImage(el, 0, 0, w, h);
  ctx.globalCompositeOperation = "source-in"; // keep alpha, replace RGB with `hex`
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, w, h);
  return c;
}

// Brand footer strip at the bottom, tinted to `color` so it adapts to the
// background (white on dark bg, dark on white bg). Same-origin asset (no taint).
// Returns true if drawn, false to let callers fall back to the text footer.
async function addFooterImage(
  canvas: StaticCanvas,
  src: string,
  color: string,
  isCancelled: () => boolean,
): Promise<boolean> {
  if (!src) return false;
  try {
    const loaded = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
    if (isCancelled()) return true;
    const tinted = tintImage(loaded.getElement() as HTMLImageElement, color);
    const img = new FabricImage(tinted);
    img.scaleToWidth(W - L.pad * 2);
    // Inset to the content margin, lifted off the very bottom edge.
    img.set({
      left: L.pad,
      top: H - L.footerBottom,
      originX: "left",
      originY: "bottom",
      selectable: false,
      evented: false,
    });
    canvas.add(img);
    return true;
  } catch {
    return false;
  }
}

function addFooter(
  canvas: StaticCanvas,
  brandHandle: string,
  domain: string,
  pal: QuickFactPalette,
  family: string,
  fontSize: number,
): void {
  const y = H - L.pad;
  canvas.add(
    new Text(brandHandle, {
      left: L.pad,
      top: y,
      originX: "left",
      originY: "bottom",
      fontFamily: family,
      fontSize,
      fontWeight: "700",
      fill: pal.textPrimary,
      selectable: false,
      evented: false,
    }),
  );
  if (domain) {
    canvas.add(
      new Text(domain, {
        left: W - L.pad,
        top: y,
        originX: "right",
        originY: "bottom",
        fontFamily: family,
        fontSize,
        fontWeight: "400",
        fill: pal.textMuted,
        selectable: false,
        evented: false,
      }),
    );
  }
}

function brandHandleFor(brand: string): string {
  return "@" + brand.toLowerCase().replace(/\s+/g, "");
}

async function renderCover(
  canvas: StaticCanvas,
  slide: Extract<QuickFactSlide, { kind: "cover" }>,
  pal: QuickFactPalette,
  typo: ReturnType<typeof typographyFor>,
  family: string,
  isCJK: boolean,
  handle: string,
  domain: string,
  dateStr: string,
  footerSrc: string,
  isCancelled: () => boolean,
): Promise<void> {
  const heroX = L.pad;
  const heroW = W - L.pad * 2;
  const heroTop = L.heroTop;
  const heroH = L.heroHeight;

  // Date (top-left, plain text; vertically centered with the top-right logo)
  if (dateStr) {
    canvas.add(
      new Text(dateStr, {
        left: L.pad,
        top: ROW_CENTER_Y,
        originX: "left",
        originY: "center",
        fontFamily: family,
        fontSize: typo.badge,
        fontWeight: "700",
        fill: pal.textPrimary,
        selectable: false,
        evented: false,
      }),
    );
  }

  // Hero image, rounded, with a placeholder fill behind it.
  canvas.add(
    new Rect({
      left: heroX,
      top: heroTop,
      width: heroW,
      height: heroH,
      rx: L.corner,
      ry: L.corner,
      fill: "#1A1A1F",
      selectable: false,
      evented: false,
    }),
  );
  if (slide.heroSource) {
    try {
      // Fetch the hero at export resolution so it isn't upscaled in the 2× export.
      const src = heroUrlFor(slide.heroSource, heroW * EXPORT_SCALE, heroH * EXPORT_SCALE);
      const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
      if (!isCancelled()) {
        const scale = Math.max(heroW / img.width!, heroH / img.height!);
        img.scale(scale);
        img.set({
          left: heroX + heroW / 2,
          top: heroTop + heroH / 2,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        });
        img.clipPath = new Rect({
          width: heroW,
          height: heroH,
          rx: L.corner,
          ry: L.corner,
          left: heroX + heroW / 2,
          top: heroTop + heroH / 2,
          originX: "center",
          originY: "center",
          absolutePositioned: true,
        });
        canvas.add(img);
      }
    } catch {
      /* placeholder stays */
    }
  }

  // Key-phrase pill overlapping the hero bottom (compact, sized to the text).
  if (slide.keyPhrase) {
    const chipText = new Text(slide.keyPhrase, {
      fontFamily: family,
      fontSize: typo.coverKeyPhrase,
      fontWeight: "700",
      fill: pal.onAccent,
      selectable: false,
      evented: false,
    });
    const chipW = chipText.width! + L.chipPadX * 2;
    const chipH = chipText.height! + L.chipPadY * 2;
    const chipLeft = heroX + 32;
    const chipTop = heroTop + heroH - chipH - 24;
    canvas.add(
      new Rect({
        left: chipLeft,
        top: chipTop,
        width: chipW,
        height: chipH,
        rx: chipH / 2,
        ry: chipH / 2,
        fill: pal.accent,
        selectable: false,
        evented: false,
      }),
    );
    chipText.set({
      left: chipLeft + chipW / 2,
      top: chipTop + chipH / 2,
      originX: "center",
      originY: "center",
    });
    canvas.add(chipText);
  }

  // Title + summary stacked below the hero.
  let cursorY = heroTop + heroH + 60;
  const title = new Textbox(slide.title, {
    left: L.pad,
    top: cursorY,
    width: W - L.pad * 2,
    fontFamily: family,
    fontSize: typo.coverTitle,
    fontWeight: "700",
    fill: pal.textPrimary,
    lineHeight: isCJK ? typo.lineHeight : 1.05,
    selectable: false,
    evented: false,
  });
  canvas.add(title);
  cursorY += title.getScaledHeight() + 28;

  if (slide.summary) {
    const summary = new Textbox(slide.summary, {
      left: L.pad,
      top: cursorY,
      width: W - L.pad * 2,
      fontFamily: family,
      fontSize: typo.coverSummary,
      fontWeight: "400",
      fill: pal.textMuted,
      lineHeight: 1.4,
      selectable: false,
      evented: false,
    });
    canvas.add(summary);
  }

  const drewCover = await addFooterImage(
    canvas,
    footerSrc,
    pal.textPrimary,
    isCancelled,
  );
  if (!drewCover) addFooter(canvas, handle, domain, pal, family, typo.footer);
}

async function renderFact(
  canvas: StaticCanvas,
  slide: Extract<QuickFactSlide, { kind: "fact" }>,
  pal: QuickFactPalette,
  typo: ReturnType<typeof typographyFor>,
  family: string,
  isCJK: boolean,
  handle: string,
  domain: string,
  footerSrc: string,
  isCancelled: () => boolean,
): Promise<void> {
  // Section label (top-left; vertically centered with the top-right logo).
  // Uses the primary text color so it matches the cover's top-row treatment
  // and adapts to the background.
  if (slide.sectionLabel) {
    canvas.add(
      new Text(slide.sectionLabel, {
        left: L.pad,
        top: ROW_CENTER_Y,
        originX: "left",
        originY: "center",
        fontFamily: family,
        fontSize: typo.badge,
        fontWeight: "700",
        fill: pal.textPrimary,
        selectable: false,
        evented: false,
      }),
    );
  }

  // Big accent card
  const cardX = L.pad;
  const cardTop = L.cardTop;
  const cardW = W - L.pad * 2;
  const cardH = H - L.cardTop - L.cardBottom;
  canvas.add(
    new Rect({
      left: cardX,
      top: cardTop,
      width: cardW,
      height: cardH,
      rx: L.corner,
      ry: L.corner,
      fill: pal.accent,
      selectable: false,
      evented: false,
    }),
  );

  // Number badge (circle, top-right inside card)
  const r = 52;
  const cx = cardX + cardW - L.cardPad - r;
  const cy = cardTop + L.cardPad + r;
  canvas.add(
    new Circle({
      left: cx,
      top: cy,
      radius: r,
      originX: "center",
      originY: "center",
      fill: "transparent",
      stroke: pal.onAccent,
      strokeWidth: 4,
      selectable: false,
      evented: false,
    }),
  );
  canvas.add(
    new Text(String(slide.index + 1).padStart(2, "0"), {
      left: cx,
      top: cy,
      originX: "center",
      originY: "center",
      fontFamily: family,
      fontSize: typo.factNumber,
      fontWeight: "700",
      fill: pal.onAccent,
      selectable: false,
      evented: false,
    }),
  );

  // Header + body, stacked starting below the number row.
  const innerLeft = cardX + L.cardPad;
  const innerW = cardW - L.cardPad * 2;
  let cursorY = cardTop + L.cardPad + r * 2 + 48;
  const header = new Textbox(slide.header, {
    left: innerLeft,
    top: cursorY,
    width: innerW,
    fontFamily: family,
    fontSize: typo.factHeader,
    fontWeight: "700",
    fill: pal.onAccent,
    lineHeight: isCJK ? typo.lineHeight : 1.05,
    selectable: false,
    evented: false,
  });
  canvas.add(header);
  cursorY += header.getScaledHeight() + 36;

  if (slide.body) {
    const body = new Textbox(slide.body, {
      left: innerLeft,
      top: cursorY,
      width: innerW,
      fontFamily: family,
      fontSize: typo.factBody,
      fontWeight: "400",
      fill: pal.onAccent,
      lineHeight: 1.4,
      selectable: false,
      evented: false,
    });
    canvas.add(body);
  }

  const drewFact = await addFooterImage(
    canvas,
    footerSrc,
    pal.textPrimary,
    isCancelled,
  );
  if (!drewFact) addFooter(canvas, handle, domain, pal, family, typo.footer);
}
