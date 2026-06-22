import { forwardRef, useCallback } from "react";
import { Rect, type StaticCanvas } from "fabric";
import { getBrandHex } from "../../constants/brands";
import { getParty, safePartyColor } from "../../constants/parties";
import { ELECTION_CANVAS as C } from "../../config/electionCanvasConfig";
import { ElectionCanvasBase } from "./ElectionCanvasBase";
import { drawFooter, drawHeader, formatStamp, text, type ElectionCanvasHandle } from "./canvasShared";
import { rankedCandidates, turnoutPct, winnerOf } from "./electionAggregate";
import type { SeatResult } from "./types";

interface Props {
  seat: SeatResult;
  brand: string;
  onClick?: () => void;
}

export const SeatResultCanvas = forwardRef<ElectionCanvasHandle, Props>(
  function SeatResultCanvas({ seat, brand, onClick }, ref) {
    const accent = getBrandHex(brand);

    const render = useCallback(
      async (canvas: StaticCanvas) => {
        const x = C.paddingX;
        const top = await drawHeader(canvas, brand, "Keputusan PRN", accent);

        // Seat identity
        canvas.add(text(`${seat.seat_id} · ${seat.seat_name}`, { left: x, top, size: 58, weight: 800 }));
        canvas.add(
          text(`Parlimen ${seat.parliament?.seat ?? ""} ${seat.parliament?.name ?? ""}`.trim(), {
            left: x,
            top: top + 72,
            size: 24,
            weight: 500,
            fill: C.textMuted,
            uppercase: true,
            spacing: 1,
          }),
        );

        const winner = winnerOf(seat);
        const ranked = rankedCandidates(seat);
        const maxVote = Math.max(1, ...ranked.map((c) => c.vote));

        // Status banner
        const bannerY = top + 128;
        canvas.add(
          new Rect({
            left: x,
            top: bannerY,
            width: C.width - x * 2,
            height: 64,
            rx: 12,
            ry: 12,
            fill: winner ? "rgba(255,210,74,0.14)" : "rgba(255,255,255,0.05)",
            selectable: false,
            evented: false,
          }),
        );
        canvas.add(
          text(winner ? "★  MENANG / DIISYTIHAR" : "BELUM KEPUTUSAN", {
            left: x + 24,
            top: bannerY + 32,
            size: 26,
            weight: 700,
            fill: winner ? C.win : C.textMuted,
            originY: "center",
            spacing: 2,
          }),
        );

        // Candidate rows
        let rowY = bannerY + 104;
        const rowH = 112;
        const rowW = C.width - x * 2;
        for (const cand of ranked) {
          const party = getParty(cand.party);
          const color = safePartyColor(party.color);
          const isWin = cand.status === "win";

          canvas.add(
            new Rect({
              left: x,
              top: rowY,
              width: rowW,
              height: rowH - 16,
              rx: 12,
              ry: 12,
              fill: isWin ? "rgba(255,255,255,0.06)" : C.surface,
              stroke: isWin ? C.win : C.stroke,
              strokeWidth: isWin ? 2 : 1,
              selectable: false,
              evented: false,
            }),
          );
          // Party colour swatch
          canvas.add(
            new Rect({
              left: x + 18,
              top: rowY + (rowH - 16) / 2,
              width: 12,
              height: rowH - 44,
              rx: 6,
              ry: 6,
              fill: color,
              originY: "center",
              selectable: false,
              evented: false,
            }),
          );
          // Name + party
          canvas.add(text(cand.name, { left: x + 46, top: rowY + 22, size: 30, weight: 700 }));
          canvas.add(
            text(party.abbreviation, {
              left: x + 46,
              top: rowY + 58,
              size: 22,
              weight: 600,
              fill: color,
              uppercase: true,
              spacing: 1,
            }),
          );
          // Votes (right)
          canvas.add(
            text(cand.vote.toLocaleString("en-MY"), {
              left: x + rowW - 24,
              top: rowY + 30,
              size: 34,
              weight: 800,
              fill: isWin ? C.win : C.text,
              originX: "right",
            }),
          );
          canvas.add(
            text("undi", {
              left: x + rowW - 24,
              top: rowY + 68,
              size: 18,
              weight: 500,
              fill: C.textFaint,
              originX: "right",
            }),
          );
          // Vote bar
          canvas.add(
            new Rect({
              left: x + 46,
              top: rowY + rowH - 30,
              width: Math.max(8, ((rowW - 70) * cand.vote) / maxVote),
              height: 6,
              rx: 3,
              ry: 3,
              fill: color,
              selectable: false,
              evented: false,
            }),
          );
          rowY += rowH;
          if (rowY > C.height - 220) break; // keep within the card
        }

        // Stats line
        const turnout = turnoutPct(seat);
        const statBits = [
          `Majoriti ${seat.majority.toLocaleString("en-MY")}`,
          turnout != null ? `Keluar mengundi ${turnout}%` : null,
          `Rasmi: ${seat.official_result ? "Ya" : "Belum"}`,
        ].filter(Boolean);
        canvas.add(
          text(statBits.join("   ·   "), {
            left: x,
            top: C.height - 132,
            size: 24,
            weight: 600,
            fill: C.textMuted,
          }),
        );

        drawFooter(canvas, formatStamp(seat.last_published_at));
      },
      [seat, brand, accent],
    );

    return (
      <ElectionCanvasBase
        ref={ref}
        render={render}
        deps={[seat, brand, accent]}
        defaultFilename={`prn-${seat.seat_id}-${seat.seat_name}`.toLowerCase()}
        onClick={onClick}
      />
    );
  },
);
