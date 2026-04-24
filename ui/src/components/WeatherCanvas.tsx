import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";
import { StaticCanvas, FabricImage, Rect, Text } from "fabric";
import type { WeatherPost } from "../hooks/useWeatherMalaysia";
import {
  DEFAULT_WEATHER_CANVAS_CONFIG,
  type WeatherCanvasConfig,
  type TextLayerStyle,
} from "../config/weatherCanvasConfig";
import { BRAND_LOGO_IDS } from "../constants/brands";

export interface WeatherCanvasHandle {
  downloadAsPng: () => void;
  getDataUrl: () => string | null;
}

interface WeatherCanvasProps {
  posts: WeatherPost[];
  brand: string;
  backgroundOverride?: string;
  config?: WeatherCanvasConfig;
  onClick?: () => void;
}

function makeText(
  content: string,
  style: TextLayerStyle,
  opts: { left: number; top: number },
): Text {
  return new Text(content, {
    left: opts.left,
    top: opts.top,
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

export const WeatherCanvas = forwardRef<WeatherCanvasHandle, WeatherCanvasProps>(
  function WeatherCanvas({ posts, brand, backgroundOverride, config: configProp, onClick }, ref) {
    const config = configProp ?? DEFAULT_WEATHER_CANVAS_CONFIG;
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<StaticCanvas | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const renderCanvas = useCallback(
      async (canvas: StaticCanvas) => {
        canvas.clear();
        const { width, height } = config.canvas;

        // Load background image
        const bgPublicId = backgroundOverride || config.backgroundImage.publicId;
        const bgUrl = `https://res.cloudinary.com/${config.backgroundImage.cloudName}/image/upload/${bgPublicId}`;
        try {
          const bgImage = await FabricImage.fromURL(bgUrl, {
            crossOrigin: "anonymous",
          });

          if (config.backgroundImage.scaleToFit) {
            bgImage.scaleToWidth(width);
            const scaledHeight = bgImage.getScaledHeight();
            if (scaledHeight < height) {
              bgImage.scaleToHeight(height);
            }
          }
          bgImage.set({ left: 0, top: 0, selectable: false, evented: false });
          canvas.add(bgImage);
        } catch {
          setError("Failed to load background image.");
          return;
        }

        // Title
        if (config.title.enabled) {
          const titleText = makeText(config.title.text, config.title.style, {
            left: config.title.x,
            top: config.title.y,
          });
          titleText.set({ originX: "center" });
          canvas.add(titleText);
        }

        // Day + Date header (combined, centered below title)
        if ((config.dateHeader.enabled || config.dayHeader.enabled) && posts.length > 0) {
          const [y, m, d] = posts[0].date.split("-");
          const formattedDate = `${d}/${m}/${y}`;
          const day = posts[0].day || "";
          const parts: string[] = [];
          if (config.dayHeader.enabled && day) parts.push(day);
          if (config.dateHeader.enabled) parts.push(formattedDate);
          const combined = parts.join(" · ");

          const combinedText = makeText(combined, config.dateHeader.style, {
            left: config.dateHeader.x,
            top: config.dateHeader.y,
          });
          combinedText.set({ originX: "center" });
          canvas.add(combinedText);
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

        const { paddingX, paddingY, gapY, startY, rowHeight } = config.layout;
        const boxCfg = config.stateBlock.backgroundBox;
        const contentWidth = width - paddingX * 2;

        // Dynamic sizing — find scale factor based on post count
        const tier = config.dynamicSizing.find((t) => posts.length <= t.maxCount);
        const scale = tier?.scale ?? 1;
        const s = (v: number) => Math.round(v * scale);

        // Scaled values
        const scaledRowHeight = s(rowHeight);
        const scaledGapY = s(gapY);

        // Vertically center the block when few posts
        const totalBlockHeight =
          posts.length * scaledRowHeight + (posts.length - 1) * scaledGapY;
        const availableHeight = height - startY - paddingY;
        const verticalOffset =
          totalBlockHeight < availableHeight
            ? startY + (availableHeight - totalBlockHeight) / 2
            : startY;
        const scaledPad = s(boxCfg.enabled ? boxCfg.padding : 0);
        const scaledNameSize = s(config.stateBlock.locationName.fontSize);
        const scaledForecastSize = s(config.stateBlock.forecast.fontSize);
        const scaledTempSize = s(config.stateBlock.temperature.fontSize);

        // Helper to create scaled style
        const scaled = (style: TextLayerStyle, size: number): TextLayerStyle => ({
          ...style,
          fontSize: size,
        });

        if (config.layout.mode === "list") {
          // List layout — one row per state, full width
          posts.forEach((post, i) => {
            const x = paddingX;
            const y = verticalOffset + i * (scaledRowHeight + scaledGapY);

            // Separator line between rows
            if (boxCfg.enabled && i > 0) {
              canvas.add(
                new Rect({
                  left: x,
                  top: y - Math.ceil(scaledGapY / 2),
                  width: contentWidth,
                  height: boxCfg.strokeWidth,
                  fill: boxCfg.stroke,
                  selectable: false,
                  evented: false,
                }),
              );
            }

            const innerLeft = x + scaledPad;
            const innerTop = y + scaledPad;
            const innerRight = x + contentWidth - scaledPad;

            // Left side: state name + forecast (summary_when)
            canvas.add(
              makeText(post.state, scaled(config.stateBlock.locationName, scaledNameSize), {
                left: innerLeft,
                top: innerTop,
              }),
            );

            const forecastLine = [
              post.translated_summary_forecast || post.summary_forecast,
              post.translated_summary_when || post.summary_when,
            ]
              .filter(Boolean)
              .join(" · ");
            canvas.add(
              makeText(forecastLine, scaled(config.stateBlock.forecast, scaledForecastSize), {
                left: innerLeft,
                top: innerTop + scaledNameSize + s(4),
              }),
            );

            // Right side: temperature
            const tempText = makeText(
              `${post.min_temp}°C – ${post.max_temp}°C`,
              scaled(config.stateBlock.temperature, scaledTempSize),
              { left: innerRight, top: innerTop + (scaledRowHeight - scaledPad * 2 - scaledTempSize) / 2 },
            );
            tempText.set({ originX: "right" });
            canvas.add(tempText);
          });
        } else {
          // Grid layout
          const cols = config.layout.columns;
          const gapX = 16;
          const cellWidth = (contentWidth - gapX * (cols - 1)) / cols;
          const rows = Math.ceil(posts.length / cols);
          const availableHeight = height - startY - paddingY;
          const cellHeight = (availableHeight - gapY * (rows - 1)) / rows;

          posts.forEach((post, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = paddingX + col * (cellWidth + gapX);
            const y = startY + row * (cellHeight + gapY);

            if (boxCfg.enabled) {
              canvas.add(
                new Rect({
                  left: x,
                  top: y,
                  width: cellWidth,
                  height: cellHeight,
                  fill: boxCfg.fill,
                  rx: boxCfg.rx,
                  ry: boxCfg.ry,
                  selectable: false,
                  evented: false,
                }),
              );
            }

            const pad = boxCfg.enabled ? boxCfg.padding : 0;
            let textY = y + pad;

            canvas.add(
              makeText(post.state, config.stateBlock.locationName, {
                left: x + pad,
                top: textY,
              }),
            );
            textY += config.stateBlock.locationName.fontSize + 4;

            canvas.add(
              makeText(post.translated_summary_forecast || post.summary_forecast, config.stateBlock.forecast, {
                left: x + pad,
                top: textY,
              }),
            );
            textY += config.stateBlock.forecast.fontSize + 6;

            canvas.add(
              makeText(
                `${post.min_temp}°C – ${post.max_temp}°C`,
                config.stateBlock.temperature,
                { left: x + pad, top: textY },
              ),
            );
          });
        }

        // Source attribution — bottom center, subtle
        const sourceText = new Text("Source: MET Malaysia (Malaysian Meteorological Department)", {
          left: width / 2,
          top: height - 30,
          fontFamily: "Arial",
          fontSize: 13,
          fontStyle: "italic",
          fill: "rgba(255, 255, 255, 0.35)",
          originX: "center",
          selectable: false,
          evented: false,
        });
        canvas.add(sourceText);

        canvas.renderAll();
        setReady(true);
        setError(null);
      },
      [posts, brand, backgroundOverride, config],
    );

    useEffect(() => {
      if (!canvasElRef.current || posts.length === 0) return;

      // Set the HTML canvas element's pixel dimensions explicitly
      canvasElRef.current.width = config.canvas.width;
      canvasElRef.current.height = config.canvas.height;

      const canvas = new StaticCanvas(canvasElRef.current, {
        width: config.canvas.width,
        height: config.canvas.height,
        backgroundColor: config.canvas.backgroundColor,
      });
      fabricRef.current = canvas;

      renderCanvas(canvas).then(() => {
        // Fabric.js overrides canvas inline styles to pixel dimensions.
        // Reset to CSS scaling so it fits the container.
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
    }, [posts, config, renderCanvas]);

    useImperativeHandle(ref, () => ({
      downloadAsPng() {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL({
          format: "png",
          multiplier: 2,
        });
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `weather-malaysia-${posts[0]?.date ?? "today"}.png`;
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
  },
);
