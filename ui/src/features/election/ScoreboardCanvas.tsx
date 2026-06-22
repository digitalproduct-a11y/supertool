import { forwardRef, useCallback } from "react";
import { Rect, type StaticCanvas } from "fabric";
import { getBrandHex } from "../../constants/brands";
import { safePartyColor } from "../../constants/parties";
import { ELECTION_CANVAS as C } from "../../config/electionCanvasConfig";
import { ElectionCanvasBase } from "./ElectionCanvasBase";
import { drawFooter, drawHeader, formatStamp, text, type ElectionCanvasHandle } from "./canvasShared";
import type { StateSummary } from "./electionAggregate";

interface Props {
  summary: StateSummary;
  brand: string;
  lastUpdated: number | null;
  onClick?: () => void;
}

export const ScoreboardCanvas = forwardRef<ElectionCanvasHandle, Props>(
  function ScoreboardCanvas({ summary, brand, lastUpdated, onClick }, ref) {
    const accent = getBrandHex(brand);

    const render = useCallback(
      async (canvas: StaticCanvas) => {
        const x = C.paddingX;
        const top = await drawHeader(canvas, brand, "Keputusan Terkini", accent);

        canvas.add(text(`DUN ${summary.state}`, { left: x, top, size: 64, weight: 800, uppercase: true }));
        const declaredLine =
          summary.totalSeats != null
            ? `${summary.declared} / ${summary.totalSeats} kerusi diisytihar`
            : `${summary.declared} kerusi diisytihar`;
        canvas.add(
          text(declaredLine, { left: x, top: top + 80, size: 26, weight: 600, fill: C.textMuted }),
        );

        // Tally bars
        const bars = summary.tally.slice(0, 7);
        const maxSeats = Math.max(1, ...bars.map((b) => b.seats));
        const barAreaW = C.width - x * 2;
        const labelW = 150;
        const barMaxW = barAreaW - labelW - 120;
        let rowY = top + 150;
        const rowH = 96;
        for (const t of bars) {
          const color = safePartyColor(t.party.color);
          canvas.add(
            text(t.party.abbreviation, {
              left: x,
              top: rowY + 20,
              size: 30,
              weight: 800,
              fill: color,
              uppercase: true,
            }),
          );
          // track
          canvas.add(
            new Rect({
              left: x + labelW,
              top: rowY + 16,
              width: barMaxW,
              height: 40,
              rx: 8,
              ry: 8,
              fill: C.surface,
              selectable: false,
              evented: false,
            }),
          );
          // fill
          canvas.add(
            new Rect({
              left: x + labelW,
              top: rowY + 16,
              width: Math.max(12, (barMaxW * t.seats) / maxSeats),
              height: 40,
              rx: 8,
              ry: 8,
              fill: color,
              selectable: false,
              evented: false,
            }),
          );
          canvas.add(
            text(String(t.seats), {
              left: x + barAreaW,
              top: rowY + 18,
              size: 38,
              weight: 800,
              originX: "right",
            }),
          );
          rowY += rowH;
          if (rowY > C.height - 320) break;
        }

        // Seats-to-govern + leader callout
        let calloutY = Math.max(rowY + 20, C.height - 300);
        if (summary.toGovern != null) {
          canvas.add(
            new Rect({
              left: x,
              top: calloutY,
              width: C.width - x * 2,
              height: 2,
              fill: C.stroke,
              selectable: false,
              evented: false,
            }),
          );
          canvas.add(
            text(`${summary.toGovern} kerusi diperlukan untuk membentuk kerajaan`, {
              left: x,
              top: calloutY + 22,
              size: 24,
              weight: 600,
              fill: C.textMuted,
            }),
          );
          calloutY += 70;
        }
        if (summary.leader) {
          canvas.add(
            text(`${summary.leader.party.abbreviation} MENDAHULUI`, {
              left: x,
              top: calloutY + 10,
              size: 44,
              weight: 800,
              fill: C.win,
              uppercase: true,
              spacing: 1,
            }),
          );
        }

        drawFooter(canvas, lastUpdated ? `LIVE · ${formatStamp(new Date(lastUpdated).toISOString())}` : "LIVE");
      },
      [summary, brand, accent, lastUpdated],
    );

    return (
      <ElectionCanvasBase
        ref={ref}
        render={render}
        deps={[summary, brand, accent, lastUpdated]}
        defaultFilename={`prn-scoreboard-${summary.state}`.toLowerCase()}
        onClick={onClick}
      />
    );
  },
);
