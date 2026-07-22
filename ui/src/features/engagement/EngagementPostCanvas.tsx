import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { StaticCanvas, FabricImage, Text } from "fabric";
import { BRAND_LOGO_IDS } from "../../constants/brands";
import { brandLogoUrl, fitPhotoUrl } from "../../utils/imageProvider";
import {
  getEngagementCanvasConfig,
  type EngagementCanvasConfig,
  type EngagementTextLayer,
} from "../../config/engagementCanvasConfig";

export interface EngagementPostCanvasHandle {
  getDataUrl: () => string;
  downloadAsPng: (filename?: string) => void;
}

interface EngagementPostCanvasProps {
  topic: string;
  headline: string;
  subtitle: string;
  photoUrl: string | null;
  brand: string;
  typeLabel?: string;
  onClick?: () => void;
}

// Word-wrap `text` into lines that fit `maxWidth` at the given font.
function wrapLines(text: string, font: string, maxWidth: number): string[] {
  if (!text) return [];
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = font;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function addTextLayer(
  canvas: StaticCanvas,
  cfg: EngagementCanvasConfig,
  layer: EngagementTextLayer,
  text: string,
) {
  const lines = wrapLines(
    text,
    `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`,
    layer.maxWidth,
  );
  if (!lines.length) return;
  const blockHeight = lines.length * layer.fontSize * 1.2;
  const top =
    layer.anchor === "top" ? layer.y : cfg.height - layer.y - blockHeight;
  const t = new Text(lines.join("\n"), {
    left: cfg.width / 2,
    top,
    fontSize: layer.fontSize,
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    fill: layer.fill,
    textAlign: "center",
    originX: "center",
    originY: "top",
    selectable: false,
    evented: false,
  });
  canvas.add(t);
}

async function renderEngagementCanvas(
  canvas: StaticCanvas,
  cfg: EngagementCanvasConfig,
  props: EngagementPostCanvasProps,
) {
  canvas.clear();
  if (!props.photoUrl) {
    canvas.renderAll();
    return;
  }
  await document.fonts.load(`700 ${cfg.headline.fontSize}px ${cfg.headline.fontFamily}`);
  await document.fonts.load(`400 ${cfg.subtitle.fontSize}px ${cfg.subtitle.fontFamily}`);

  // Base photo — subject-aware crop to the canvas size (ImageKit fo-auto ≈ the old
  // Cloudinary g_face), so it arrives already fitted; external URLs pass through and
  // fall back to cover-fill below.
  try {
    const src = fitPhotoUrl(props.photoUrl, cfg.width, cfg.height, cfg.photoCrop);
    const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
    const iw = img.width || cfg.width;
    const ih = img.height || cfg.height;
    const scale = Math.max(cfg.width / iw, cfg.height / ih);
    img.set({
      scaleX: scale,
      scaleY: scale,
      left: (cfg.width - iw * scale) / 2,
      top: (cfg.height - ih * scale) / 2,
      originX: "left",
      originY: "top",
      selectable: false,
      evented: false,
    });
    canvas.add(img);
  } catch {
    canvas.renderAll();
    return;
  }

  // Bottom gradient overlay.
  try {
    const g = document.createElement("canvas");
    g.width = cfg.width;
    g.height = cfg.height;
    const gctx = g.getContext("2d")!;
    const grad = gctx.createLinearGradient(0, cfg.height * cfg.gradient.startFraction, 0, cfg.height);
    grad.addColorStop(0, cfg.gradient.from);
    grad.addColorStop(1, cfg.gradient.to);
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, cfg.width, cfg.height);
    const gImg = await FabricImage.fromURL(g.toDataURL("image/png"));
    gImg.set({ left: 0, top: 0, originX: "left", originY: "top", selectable: false, evented: false });
    canvas.add(gImg);
  } catch { /* gradient is cosmetic */ }

  // Brand logo.
  const logoId = BRAND_LOGO_IDS[props.brand as keyof typeof BRAND_LOGO_IDS];
  if (logoId) {
    try {
      const logo = await FabricImage.fromURL(brandLogoUrl(logoId), { crossOrigin: "anonymous" });
      const scale = cfg.logo.width / Math.max(logo.width || 1, logo.height || 1);
      const scaledW = (logo.width || 1) * scale;
      const scaledH = (logo.height || 1) * scale;
      const pos =
        cfg.logo.position === "top-right"
          ? { left: cfg.width - scaledW - cfg.logo.margin, top: cfg.logo.margin }
          : { left: (cfg.width - scaledW) / 2, top: cfg.height - scaledH - cfg.logo.margin };
      logo.set({ scaleX: scale, scaleY: scale, ...pos, originX: "left", originY: "top", selectable: false, evented: false });
      canvas.add(logo);
    } catch { /* proceed without logo */ }
  }

  // Optional gold kicker (post type).
  if (cfg.typeLabel && props.typeLabel) {
    addTextLayer(canvas, cfg, { ...cfg.typeLabel, fontWeight: cfg.typeLabel.fontWeight ?? 700 }, props.typeLabel);
  }

  addTextLayer(canvas, cfg, cfg.headline, props.headline);
  addTextLayer(canvas, cfg, cfg.subtitle, props.subtitle);

  canvas.renderAll();
}

export const EngagementPostCanvas = forwardRef<EngagementPostCanvasHandle, EngagementPostCanvasProps>(
  function EngagementPostCanvas(props, ref) {
    const cfg = getEngagementCanvasConfig(props.topic);
    const elRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<StaticCanvas | null>(null);

    useImperativeHandle(ref, () => ({
      getDataUrl: () => fabricRef.current?.toDataURL({ format: "png", multiplier: 1 }) ?? "",
      downloadAsPng: (filename = "engagement-post.png") => {
        const url = fabricRef.current?.toDataURL({ format: "png", multiplier: 1 });
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
      },
    }));

    const render = useCallback(
      (canvas: StaticCanvas) => renderEngagementCanvas(canvas, cfg, props),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [cfg, props.headline, props.subtitle, props.photoUrl, props.brand, props.typeLabel],
    );

    useEffect(() => {
      if (!elRef.current) return;
      const canvas = new StaticCanvas(elRef.current, {
        width: cfg.width,
        height: cfg.height,
        backgroundColor: "#111111",
      });
      // Fabric sets the element's inline CSS to logical px (1080x1350), which
      // overflows the small (overflow-hidden) card container and shows a zoomed
      // top-left slice. Force it back to fill so the preview scales down cleanly.
      if (elRef.current) {
        elRef.current.style.width = "100%";
        elRef.current.style.height = "100%";
      }
      render(canvas).then(() => {
        const prev = fabricRef.current;
        fabricRef.current = canvas;
        if (prev) prev.dispose();
      });
      return () => { canvas.dispose(); };
    }, [cfg, render]);

    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ aspectRatio: "1080 / 1350", width: "100%", height: "100%" }}
        onClick={props.onClick}
      >
        <canvas ref={elRef} width={cfg.width} height={cfg.height} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
    );
  },
);
