import { useEffect, useRef, useState, useCallback } from "react";

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropAdjusterProps {
  imageUrl: string;
  aspectRatio: number;
  initialRegion?: CropRegion | null;
  onSave: (region: CropRegion) => void;
  onReset: () => void;
  onCancel: () => void;
}

type DragMode =
  | { kind: "move"; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; corner: "nw" | "ne" | "sw" | "se"; startX: number; startY: number; orig: CropRegion }
  | null;

const HANDLE_PX = 12;
const MIN_REGION_PX = 40;

export function ImageCropAdjuster({
  imageUrl,
  aspectRatio,
  initialRegion,
  onSave,
  onReset,
  onCancel,
}: ImageCropAdjusterProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [region, setRegion] = useState<CropRegion | null>(null);
  const dragRef = useRef<DragMode>(null);

  // Default region: largest aspect-locked rect centered in the image.
  const defaultRegion = useCallback(
    (w: number, h: number): CropRegion => {
      let rw = w;
      let rh = w / aspectRatio;
      if (rh > h) {
        rh = h;
        rw = h * aspectRatio;
      }
      return {
        x: Math.round((w - rw) / 2),
        y: Math.round((h - rh) / 2),
        width: Math.round(rw),
        height: Math.round(rh),
      };
    },
    [aspectRatio],
  );

  const onImgLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    setNaturalSize({ w, h });
    setRegion(initialRegion ?? defaultRegion(w, h));
  };

  // Compute display scale (source px → CSS px) whenever the image renders.
  useEffect(() => {
    const update = () => {
      const el = imgRef.current;
      if (!el || !naturalSize) return;
      setDisplayScale(el.clientWidth / naturalSize.w);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [naturalSize]);

  const clampRegion = (r: CropRegion): CropRegion => {
    if (!naturalSize) return r;
    const w = Math.max(MIN_REGION_PX, Math.min(r.width, naturalSize.w));
    const h = Math.max(MIN_REGION_PX, Math.min(r.height, naturalSize.h));
    const x = Math.max(0, Math.min(r.x, naturalSize.w - w));
    const y = Math.max(0, Math.min(r.y, naturalSize.h - h));
    return { x, y, width: w, height: h };
  };

  const onPointerDownMove = (e: React.PointerEvent) => {
    if (!region) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "move",
      startX: e.clientX,
      startY: e.clientY,
      origX: region.x,
      origY: region.y,
    };
  };

  const onPointerDownResize = (
    corner: "nw" | "ne" | "sw" | "se",
  ) => (e: React.PointerEvent) => {
    if (!region) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "resize",
      corner,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...region },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !region || !naturalSize) return;
    const dx = (e.clientX - d.startX) / displayScale;
    const dy = (e.clientY - d.startY) / displayScale;
    if (d.kind === "move") {
      setRegion(clampRegion({ ...region, x: d.origX + dx, y: d.origY + dy }));
      return;
    }
    // Resize: anchor opposite corner, expand to pointer, then snap to aspectRatio.
    const orig = d.orig;
    const ax = d.corner === "nw" || d.corner === "sw" ? orig.x + orig.width : orig.x; // anchor x
    const ay = d.corner === "nw" || d.corner === "ne" ? orig.y + orig.height : orig.y; // anchor y
    const px = orig.x + (d.corner === "ne" || d.corner === "se" ? orig.width : 0) + dx;
    const py = orig.y + (d.corner === "sw" || d.corner === "se" ? orig.height : 0) + dy;
    let w = Math.abs(px - ax);
    let h = Math.abs(py - ay);
    // Snap to aspect ratio — use the larger dimension as the lead
    if (w / aspectRatio > h) h = w / aspectRatio;
    else w = h * aspectRatio;
    const x = px < ax ? ax - w : ax;
    const y = py < ay ? ay - h : ay;
    setRegion(clampRegion({ x, y, width: w, height: h }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleSave = () => {
    if (!region) return;
    const r = clampRegion(region);
    onSave({
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-5 max-w-4xl w-full max-h-[90vh] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">
            Adjust crop
          </h2>
          <p className="text-xs text-neutral-500">
            Drag the box to reframe, drag the corners to resize.
          </p>
        </div>

        <div
          ref={containerRef}
          className="bg-neutral-100 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ minHeight: 300 }}
        >
          {/* Inner wrapper sized to the displayed image so the overlay aligns with it */}
          <div className="relative" style={{ display: 'inline-block' }}>
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Source for cropping"
              crossOrigin="anonymous"
              onLoad={onImgLoad}
              className="block max-w-full max-h-[70vh] select-none"
              draggable={false}
            />
            {region && naturalSize && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Dimming mask outside the crop region */}
                <div
                  className="absolute inset-0"
                  style={{
                    boxShadow: `0 0 0 9999px rgba(0,0,0,0.45)`,
                    clipPath: `polygon(
                      0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                      ${(region.x / naturalSize.w) * 100}% ${(region.y / naturalSize.h) * 100}%,
                      ${(region.x / naturalSize.w) * 100}% ${((region.y + region.height) / naturalSize.h) * 100}%,
                      ${((region.x + region.width) / naturalSize.w) * 100}% ${((region.y + region.height) / naturalSize.h) * 100}%,
                      ${((region.x + region.width) / naturalSize.w) * 100}% ${(region.y / naturalSize.h) * 100}%,
                      ${(region.x / naturalSize.w) * 100}% ${(region.y / naturalSize.h) * 100}%
                    )`,
                  }}
                />
                {/* Crop rect — interactive */}
                <div
                  className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move pointer-events-auto"
                  style={{
                    left: region.x * displayScale,
                    top: region.y * displayScale,
                    width: region.width * displayScale,
                    height: region.height * displayScale,
                  }}
                  onPointerDown={onPointerDownMove}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                    <div
                      key={corner}
                      className="absolute bg-white border border-neutral-800 rounded-sm pointer-events-auto"
                      style={{
                        width: HANDLE_PX,
                        height: HANDLE_PX,
                        left: corner.endsWith("w") ? -HANDLE_PX / 2 : "auto",
                        right: corner.endsWith("e") ? -HANDLE_PX / 2 : "auto",
                        top: corner.startsWith("n") ? -HANDLE_PX / 2 : "auto",
                        bottom: corner.startsWith("s") ? -HANDLE_PX / 2 : "auto",
                        cursor: `${corner}-resize`,
                      }}
                      onPointerDown={onPointerDownResize(corner)}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-neutral-500 hover:text-neutral-800 transition"
          >
            Reset to auto
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!region}
              className="px-4 py-2 rounded-xl text-sm bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-40 transition"
            >
              Save crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
