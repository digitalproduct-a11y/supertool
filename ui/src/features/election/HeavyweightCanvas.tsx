import { forwardRef, useCallback } from "react";
import { Rect, type StaticCanvas } from "fabric";
import { getBrandHex } from "../../constants/brands";
import { getParty, safePartyColor } from "../../constants/parties";
import { ELECTION_CANVAS as C } from "../../config/electionCanvasConfig";
import { ElectionCanvasBase } from "./ElectionCanvasBase";
import { drawFooter, drawHeader, formatStamp, text, type ElectionCanvasHandle } from "./canvasShared";
import { rankedCandidates, winnerOf } from "./electionAggregate";
import type { Candidate, SeatResult } from "./types";

interface Props {
  seat: SeatResult;
  brand: string;
  onClick?: () => void;
}

export const HeavyweightCanvas = forwardRef<ElectionCanvasHandle, Props>(
  function HeavyweightCanvas({ seat, brand, onClick }, ref) {
    const accent = getBrandHex(brand);

    const render = useCallback(
      async (canvas: StaticCanvas) => {
        const x = C.paddingX;
        const top = await drawHeader(canvas, brand, "Kerusi Utama", accent);
        const cx = C.width / 2;
        const winner = winnerOf(seat);
        const [a, b] = rankedCandidates(seat);

        canvas.add(
          text(`${seat.seat_id} · ${seat.seat_name}`, {
            left: cx,
            top,
            size: 52,
            weight: 800,
            align: "center",
            originX: "center",
          }),
        );
        canvas.add(
          text(seat.state, {
            left: cx,
            top: top + 66,
            size: 26,
            weight: 500,
            fill: C.textMuted,
            align: "center",
            originX: "center",
            uppercase: true,
            spacing: 2,
          }),
        );

        const drawContender = (cand: Candidate | undefined, top0: number) => {
          if (!cand) return;
          const party = getParty(cand.party);
          const color = safePartyColor(party.color);
          const isWin = cand.status === "win";
          canvas.add(
            new Rect({
              left: x,
              top: top0,
              width: C.width - x * 2,
              height: 188,
              rx: 16,
              ry: 16,
              fill: isWin ? "rgba(255,210,74,0.12)" : C.surface,
              stroke: isWin ? C.win : C.stroke,
              strokeWidth: isWin ? 2 : 1,
              selectable: false,
              evented: false,
            }),
          );
          canvas.add(
            new Rect({
              left: x,
              top: top0,
              width: 14,
              height: 188,
              rx: 7,
              ry: 7,
              fill: color,
              selectable: false,
              evented: false,
            }),
          );
          canvas.add(text(cand.name, { left: x + 44, top: top0 + 36, size: 40, weight: 800 }));
          canvas.add(
            text(party.name, {
              left: x + 44,
              top: top0 + 92,
              size: 24,
              weight: 600,
              fill: color,
              uppercase: true,
              spacing: 1,
            }),
          );
          canvas.add(
            text(cand.vote.toLocaleString("en-MY"), {
              left: C.width - x - 28,
              top: top0 + 60,
              size: 48,
              weight: 800,
              fill: isWin ? C.win : C.text,
              originX: "right",
            }),
          );
          if (isWin) {
            canvas.add(
              text("★ MENANG", {
                left: C.width - x - 28,
                top: top0 + 120,
                size: 22,
                weight: 700,
                fill: C.win,
                originX: "right",
                spacing: 2,
              }),
            );
          }
        };

        const blockTop = top + 150;
        drawContender(a, blockTop);
        canvas.add(
          text("lawan", {
            left: cx,
            top: blockTop + 210,
            size: 26,
            weight: 600,
            fill: C.textFaint,
            align: "center",
            originX: "center",
            uppercase: true,
            spacing: 3,
          }),
        );
        drawContender(b, blockTop + 250);

        if (winner) {
          canvas.add(
            text(`Majoriti ${seat.majority.toLocaleString("en-MY")} undi`, {
              left: cx,
              top: blockTop + 480,
              size: 28,
              weight: 700,
              fill: C.textMuted,
              align: "center",
              originX: "center",
            }),
          );
        }

        drawFooter(canvas, formatStamp(seat.last_published_at));
      },
      [seat, brand, accent],
    );

    return (
      <ElectionCanvasBase
        ref={ref}
        render={render}
        deps={[seat, brand, accent]}
        defaultFilename={`prn-utama-${seat.seat_id}-${seat.seat_name}`.toLowerCase()}
        onClick={onClick}
      />
    );
  },
);
