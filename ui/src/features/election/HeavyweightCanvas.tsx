import { forwardRef, useCallback } from "react";
import { Circle, type StaticCanvas } from "fabric";
import { getParty, safePartyColor } from "../../constants/parties";
import { ELECTION_ACCENT, ELECTION_CANVAS as C } from "../../config/electionCanvasConfig";
import { ElectionCanvasBase } from "./ElectionCanvasBase";
import { drawFooter, drawHeader, drawProgressBar, formatStamp, text, type ElectionCanvasHandle } from "./canvasShared";
import { rankedCandidates, winnerOf } from "./electionAggregate";
import type { Candidate, SeatResult } from "./types";

interface Props {
  seat: SeatResult;
  brand: string;
  onClick?: () => void;
}

export const HeavyweightCanvas = forwardRef<ElectionCanvasHandle, Props>(
  function HeavyweightCanvas({ seat, brand, onClick }, ref) {
    const render = useCallback(
      async (canvas: StaticCanvas) => {
        const x = C.paddingX;
        const rowW = C.width - x * 2;
        const top = await drawHeader(canvas, brand);
        const winner = winnerOf(seat);
        const ranked = rankedCandidates(seat);
        const [a, b] = ranked;
        const totalVotes = Math.max(1, ranked.reduce((sum, c) => sum + c.vote, 0));
        const maxVote = Math.max(0, ...ranked.map((c) => c.vote));

        canvas.add(
          text("Kerusi Utama", {
            left: x,
            top,
            size: 24,
            weight: 700,
            fill: ELECTION_ACCENT,
            uppercase: true,
            spacing: 3,
          }),
        );
        canvas.add(text(seat.seat_name, { left: x, top: top + 40, size: 84, weight: 800 }));
        canvas.add(
          text(`${seat.seat_id} · ${seat.state}`, {
            left: x,
            top: top + 148,
            size: 24,
            weight: 500,
            fill: C.textMuted,
            uppercase: true,
            spacing: 2,
          }),
        );

        // Borderless contender block: dot + name + party, votes + %, underline bar.
        const drawContender = (cand: Candidate | undefined, top0: number): number => {
          if (!cand) return top0;
          const party = getParty(cand.party);
          const color = safePartyColor(party.color);
          const isWin = winner != null && cand.id === winner.id;
          const pct = ((cand.vote / totalVotes) * 100).toFixed(1);

          canvas.add(
            new Circle({
              left: x + 12,
              top: top0 + 28,
              radius: 12,
              fill: color,
              originX: "center",
              originY: "center",
              selectable: false,
              evented: false,
            }),
          );
          canvas.add(text(cand.name, { left: x + 44, top: top0, size: 46, weight: 800 }));
          canvas.add(
            text(`${party.abbreviation} · ${party.name}`, {
              left: x + 44,
              top: top0 + 60,
              size: 24,
              weight: 700,
              fill: color,
              uppercase: true,
              spacing: 1,
            }),
          );
          canvas.add(
            text(cand.vote.toLocaleString("en-MY"), {
              left: x + rowW,
              top: top0 - 2,
              size: 60,
              weight: 800,
              originX: "right",
            }),
          );
          canvas.add(
            text(`${pct}% undi${isWin ? "  ·  ★ Menang" : ""}`, {
              left: x + rowW,
              top: top0 + 68,
              size: 24,
              weight: 600,
              fill: isWin ? ELECTION_ACCENT : C.textMuted,
              originX: "right",
            }),
          );
          drawProgressBar(canvas, x, top0 + 112, rowW, 8, maxVote > 0 ? cand.vote / maxVote : 0, color);
          return top0 + 116;
        };

        const blockTop = top + 230;
        drawContender(a, blockTop);
        canvas.add(
          text("lawan", {
            left: C.width / 2,
            top: blockTop + 170,
            size: 26,
            weight: 600,
            fill: C.textFaint,
            align: "center",
            originX: "center",
            uppercase: true,
            spacing: 3,
          }),
        );
        drawContender(b, blockTop + 230);

        if (winner) {
          canvas.add(
            text(`Majoriti ${seat.majority.toLocaleString("en-MY")} undi`, {
              left: x,
              top: blockTop + 400,
              size: 28,
              weight: 700,
              fill: C.textMuted,
            }),
          );
        }

        drawFooter(canvas, formatStamp(seat.last_published_at), "", brand);
      },
      [seat, brand],
    );

    return (
      <ElectionCanvasBase
        ref={ref}
        render={render}
        deps={[seat, brand]}
        defaultFilename={`prn-utama-${seat.seat_id}-${seat.seat_name}`.toLowerCase()}
        onClick={onClick}
      />
    );
  },
);
