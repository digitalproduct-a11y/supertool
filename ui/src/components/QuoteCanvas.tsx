import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";
import { StaticCanvas, FabricImage, Rect, Text, Textbox } from "fabric";
import {
  DEFAULT_QUOTE_CANVAS_CONFIG,
  type QuoteCanvasConfig,
  type TextLayerStyle,
} from "../config/quoteCanvasConfig";
import { BRAND_LOGO_IDS } from "../constants/brands";

export interface QuoteCanvasHandle {
  downloadAsPng: () => void;
  getDataUrl: () => string | null;
}

export interface QuoteData {
  quote_text: string;
  quote_author: string;
  quote_author_title?: string;
}

interface QuoteCanvasProps {
  quote: QuoteData;
  brand: string;
  config?: QuoteCanvasConfig;
  imageUrl?: string | null;
  cutoutImageUrl?: string | null;
  isProcessingCutout?: boolean;
  onClick?: () => void;
}

function makeText(
  content: string,
  style: TextLayerStyle,
  opts: { left: number; top: number; width?: number },
): Text {
  return new Text(content, {
    left: opts.left,
    top: opts.top,
    width: opts.width,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight as string,
    fill: style.fill,
    lineHeight: style.lineHeight ?? 1.2,
    textAlign: style.textAlign ?? "left",
    selectable: false,
    evented: false,
  });
}

export const QuoteCanvas = forwardRef<QuoteCanvasHandle, QuoteCanvasProps>(
  function QuoteCanvas({ quote, brand, config: configProp, imageUrl, cutoutImageUrl, isProcessingCutout, onClick }, ref) {
    const config = configProp ?? DEFAULT_QUOTE_CANVAS_CONFIG;
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<StaticCanvas | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const renderCanvas = useCallback(
      async (canvas: StaticCanvas) => {
        canvas.clear();
        const { width, height } = config.canvas;

        // Background image — use article image if available, else default placeholder
        const bgUrl = imageUrl
          ? imageUrl
          : `https://res.cloudinary.com/${config.backgroundImage.cloudName}/image/upload/${config.backgroundImage.publicId}`;
        try {
          const bgImage = await FabricImage.fromURL(bgUrl, {
            crossOrigin: "anonymous",
          });
          if (config.backgroundImage.scaleToFit) {
            bgImage.scaleToWidth(width);
            if (bgImage.getScaledHeight() < height) {
              bgImage.scaleToHeight(height);
            }
          }
          bgImage.set({ left: 0, top: 0, selectable: false, evented: false });
          canvas.add(bgImage);
        } catch {
          // Fallback: dark overlay rectangle
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
        }

        // Semi-transparent overlay for text readability
        canvas.add(
          new Rect({
            left: 0,
            top: 0,
            width,
            height,
            fill: "rgba(0, 0, 0, 0.45)",
            selectable: false,
            evented: false,
          }),
        );

        // Cutout image layer (background-removed subject)
        if (cutoutImageUrl && config.cutoutImage.enabled) {
          try {
            const cutoutImg = await FabricImage.fromURL(cutoutImageUrl, {
              crossOrigin: "anonymous",
            });
            const scaleW = config.cutoutImage.maxWidth / cutoutImg.width!;
            const scaleH = config.cutoutImage.maxHeight / cutoutImg.height!;
            const scale = Math.min(scaleW, scaleH);
            cutoutImg.scale(scale);
            cutoutImg.set({
              left: config.cutoutImage.x,
              top: config.cutoutImage.y,
              originX: config.cutoutImage.originX,
              originY: config.cutoutImage.originY,
              opacity: config.cutoutImage.opacity,
              selectable: false,
              evented: false,
            });
            canvas.add(cutoutImg);
          } catch {
            // Skip cutout if loading fails
          }
        }

        // Decorative quotation mark
        if (config.quoteMark.enabled) {
          const qm = makeText(config.quoteMark.text, config.quoteMark.style, {
            left: config.quoteMark.x,
            top: config.quoteMark.y,
          });
          qm.set({ originX: "center" });
          canvas.add(qm);
        }

        // Dynamic sizing based on quote length
        const tier = config.dynamicSizing.find(
          (t) => quote.quote_text.length <= t.maxLength,
        );
        const scale = tier?.scale ?? 1;

        // Quote text
        const scaledFontSize = Math.round(
          config.quoteText.style.fontSize * scale,
        );
        const quoteStyle: TextLayerStyle = {
          ...config.quoteText.style,
          fontSize: scaledFontSize,
        };
        const quoteTextObj = new Textbox(
          `\u201C${quote.quote_text}\u201D`,
          {
            left: config.quoteText.x,
            top: config.quoteText.y,
            width: config.quoteText.maxWidth,
            fontFamily: quoteStyle.fontFamily,
            fontSize: quoteStyle.fontSize,
            fontWeight: quoteStyle.fontWeight as string,
            fill: quoteStyle.fill,
            lineHeight: quoteStyle.lineHeight ?? 1.2,
            textAlign: quoteStyle.textAlign ?? "center",
            originX: "center",
            selectable: false,
            evented: false,
          },
        );
        canvas.add(quoteTextObj);

        // Calculate where quote text ends
        const quoteBottom =
          config.quoteText.y + quoteTextObj.getScaledHeight();

        // Author name
        const authorNameObj = makeText(
          `— ${quote.quote_author}`,
          config.authorName.style,
          {
            left: config.authorName.x,
            top: quoteBottom + config.authorName.offsetY,
          },
        );
        authorNameObj.set({ originX: "center" });
        canvas.add(authorNameObj);

        // Author title (optional)
        if (quote.quote_author_title) {
          const authorTitleObj = makeText(
            quote.quote_author_title,
            config.authorTitle.style,
            {
              left: config.authorTitle.x,
              top:
                quoteBottom +
                config.authorName.offsetY +
                config.authorName.style.fontSize +
                config.authorTitle.offsetY,
            },
          );
          authorTitleObj.set({ originX: "center" });
          canvas.add(authorTitleObj);
        }

        // Brand logo
        if (config.brandLogo.enabled && brand) {
          const logoId =
            BRAND_LOGO_IDS[brand as keyof typeof BRAND_LOGO_IDS] ?? "";
          if (logoId) {
            const logoUrl = `https://res.cloudinary.com/${config.backgroundImage.cloudName}/image/upload/${logoId}`;
            try {
              const logoImg = await FabricImage.fromURL(logoUrl, {
                crossOrigin: "anonymous",
              });
              logoImg.scaleToWidth(config.brandLogo.width);
              logoImg.set({
                left: config.brandLogo.x,
                top: config.brandLogo.y,
                originX: "center",
                selectable: false,
                evented: false,
              });
              canvas.add(logoImg);
            } catch {
              // Skip logo if it fails to load
            }
          }
        }

        canvas.renderAll();
        setReady(true);
        setError(null);
      },
      [quote, brand, config, imageUrl, cutoutImageUrl],
    );

    useEffect(() => {
      if (!canvasElRef.current || !quote.quote_text) return;

      canvasElRef.current.width = config.canvas.width;
      canvasElRef.current.height = config.canvas.height;

      const canvas = new StaticCanvas(canvasElRef.current, {
        width: config.canvas.width,
        height: config.canvas.height,
        backgroundColor: config.canvas.backgroundColor,
      });
      fabricRef.current = canvas;

      renderCanvas(canvas).then(() => {
        const el = canvasElRef.current;
        if (el) {
          el.style.width = "100%";
          el.style.height = "100%";
        }
      });

      return () => {
        canvas.dispose();
        fabricRef.current = null;
        setReady(false);
      };
    }, [quote, config, renderCanvas]);

    useImperativeHandle(ref, () => ({
      downloadAsPng() {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `quote-${quote.quote_author.replace(/\s+/g, "-").toLowerCase()}.png`;
        link.click();
      },
      getDataUrl() {
        const canvas = fabricRef.current;
        if (!canvas) return null;
        return canvas.toDataURL({ format: "png", multiplier: 2 });
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
