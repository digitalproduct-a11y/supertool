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
  Circle,
  Text,
  Textbox,
  Gradient,
  Shadow,
  filters,
} from "fabric";
import {
  DEFAULT_QUOTE_CANVAS_CONFIG,
  type QuoteCanvasConfig,
  type TextLayerStyle,
} from "../config/quoteCanvasConfig";
import { BRAND_LOGO_IDS, getBrandHex } from "../constants/brands";

export interface QuoteCanvasHandle {
  downloadAsPng: () => void;
  getDataUrl: () => string | null;
}

export interface QuoteData {
  quote_text: string;
  quote_punch: string;
  quote_author: string;
  quote_author_title?: string;
}

interface QuoteCanvasProps {
  quote: QuoteData;
  brand: string;
  config?: QuoteCanvasConfig;
  imageUrl?: string | null;
  // Pexels image URL for the tabloid layout's single side circle. When unset,
  // empty, or the image fails to load, the circle renders nothing (silent fallback).
  pexelsImageUrl?: string | null;
  onClick?: () => void;
}

// Inline SVG noise as a data URI — mirrors the design's grain treatment.
const GRAIN_SVG_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>`,
  );

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  if (m.length !== 6) return [0, 0, 0];
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

// Lerp between two hex colors at t∈[0,1]; returns a hex string.
function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

// Crop the source image to `bounds` AND apply a tonal treatment (duotone /
// grayscale / none) in a single offscreen-canvas pass. Returns a canvas that
// can be passed to `new FabricImage(canvas, ...)`. The bounds crop ensures the
// visible subject fills the result; the treatment recolors per-pixel.
function preprocessSubject(
  img: HTMLImageElement,
  bounds: { x: number; y: number; width: number; height: number },
  treatment: "duotone" | "grayscale" | "none",
  duoDark: [number, number, number],
  duoLight: [number, number, number],
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = bounds.width;
  c.height = bounds.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return c;
  ctx.drawImage(
    img,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );
  if (treatment === "none") return c;

  const id = ctx.getImageData(0, 0, c.width, c.height);
  const data = id.data;
  if (treatment === "grayscale") {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const L =
        0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = L;
    }
  } else {
    // duotone: lerp(dark, light, luminance)
    const [dr, dg, db] = duoDark;
    const [lr, lg, lb] = duoLight;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const L =
        (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) /
        255;
      data[i] = dr + (lr - dr) * L;
      data[i + 1] = dg + (lg - dg) * L;
      data[i + 2] = db + (lb - db) * L;
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

function applyTextStyle(style: TextLayerStyle) {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight as string,
    fontStyle: style.fontStyle ?? "normal",
    fill: style.fill,
    lineHeight: style.lineHeight ?? 1.2,
    charSpacing:
      style.letterSpacing !== undefined ? style.letterSpacing * 1000 : 0,
    textAlign: style.textAlign ?? "left",
  } as const;
}

export const QuoteCanvas = forwardRef<QuoteCanvasHandle, QuoteCanvasProps>(
  function QuoteCanvas(
    {
      quote,
      brand,
      config: configProp,
      imageUrl,
      pexelsImageUrl,
      onClick,
    },
    ref,
  ) {
    const config = configProp ?? DEFAULT_QUOTE_CANVAS_CONFIG;
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<StaticCanvas | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const renderCanvas = useCallback(
      async (canvas: StaticCanvas) => {
        canvas.clear();
        const { width, height } = config.canvas;
        const brandHex = getBrandHex(brand);

        // Wait for custom fonts so Fabric measures/renders them correctly on first paint.
        try {
          await Promise.all([
            document.fonts.load(`700 116px Oswald`),
            document.fonts.load(`italic 26px Barlow`),
            document.fonts.load(`600 28px Barlow`),
            document.fonts.load(`500 22px Barlow`),
            document.fonts.load(`400 20px Barlow`),
          ]);
        } catch {
          // Continue with fallback fonts if loading fails
        }

        // ─── Tabloid layout branch ─────────────────────────────────────────
        // Full-bleed photo, dark bottom gradient, top-left logo, bottom-
        // centered headline stack. Used when Subject Cutout is OFF.
        if (config.layoutVariant === "tabloid") {
          const t = config.tabloid;
          const duoDarkT = hexToRgb(config.photo.duotoneDark);
          const duoLightT =
            config.photo.duotoneLight === "auto"
              ? hexToRgb(brandHex)
              : hexToRgb(config.photo.duotoneLight);

          // Layer 1: solid fallback fill (covered by photo when it loads)
          canvas.add(
            new Rect({
              left: 0,
              top: 0,
              width,
              height,
              fill: config.canvas.backgroundColor,
              selectable: false,
              evented: false,
            }),
          );

          // Layer 2: full-bleed cover-scaled photo
          if (imageUrl) {
            try {
              const loaded = await FabricImage.fromURL(imageUrl, {
                crossOrigin: "anonymous",
              });
              const elem = loaded.getElement() as HTMLImageElement;
              const treated = preprocessSubject(
                elem,
                {
                  x: 0,
                  y: 0,
                  width: elem.naturalWidth,
                  height: elem.naturalHeight,
                },
                t.photoTreatment,
                duoDarkT,
                duoLightT,
              );
              const photo = new FabricImage(treated);
              const photoScale = Math.max(
                width / photo.width!,
                height / photo.height!,
              );
              photo.scale(photoScale);
              photo.set({
                left: width / 2,
                top: height / 2,
                originX: "center",
                originY: "center",
                selectable: false,
                evented: false,
              });
              canvas.add(photo);
            } catch {
              // Photo failed — fallback fill remains
            }
          }

          // Layer 3: bottom darkening gradient
          const gradH = Math.round(height * t.bottomGradient.coverageRatio);
          const grad = new Rect({
            left: 0,
            top: height - gradH,
            width,
            height: gradH,
            selectable: false,
            evented: false,
          });
          grad.set(
            "fill",
            new Gradient({
              type: "linear",
              coords: { x1: 0, y1: 0, x2: 0, y2: gradH },
              colorStops: [
                {
                  offset: 0,
                  color: t.bottomGradient.color,
                  opacity: t.bottomGradient.startOpacity,
                },
                {
                  offset: 1,
                  color: t.bottomGradient.color,
                  opacity: t.bottomGradient.endOpacity,
                },
              ],
            }),
          );
          canvas.add(grad);

          // Layer 4: top-left brand logo
          if (brand) {
            const logoId =
              BRAND_LOGO_IDS[brand as keyof typeof BRAND_LOGO_IDS] ?? "";
            if (logoId) {
              try {
                const logoUrl = `https://res.cloudinary.com/dymmqtqyg/image/upload/${logoId}`;
                const logoImg = await FabricImage.fromURL(logoUrl, {
                  crossOrigin: "anonymous",
                });
                logoImg.scaleToWidth(t.logo.width);
                if (logoImg.getScaledHeight() > t.logo.maxHeight) {
                  logoImg.scaleToHeight(t.logo.maxHeight);
                }
                logoImg.set({
                  // x is distance from the RIGHT edge for the tabloid layout
                  left: width - t.logo.x,
                  top: t.logo.y,
                  originX: "right",
                  originY: "top",
                  selectable: false,
                  evented: false,
                });
                canvas.add(logoImg);
              } catch {
                // Logo failed — skip
              }
            }
          }

          // Layer 5: single side circle. Renders a white halo behind a
          // circular-clipped Pexels image, so the border sits flush against
          // the image edge with no stroke seam. URL comes from props; fails
          // silently if missing or the image won't load. The user toggle in
          // QuotePage controls whether a URL is passed at all.
          if (t.sideCircle.enabled && pexelsImageUrl) {
            try {
              const circleImg = await FabricImage.fromURL(pexelsImageUrl, {
                crossOrigin: "anonymous",
              });

              const shadowCfg = t.sideCircle.shadow;
              const fabricShadow = shadowCfg.enabled
                ? new Shadow({
                    color: shadowCfg.color,
                    blur: shadowCfg.blur,
                    offsetX: shadowCfg.offsetX,
                    offsetY: shadowCfg.offsetY,
                  })
                : null;

              const target = t.sideCircle.radius * 2;
              const imgScale = Math.max(
                target / circleImg.width!,
                target / circleImg.height!,
              );
              circleImg.scale(imgScale);
              circleImg.set({
                left: t.sideCircle.center.x,
                top: t.sideCircle.center.y,
                originX: "center",
                originY: "center",
                selectable: false,
                evented: false,
                // Shadow projects from the clipped circular silhouette of the image.
                shadow: fabricShadow,
              });
              // absolutePositioned makes the clipPath use canvas coords,
              // so the image's own scale transform doesn't shrink the clip.
              // Without this, large source Pexels images render with a clip
              // far smaller than `radius`, leaving a gap from the stroke ring.
              circleImg.clipPath = new Circle({
                radius: t.sideCircle.radius,
                originX: "center",
                originY: "center",
                left: t.sideCircle.center.x,
                top: t.sideCircle.center.y,
                absolutePositioned: true,
              });
              canvas.add(circleImg);

              // Thin white stroke OUTSIDE the image edge.
              // Path radius is offset by strokeWidth/2 so the stroke's inner
              // edge sits flush with the image — no image content is covered.
              if (t.sideCircle.strokeWidth > 0) {
                const ring = new Circle({
                  left: t.sideCircle.center.x,
                  top: t.sideCircle.center.y,
                  radius:
                    t.sideCircle.radius + t.sideCircle.strokeWidth / 2,
                  originX: "center",
                  originY: "center",
                  fill: "transparent",
                  stroke: t.sideCircle.strokeColor,
                  strokeWidth: t.sideCircle.strokeWidth,
                  selectable: false,
                  evented: false,
                });
                canvas.add(ring);
              }
            } catch {
              // Image failed — leave the slot empty
            }
          }

          // Layer 6: bottom-anchored centered text stack.
          // Stack order: quote mark → punch → subtitle → author.
          const qmCfg = t.bottomStack.quoteMark;
          const quoteMark = qmCfg.enabled
            ? new Text(qmCfg.text, {
                ...applyTextStyle(qmCfg.style),
                left: width / 2,
                originX: "center",
                top: 0,
                selectable: false,
                evented: false,
              })
            : null;

          const punchTier = t.dynamicSizing.find(
            (tier) => quote.quote_punch.length <= tier.maxLength,
          );
          const punchScale = punchTier?.scale ?? 1;
          const punchFontSize = Math.round(
            t.bottomStack.punch.fontSize * punchScale,
          );
          const punchStyle = applyTextStyle({
            ...t.bottomStack.punch,
            fontSize: punchFontSize,
          });
          const punchText = t.bottomStack.punch.uppercase
            ? quote.quote_punch.toUpperCase()
            : quote.quote_punch;
          const stackInner = width - t.bottomStack.sidePadding * 2;
          const punch = new Textbox(punchText, {
            ...punchStyle,
            width: Math.min(t.bottomStack.punchMaxWidth, stackInner),
            left: width / 2,
            originX: "center",
            top: 0,
            selectable: false,
            evented: false,
          });

          const subtitleRaw = quote.quote_text;
          // Scale subtitle font size based on raw quote length so long quotes
          // wrap to fewer lines and don't push the punch off the canvas.
          const subtitleTier = t.subtitleDynamicSizing.find(
            (tier) => subtitleRaw.length <= tier.maxLength,
          );
          const subtitleScale = subtitleTier?.scale ?? 1;
          const subtitleFontSize = Math.round(
            t.bottomStack.subtitle.fontSize * subtitleScale,
          );
          const subtitleStyle = applyTextStyle({
            ...t.bottomStack.subtitle,
            fontSize: subtitleFontSize,
          });
          const subtitleText = t.bottomStack.subtitle.uppercase
            ? subtitleRaw.toUpperCase()
            : subtitleRaw;
          const subtitle = new Textbox(subtitleText, {
            ...subtitleStyle,
            width: stackInner,
            left: width / 2,
            originX: "center",
            top: 0,
            selectable: false,
            evented: false,
          });

          const authorTitleRaw = quote.quote_author_title?.trim();
          const authorJoined = authorTitleRaw
            ? `${quote.quote_author} • ${authorTitleRaw.replace(
                /\b\w/g,
                (c) => c.toUpperCase(),
              )}`
            : quote.quote_author;
          const authorStyle = applyTextStyle(t.bottomStack.author);
          const authorText = t.bottomStack.author.uppercase
            ? authorJoined.toUpperCase()
            : authorJoined;
          const author = new Text(authorText, {
            ...authorStyle,
            left: width / 2,
            originX: "center",
            top: 0,
            selectable: false,
            evented: false,
          });

          // Stack assembly. authorPosition === "top" places author as a kicker
          // above the quote mark so the whole group grows upward together —
          // long quote_text never pushes other elements into the author block.
          const authorEntry = {
            obj: author,
            height: author.getScaledHeight(),
            marginBottom: t.bottomStack.authorMarginBottom,
          };
          const quoteMarkEntry = quoteMark
            ? {
                obj: quoteMark,
                height: quoteMark.getScaledHeight(),
                marginBottom: qmCfg.marginBottom,
              }
            : null;
          const punchEntry = {
            obj: punch,
            height: punch.getScaledHeight(),
            marginBottom: t.bottomStack.punchMarginBottom,
          };
          const subtitleEntry = {
            obj: subtitle,
            height: subtitle.getScaledHeight(),
            marginBottom: t.bottomStack.subtitleMarginBottom,
          };

          const stackEntries: Array<{
            obj: Text | Textbox;
            height: number;
            marginBottom: number;
          }> = [];
          if (t.bottomStack.authorPosition === "top") {
            // quote mark → author kicker → punch → subtitle
            if (quoteMarkEntry) stackEntries.push(quoteMarkEntry);
            stackEntries.push(authorEntry, punchEntry, {
              ...subtitleEntry,
              marginBottom: 0, // last item — no trailing gap
            });
          } else {
            if (quoteMarkEntry) stackEntries.push(quoteMarkEntry);
            stackEntries.push(punchEntry, subtitleEntry, {
              ...authorEntry,
              marginBottom: 0,
            });
          }

          const totalStackH = stackEntries.reduce(
            (sum, e, i) =>
              sum + e.height + (i < stackEntries.length - 1 ? e.marginBottom : 0),
            0,
          );
          const stackBottom = height - t.bottomStack.bottomPadding;
          let cursorY = stackBottom - totalStackH;
          for (const entry of stackEntries) {
            const isAuthor = entry.obj === author;
            const isSubtitle = entry.obj === subtitle;
            const isQuoteMark = entry.obj === quoteMark;
            const offY = isAuthor
              ? t.bottomStack.authorOffsetY
              : isSubtitle
                ? t.bottomStack.subtitleOffsetY
                : isQuoteMark
                  ? t.bottomStack.quoteMark.offsetY
                  : 0;
            const offX = isAuthor
              ? t.bottomStack.authorOffsetX
              : isSubtitle
                ? t.bottomStack.subtitleOffsetX
                : isQuoteMark
                  ? t.bottomStack.quoteMark.offsetX
                  : 0;
            entry.obj.set({
              top: cursorY + offY,
              left: width / 2 + offX,
            });
            canvas.add(entry.obj);
            cursorY += entry.height + entry.marginBottom;
          }

          canvas.renderAll();
          setReady(true);
          setError(null);
          return;
        }
        // ───────────────────────────────────────────────────────────────────

        // Resolve the canvas background and the color photo-fades should fade TO.
        // For "paper" / "solid" the fade target is the flat fill; for "radial-wash"
        // we use the corner color (white); for "image" we use the configured fadeTarget.
        const bgStyle = config.canvas.backgroundStyle;
        let bgFlatColor = "#ffffff";
        if (bgStyle === "paper") {
          bgFlatColor = config.canvas.paperTexture.color;
        } else if (bgStyle === "solid") {
          bgFlatColor = config.canvas.backgroundColor;
        }
        const fadeTargetColor =
          bgStyle === "radial-wash"
            ? "#ffffff"
            : bgStyle === "image"
              ? config.canvas.backgroundImage.fadeTarget
              : bgFlatColor;

        // Layer 1: background plate
        if (bgStyle === "image") {
          // Always paint the flat backgroundColor first as a fallback; image draws over it.
          canvas.add(
            new Rect({
              left: 0,
              top: 0,
              width,
              height,
              fill: config.canvas.backgroundColor,
              selectable: false,
              evented: false,
            }),
          );
          try {
            const bgImg = await FabricImage.fromURL(
              config.canvas.backgroundImage.url,
              { crossOrigin: "anonymous" },
            );
            // Cover-scale the image to fill the canvas
            const sX = width / bgImg.width!;
            const sY = height / bgImg.height!;
            const s = Math.max(sX, sY);
            bgImg.scale(s);
            bgImg.set({
              left: width / 2,
              top: height / 2,
              originX: "center",
              originY: "center",
              opacity: config.canvas.backgroundImage.opacity,
              selectable: false,
              evented: false,
            });
            canvas.add(bgImg);
          } catch {
            // Fallback to the flat fill if the image can't load
          }
        } else if (bgStyle === "radial-wash") {
          const innerColor = mixHex(
            "#ffffff",
            brandHex,
            config.canvas.radialWash.innerColorMix,
          );
          const cx = width * config.canvas.radialWash.centerX;
          const cy = height * config.canvas.radialWash.centerY;
          const r = Math.max(width, height) * 0.85;
          const wash = new Rect({
            left: 0,
            top: 0,
            width,
            height,
            selectable: false,
            evented: false,
          });
          wash.set(
            "fill",
            new Gradient({
              type: "radial",
              coords: { x1: cx, y1: cy, r1: 0, x2: cx, y2: cy, r2: r },
              colorStops: [
                { offset: 0, color: innerColor, opacity: 1 },
                { offset: 1, color: "#ffffff", opacity: 1 },
              ],
            }),
          );
          canvas.add(wash);
        } else {
          canvas.add(
            new Rect({
              left: 0,
              top: 0,
              width,
              height,
              fill: bgFlatColor,
              selectable: false,
              evented: false,
            }),
          );
        }
        // Paper preset folds grain into Layer 1 to avoid double-stamping later.
        if (bgStyle === "paper") {
          try {
            const paperGrain = await FabricImage.fromURL(GRAIN_SVG_URI);
            paperGrain.scaleToWidth(width);
            if (paperGrain.getScaledHeight() < height) {
              paperGrain.scaleToHeight(height);
            }
            paperGrain.set({
              left: 0,
              top: 0,
              opacity: config.canvas.paperTexture.grainOpacity,
              selectable: false,
              evented: false,
            });
            canvas.add(paperGrain);
          } catch {
            // Grain is decorative
          }
        }

        // Resolve duotone colors once (light = "auto" maps to current brand hex)
        const duoDark = hexToRgb(config.photo.duotoneDark);
        const duoLight =
          config.photo.duotoneLight === "auto"
            ? hexToRgb(brandHex)
            : hexToRgb(config.photo.duotoneLight);
        const treatment = config.photo.treatment;

        const tonalFilters = (): filters.BaseFilter<string>[] => {
          const list: filters.BaseFilter<string>[] = [];
          if (config.photo.contrast) {
            list.push(new filters.Contrast({ contrast: config.photo.contrast }));
          }
          if (config.photo.brightness) {
            list.push(
              new filters.Brightness({ brightness: config.photo.brightness }),
            );
          }
          return list;
        };

        // Layer 2: photo
        if (imageUrl) {
          try {
            const loaded = await FabricImage.fromURL(imageUrl, {
              crossOrigin: "anonymous",
            });
            const elem = loaded.getElement() as HTMLImageElement;
            // Photo isn't bg-removed, so no alpha bounds — use the full image
            const treatedCanvas = preprocessSubject(
              elem,
              {
                x: 0,
                y: 0,
                width: elem.naturalWidth,
                height: elem.naturalHeight,
              },
              treatment,
              duoDark,
              duoLight,
            );
            const photo = new FabricImage(treatedCanvas);
            // Scale photo to fill the configured photo box (cover-style)
            const targetW = config.photo.width;
            const targetH = config.photo.height;
            const scale = Math.max(
              targetW / photo.width!,
              targetH / photo.height!,
            );
            photo.scale(scale);
            // Anchor the photo by its CENTER at the box's center. With cover-scale,
            // a landscape source would otherwise overflow far to the right when
            // top-left anchored — pushing the subject off the left half. Centering
            // keeps the source's middle (where the subject usually is) inside the box.
            photo.set({
              left: config.photo.x + targetW / 2,
              top: config.photo.y + targetH / 2,
              originX: "center",
              originY: "center",
              selectable: false,
              evented: false,
            });
            const tone = tonalFilters();
            if (tone.length) {
              photo.filters = tone;
              photo.applyFilters();
            }
            canvas.add(photo);

            // Right-edge horizontal fade (transparent → background color)
            const hFade = new Rect({
              left: 0,
              top: 0,
              width,
              height,
              selectable: false,
              evented: false,
            });
            hFade.set(
              "fill",
              new Gradient({
                type: "linear",
                coords: { x1: 0, y1: 0, x2: width, y2: 0 },
                colorStops: [
                  {
                    offset: config.photoFade.horizontalStart,
                    color: fadeTargetColor,
                    opacity: 0,
                  },
                  {
                    offset: config.photoFade.horizontalEnd,
                    color: fadeTargetColor,
                    opacity: 1,
                  },
                ],
              }),
            );
            canvas.add(hFade);

            // Bottom fade (transparent → background color)
            const bFade = new Rect({
              left: 0,
              top: height - config.photoFade.bottomHeight,
              width,
              height: config.photoFade.bottomHeight,
              selectable: false,
              evented: false,
            });
            bFade.set(
              "fill",
              new Gradient({
                type: "linear",
                coords: {
                  x1: 0,
                  y1: 0,
                  x2: 0,
                  y2: config.photoFade.bottomHeight,
                },
                colorStops: [
                  { offset: 0, color: fadeTargetColor, opacity: 0 },
                  { offset: 1, color: fadeTargetColor, opacity: 1 },
                ],
              }),
            );
            canvas.add(bFade);
          } catch {
            // Photo failed — brand plate alone is fine
          }
        }

        // Layer 3: vignette (radial darken from edges inward)
        if (config.vignette.enabled) {
          const v = new Rect({
            left: 0,
            top: 0,
            width,
            height,
            selectable: false,
            evented: false,
          });
          const cx = width * config.vignette.centerX;
          const cy = height * config.vignette.centerY;
          const radius = Math.max(width, height) * 0.7;
          v.set(
            "fill",
            new Gradient({
              type: "radial",
              coords: {
                x1: cx,
                y1: cy,
                r1: 0,
                x2: cx,
                y2: cy,
                r2: radius,
              },
              colorStops: [
                { offset: config.vignette.innerStop, color: "#000000", opacity: 0 },
                { offset: 1, color: "#000000", opacity: config.vignette.outerAlpha },
              ],
            }),
          );
          canvas.add(v);
        }

        // Layer 4: standalone grain (skipped when "paper" already folded grain into Layer 1)
        if (config.grain.enabled && bgStyle !== "paper") {
          try {
            const grain = await FabricImage.fromURL(GRAIN_SVG_URI);
            grain.scaleToWidth(width);
            if (grain.getScaledHeight() < height) {
              grain.scaleToHeight(height);
            }
            grain.set({
              left: 0,
              top: 0,
              opacity: config.grain.opacity,
              selectable: false,
              evented: false,
            });
            canvas.add(grain);
          } catch {
            // Grain is decorative; skip if it fails
          }
        }

        // Right-side content layout starts here
        const contentLeft = width - config.content.right - config.content.width;
        const contentRight = width - config.content.right;
        const innerLeft = contentLeft + config.content.paddingLeft;
        const innerRight = contentRight - config.content.paddingRight;
        const innerWidth = innerRight - innerLeft;

        // The whole composition (quote mark → text → logo) lays out as a single
        // vertically-centered stack. Each entry contributes height + marginBottom
        // to the total; the block is then offset to center inside the content area.
        const layers: Array<{
          obj: Text | Textbox | FabricImage;
          height: number;
          marginBottom: number;
          offsetY?: number; // optional fine-tune; doesn't affect the cursor
        }> = [];

        // Layer 5: open quote mark (first in stack)
        if (config.quoteMark.enabled) {
          const qmStyle = applyTextStyle(config.quoteMark.style);
          const qm = new Text(config.quoteMark.text, {
            ...qmStyle,
            left: innerLeft + config.quoteMark.offsetX,
            top: 0,
            selectable: false,
            evented: false,
          });
          layers.push({
            obj: qm,
            height: qm.getScaledHeight(),
            marginBottom: config.quoteMark.gapBelow,
          });
        }

        // Layer 6: intro (quote_text, italic Barlow, wraps)
        const introStyle = applyTextStyle(config.quoteIntro.style);
        const intro = new Textbox(quote.quote_text, {
          ...introStyle,
          width: Math.min(config.quoteIntro.maxWidth, innerWidth),
          left: innerLeft,
          top: 0,
          selectable: false,
          evented: false,
        });
        layers.push({
          obj: intro,
          height: intro.getScaledHeight(),
          marginBottom: config.quoteIntro.marginBottom,
        });

        // Layer 7: punch (quote_punch, big Oswald uppercase, dynamic sizing, wraps)
        const punchTier = config.dynamicSizing.find(
          (t) => quote.quote_punch.length <= t.maxLength,
        );
        const punchScale = punchTier?.scale ?? 1;
        const punchFontSize = Math.round(
          config.quotePunch.style.fontSize * punchScale,
        );
        // "auto" sentinel resolves to the current brand hex
        const punchFill =
          config.quotePunch.style.fill === "auto"
            ? brandHex
            : config.quotePunch.style.fill;
        const punchStyle = applyTextStyle({
          ...config.quotePunch.style,
          fontSize: punchFontSize,
          fill: punchFill,
        });
        const punchText = config.quotePunch.style.uppercase
          ? quote.quote_punch.toUpperCase()
          : quote.quote_punch;
        const punch = new Textbox(punchText, {
          ...punchStyle,
          width: Math.min(config.quotePunch.maxWidth, innerWidth),
          left: innerLeft,
          top: 0,
          selectable: false,
          evented: false,
        });
        layers.push({
          obj: punch,
          height: punch.getScaledHeight(),
          marginBottom: config.quotePunch.marginBottom,
        });

        // Layer 8: author name
        const authorNameStyle = applyTextStyle(config.authorName.style);
        const authorName = new Text(quote.quote_author, {
          ...authorNameStyle,
          left: innerLeft,
          top: 0,
          selectable: false,
          evented: false,
        });
        layers.push({
          obj: authorName,
          height: authorName.getScaledHeight(),
          marginBottom: config.authorName.marginBottom,
        });

        // Layer 9: author title (only when present). Its marginBottom doubles as
        // the gap before the logo when the brand strip is enabled.
        const hasTitle =
          !!quote.quote_author_title && !!quote.quote_author_title.trim();
        if (hasTitle && quote.quote_author_title) {
          const titleStyle = applyTextStyle(config.authorTitle.style);
          const titleText = config.authorTitle.style.capitalize
            ? quote.quote_author_title.replace(
                /\b\w/g,
                (c) => c.toUpperCase(),
              )
            : quote.quote_author_title;
          const authorTitle = new Text(titleText, {
            ...titleStyle,
            left: innerLeft,
            top: 0,
            selectable: false,
            evented: false,
          });
          layers.push({
            obj: authorTitle,
            height: authorTitle.getScaledHeight(),
            marginBottom: config.brandStrip.enabled
              ? config.brandStrip.marginTop
              : 0,
          });
        }

        // Layer 10: brand logo — last in the stack, after author title
        if (config.brandStrip.enabled && brand) {
          // If there's no title, attach the marginTop gap to the previous layer instead
          if (!hasTitle && layers.length > 0) {
            const prev = layers[layers.length - 1];
            prev.marginBottom = Math.max(
              prev.marginBottom,
              config.brandStrip.marginTop,
            );
          }
          const logoId =
            BRAND_LOGO_IDS[brand as keyof typeof BRAND_LOGO_IDS] ?? "";
          if (logoId) {
            const logoUrl = `https://res.cloudinary.com/dymmqtqyg/image/upload/${logoId}`;
            try {
              const logoImg = await FabricImage.fromURL(logoUrl, {
                crossOrigin: "anonymous",
              });
              logoImg.scaleToWidth(config.brandStrip.logo.width);
              if (logoImg.getScaledHeight() > config.brandStrip.logo.maxHeight) {
                logoImg.scaleToHeight(config.brandStrip.logo.maxHeight);
              }
              // Center the logo horizontally inside the content column,
              // then apply the configured offsetX (negative pulls left).
              const contentCenterX = (innerLeft + innerRight) / 2;
              logoImg.set({
                left: contentCenterX + config.brandStrip.offsetX,
                top: 0,
                originX: "center",
                originY: "top",
                selectable: false,
                evented: false,
              });
              layers.push({
                obj: logoImg,
                height: logoImg.getScaledHeight(),
                marginBottom: 0,
                offsetY: config.brandStrip.offsetY,
              });
            } catch {
              // Skip logo if it fails to load — stack still centers without it
            }
          }
        }

        // Compute vertical offset to center the whole stack inside the content area
        const totalHeight = layers.reduce(
          (sum, l, i) =>
            sum + l.height + (i < layers.length - 1 ? l.marginBottom : 0),
          0,
        );
        const contentTop = config.content.paddingTop;
        const contentBottom = height - config.content.paddingBottom;
        const availableHeight = contentBottom - contentTop;
        let cursorY =
          contentTop + Math.max(0, (availableHeight - totalHeight) / 2);

        for (const l of layers) {
          // offsetY is a visual nudge — it doesn't affect where the next item lands
          l.obj.set({ top: cursorY + (l.offsetY ?? 0) });
          canvas.add(l.obj);
          cursorY += l.height + l.marginBottom;
        }

        canvas.renderAll();
        setReady(true);
        setError(null);
      },
      [quote, brand, config, imageUrl, pexelsImageUrl],
    );

    // Double-buffered render: build the new frame on a detached canvas, then
    // blit it onto the visible <canvas> in a single drawImage call. This keeps
    // the previous frame on screen while async work (font loading, image
    // fetches) completes — no flicker when brand/config changes.
    useEffect(() => {
      if (!canvasElRef.current || !quote.quote_text) return;

      let cancelled = false;
      const { width, height, backgroundColor } = config.canvas;

      const offscreenEl = document.createElement("canvas");
      offscreenEl.width = width;
      offscreenEl.height = height;
      const offscreen = new StaticCanvas(offscreenEl, {
        width,
        height,
        backgroundColor,
      });

      renderCanvas(offscreen).then(() => {
        if (cancelled) {
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
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(offscreenEl, 0, 0);
        }
        visibleEl.style.width = "100%";
        visibleEl.style.height = "100%";

        // Swap fabric ref so downloadAsPng/getDataUrl reflect the latest frame
        const prev = fabricRef.current;
        fabricRef.current = offscreen;
        if (prev) prev.dispose();
      });

      return () => {
        cancelled = true;
      };
    }, [quote, brand, config, renderCanvas]);

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
        link.download = `quote-${quote.quote_author.replace(/\s+/g, "-").toLowerCase()}.png`;
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
      <div className="flex flex-col items-center gap-4">
        {error && (
          <p className="text-sm text-red-500 font-medium">{error}</p>
        )}
        <div
          className={`w-full overflow-hidden rounded-xl border border-neutral-200${onClick ? " cursor-pointer hover:opacity-90 transition" : ""}`}
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
              display: quote.quote_text ? "block" : "none",
            }}
          />
          {!ready && quote.quote_text && (
            <div className="flex items-center justify-center h-64 text-sm text-neutral-400">
              Rendering preview...
            </div>
          )}
        </div>
      </div>
    );
  },
);
