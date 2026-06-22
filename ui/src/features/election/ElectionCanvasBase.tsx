import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StaticCanvas } from "fabric";
import { ELECTION_CANVAS } from "../../config/electionCanvasConfig";
import { preloadInter, type ElectionCanvasHandle } from "./canvasShared";

interface ElectionCanvasBaseProps {
  /** Draws the card onto the canvas. Called after Inter is preloaded. */
  render: (canvas: StaticCanvas) => Promise<void>;
  /** Re-render whenever any of these change. */
  deps: unknown[];
  defaultFilename: string;
  maxWidth?: number;
  onClick?: () => void;
}

// Owns the Fabric StaticCanvas lifecycle and the downloadAsPng/getDataUrl
// handle, mirroring the weather/onthisday canvas pattern. Each card supplies a
// pure render function.
export const ElectionCanvasBase = forwardRef<ElectionCanvasHandle, ElectionCanvasBaseProps>(
  function ElectionCanvasBase({ render, deps, defaultFilename, maxWidth = 500, onClick }, ref) {
    const elRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<StaticCanvas | null>(null);
    const [ready, setReady] = useState(false);

    const draw = useCallback(
      async (canvas: StaticCanvas) => {
        canvas.clear();
        canvas.backgroundColor = ELECTION_CANVAS.bg;
        await preloadInter();
        await render(canvas);
        canvas.requestRenderAll();
        canvas.renderAll();
        setReady(true);
      },
      // render identity is controlled by the card via its own deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
      deps,
    );

    useEffect(() => {
      if (!elRef.current) return;
      elRef.current.width = ELECTION_CANVAS.width;
      elRef.current.height = ELECTION_CANVAS.height;
      const canvas = new StaticCanvas(elRef.current, {
        width: ELECTION_CANVAS.width,
        height: ELECTION_CANVAS.height,
        backgroundColor: ELECTION_CANVAS.bg,
      });
      fabricRef.current = canvas;

      let cancelled = false;
      draw(canvas).then(() => {
        if (cancelled) return;
        const el = elRef.current;
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draw]);

    useImperativeHandle(ref, () => ({
      downloadAsPng(filename?: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${filename ?? defaultFilename}.png`;
        link.click();
      },
      getDataUrl() {
        const canvas = fabricRef.current;
        if (!canvas) return null;
        return canvas.toDataURL({ format: "png", multiplier: 2 });
      },
    }));

    return (
      <div
        className={`w-full overflow-hidden rounded-xl border border-neutral-200${onClick ? " cursor-pointer hover:opacity-90 transition" : ""}`}
        style={{ maxWidth, aspectRatio: `${ELECTION_CANVAS.width} / ${ELECTION_CANVAS.height}` }}
        onClick={onClick}
      >
        <canvas
          ref={elRef}
          width={ELECTION_CANVAS.width}
          height={ELECTION_CANVAS.height}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
        {!ready && (
          <div className="flex items-center justify-center h-64 text-sm text-neutral-400">
            Rendering preview…
          </div>
        )}
      </div>
    );
  },
);
