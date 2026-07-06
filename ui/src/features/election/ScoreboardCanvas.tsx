import { forwardRef, useCallback } from "react";
import { Rect, type StaticCanvas } from "fabric";
import { safePartyColor } from "../../constants/parties";
import {
  ELECTION_ACCENT,
  ELECTION_BG_TEMPLATES,
  ELECTION_CANVAS as C,
} from "../../config/electionCanvasConfig";
import { ElectionCanvasBase } from "./ElectionCanvasBase";
import { drawFooter, drawHeader, drawRule, formatStamp, text, type ElectionCanvasHandle } from "./canvasShared";
import { electionLabels, isHotspot } from "./electionLabels";
import { zhState } from "./hotspotNames";
import { partyZh } from "./partyZh";
import type { StateSummary } from "./electionAggregate";

interface Props {
  summary: StateSummary;
  brand: string;
  lastUpdated: number | null;
  onClick?: () => void;
}

export const ScoreboardCanvas = forwardRef<ElectionCanvasHandle, Props>(
  function ScoreboardCanvas({ summary, brand, lastUpdated, onClick }, ref) {
    const render = useCallback(
      async (canvas: StaticCanvas) => {
        const x = C.paddingX;
        const top = await drawHeader(canvas, brand);
        const L = electionLabels(brand);
        const zh = isHotspot(brand);
        // For a templated brand the baked footer eats the bottom band, so cap
        // the row-break + callout floor to the template's usable area.
        const tpl = ELECTION_BG_TEMPLATES[brand];
        const breakY = tpl ? tpl.contentBottom - 120 : C.height - 320;
        const calloutFloor = tpl ? tpl.contentBottom - 150 : C.height - 300;

        canvas.add(
          text(L.keputusanTerkini, {
            left: x,
            top,
            size: 24,
            weight: 700,
            fill: ELECTION_ACCENT,
            uppercase: true,
            spacing: 3,
          }),
        );
        const stateTitle = zh ? `${zhState(summary.state) ?? summary.state}州议席` : `DUN ${summary.state}`;
        canvas.add(text(stateTitle, { left: x, top: top + 40, size: 84, weight: 800, uppercase: true }));
        const declaredLine =
          summary.totalSeats != null
            ? `${summary.declared} / ${summary.totalSeats} ${L.diisytihar}`
            : `${summary.declared} ${L.diisytihar}`;
        canvas.add(
          text(declaredLine, { left: x, top: top + 148, size: 26, weight: 600, fill: C.textMuted }),
        );

        // Tally bars
        const bars = summary.tally.slice(0, 7);
        const maxSeats = Math.max(1, ...bars.map((b) => b.seats));
        const barAreaW = C.width - x * 2;
        const labelW = 150;
        const barMaxW = barAreaW - labelW - 120;
        let rowY = top + 220;
        const rowH = 96;
        for (const t of bars) {
          const color = safePartyColor(t.party.color);
          const barLabel = zh ? partyZh(t.partyId) ?? t.party.abbreviation : t.party.abbreviation;
          canvas.add(
            text(barLabel, {
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
          if (rowY > breakY) break;
        }

        // Seats-to-govern + leader callout
        let calloutY = Math.max(rowY + 20, calloutFloor);
        if (summary.toGovern != null) {
          drawRule(canvas, calloutY, C.stroke, 1);
          const toGovernLine = zh
            ? `${L.toGovern} ${summary.toGovern} 席`
            : `${summary.toGovern} ${L.toGovern}`;
          canvas.add(
            text(toGovernLine, {
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
          const leaderLabel = zh
            ? partyZh(summary.leader.partyId) ?? summary.leader.party.abbreviation
            : summary.leader.party.abbreviation;
          canvas.add(
            text(`${leaderLabel} ${L.mendahului}`, {
              left: x,
              top: calloutY + 10,
              size: 44,
              weight: 800,
              fill: ELECTION_ACCENT,
              uppercase: true,
              spacing: 1,
            }),
          );
        }

        drawFooter(
          canvas,
          lastUpdated ? `LIVE · ${formatStamp(new Date(lastUpdated).toISOString())}` : "LIVE",
          "",
          brand,
        );
      },
      [summary, brand, lastUpdated],
    );

    return (
      <ElectionCanvasBase
        ref={ref}
        render={render}
        deps={[summary, brand, lastUpdated]}
        defaultFilename={`prn-scoreboard-${summary.state}`.toLowerCase()}
        onClick={onClick}
      />
    );
  },
);
