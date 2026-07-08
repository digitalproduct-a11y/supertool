import { forwardRef, useCallback } from "react";
import { Circle, type StaticCanvas } from "fabric";
import { getParty, safePartyColor } from "../../constants/parties";
import { ELECTION_ACCENT, ELECTION_CANVAS as C, ELECTION_FOOTER } from "../../config/electionCanvasConfig";
import { ElectionCanvasBase } from "./ElectionCanvasBase";
import { drawFooter, drawHeader, drawProgressBar, liveStampText, text, type ElectionCanvasHandle } from "./canvasShared";
import { rankedCandidates, winnerOf } from "./electionAggregate";
import { electionLabels, isHotspot } from "./electionLabels";
import { zhCandidate, zhSeatName } from "./hotspotNames";
import { partyZh } from "./partyZh";
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
        const L = electionLabels(brand);
        const zh = isHotspot(brand);
        const official = seat.official_result;
        const winner = winnerOf(seat);
        const ranked = rankedCandidates(seat);
        const [a, b] = ranked;
        const totalVotes = Math.max(1, ranked.reduce((sum, c) => sum + c.vote, 0));
        const maxVote = Math.max(0, ...ranked.map((c) => c.vote));

        // Utama posts (rasmi + tidak rasmi) reuse the single-seat card's heading:
        // "州议席" eyebrow, "{id} - {name}" headline (shrink to fit), parliament subline.
        const seatName = zh ? zhSeatName(seat.seat_id) ?? seat.seat_name : seat.seat_name;
        canvas.add(
          text(L.duNegeri, {
            left: x,
            top,
            size: 24,
            weight: 700,
            fill: ELECTION_ACCENT,
            uppercase: true,
            spacing: 3,
          }),
        );
        const title = `${seat.seat_id} - ${seatName}`;
        let headline = text(title, { left: x, top: top + 40, size: 96, weight: 800 });
        if (headline.width > rowW) {
          const size = Math.max(48, Math.floor((96 * rowW) / headline.width));
          headline = text(title, { left: x, top: top + 40, size, weight: 800 });
        }
        canvas.add(headline);
        canvas.add(
          text(`${L.parlimen} ${seat.parliament?.seat ?? ""} ${seat.parliament?.name ?? ""}`.trim(), {
            left: x,
            top: top + 156,
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
          const zc = zh ? zhCandidate(seat.seat_id, cand.name) : null;
          const displayName = zc?.zh ?? cand.name;
          let partyLine: string;
          if (zh) {
            partyLine = zc
              ? zc.coalitionZh === zc.partyZh
                ? zc.coalitionZh
                : `${zc.coalitionZh} · ${zc.partyZh}`
              : partyZh(cand.party) ?? party.name;
          } else {
            partyLine = `${party.abbreviation} · ${party.name}`;
          }

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
          canvas.add(text(displayName, { left: x + 44, top: top0, size: 46, weight: 800 }));
          canvas.add(
            text(partyLine, {
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
            text(`${pct}% ${L.undiSuffix}${isWin ? `  ·  ★ ${L.menang}` : ""}`, {
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
          text(L.lawan, {
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

        // Majoriti — muted uppercase label + number in the winner's party colour,
        // right-aligned in place (standardized to match the single-seat card).
        if (winner) {
          const winColor = safePartyColor(getParty(winner.party).color);
          const majNum = text(seat.majority.toLocaleString("en-MY"), {
            left: x + rowW,
            top: blockTop + 400,
            size: 32,
            weight: 800,
            fill: winColor,
            originX: "right",
            originY: "center",
          });
          canvas.add(majNum);
          canvas.add(
            text(L.majoriti, {
              left: x + rowW - majNum.width - 12,
              top: blockTop + 400,
              size: 24,
              weight: 600,
              fill: C.textMuted,
              originX: "right",
              originY: "center",
              uppercase: true,
              spacing: 2,
            }),
          );
        }

        // Official (rasmi) results are final, so drop the LIVE stamp; unofficial
        // (tidak rasmi) keeps it — smaller (38px) on the Hotspot card, footer-aligned.
        const stamp = official ? "" : liveStampText(seat.last_published_at, zh);
        drawFooter(canvas, stamp, "", brand, undefined, zh ? ELECTION_FOOTER.hotspotStampY : undefined);
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
