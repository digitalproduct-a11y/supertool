import { forwardRef, useCallback } from "react";
import { Circle, Rect, type StaticCanvas } from "fabric";
import { getParty, safePartyColor } from "../../constants/parties";
import {
  ELECTION_ACCENT,
  ELECTION_BG_TEMPLATES,
  ELECTION_CANVAS as C,
  ELECTION_FOOTER,
} from "../../config/electionCanvasConfig";
import { ElectionCanvasBase } from "./ElectionCanvasBase";
import { drawHeader, drawProgressBar, formatTime, text, type ElectionCanvasHandle } from "./canvasShared";
import { rankedCandidates, winnerOf } from "./electionAggregate";
import { electionLabels, isHotspot } from "./electionLabels";
import { zhCandidate, zhSeatName } from "./hotspotNames";
import { partyZh } from "./partyZh";
import type { SeatResult } from "./types";

interface Props {
  seat: SeatResult;
  brand: string;
  onClick?: () => void;
}

export const SeatResultCanvas = forwardRef<ElectionCanvasHandle, Props>(
  function SeatResultCanvas({ seat, brand, onClick }, ref) {
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
        const totalVotes = Math.max(1, ranked.reduce((sum, c) => sum + c.vote, 0));
        const maxVote = Math.max(0, ...ranked.map((c) => c.vote));

        // Seat identity — gold eyebrow, ink headline (id - name), muted subline.
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

        // Headline "{seat_id} - {seat_name}" — shrink from 96 to fit one line.
        const seatName = zh ? zhSeatName(seat.seat_id) ?? seat.seat_name : seat.seat_name;
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

        // Status highlight bar — gold pill + white text when official, light-grey
        // pill + muted text when not. The winner is marked by a gold ★ below.
        const statusY = top + 216;
        const pillH = 44;
        const pillCenterY = statusY + pillH / 2;
        const statusLabel = text(official ? L.official : L.unofficial, {
          left: x + 16,
          top: pillCenterY,
          size: 24,
          weight: 700,
          fill: official ? "#ffffff" : C.textMuted,
          originY: "center",
          uppercase: true,
          spacing: 2,
        });
        canvas.add(
          new Rect({
            left: x,
            top: statusY,
            width: statusLabel.width + 32,
            height: pillH,
            rx: 10,
            ry: 10,
            fill: official ? ELECTION_ACCENT : C.surface,
            selectable: false,
            evented: false,
          }),
        );
        canvas.add(statusLabel);

        // Majoriti — one-liner on the right of the status row, number in the
        // winner's party colour (official only).
        if (official && winner) {
          const winColor = safePartyColor(getParty(winner.party).color);
          const majNum = text(seat.majority.toLocaleString("en-MY"), {
            left: x + rowW,
            top: pillCenterY,
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
              top: pillCenterY,
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

        // Candidate rows — borderless, party-colour dot + underline bar. Row
        // height is derived from candidate count so every row fits between the
        // header and the footer; internal metrics scale by k (k=1 → the full
        // size used for ≤3 candidates, identical to the original layout).
        const rowsTop = statusY + 84;
        const tpl = ELECTION_BG_TEMPLATES[brand];

        // Footer stats block — computed up front so the rows fit above it.
        // official → 3 lines (Berdaftar / Jumlah Undi / Peratus); else → 2 lines.
        const jumlahUndi = ranked.reduce((sum, c) => sum + c.vote, 0);
        const reg = seat.registered_voters;
        const peratus = reg > 0 ? ((jumlahUndi / reg) * 100).toFixed(2) : null;
        const statLines = official
          ? [
              `${L.pengundiBerdaftar}: ${reg.toLocaleString("en-MY")}`,
              `${L.jumlahUndi}: ${jumlahUndi.toLocaleString("en-MY")}`,
              peratus != null ? `${L.peratusKeluar}: ${peratus}%` : null,
            ].filter((v): v is string => v != null)
          : [
              `${L.pengundiBerdaftar}: ${reg.toLocaleString("en-MY")}`,
              `${L.jumlahUndi}: ${jumlahUndi.toLocaleString("en-MY")}`,
            ];
        const footerBaseY = tpl ? tpl.footerY : C.height - ELECTION_FOOTER.bottomOffset;
        const statLH = 32;
        const statRuleY = footerBaseY - (statLines.length - 1) * statLH - 38;
        const rowsBottom = statRuleY - 16;

        const n = Math.max(1, ranked.length);
        const rowH = Math.min(128, Math.floor((rowsBottom - rowsTop) / n));
        const k = rowH / 128;
        const s = (v: number) => Math.round(v * k);
        let rowY = rowsTop;
        for (const cand of ranked) {
          const party = getParty(cand.party);
          const color = safePartyColor(party.color);
          const pct = ((cand.vote / totalVotes) * 100).toFixed(1);

          // Party dot
          canvas.add(
            new Circle({
              left: x + 10,
              top: rowY + s(24),
              radius: Math.max(6, s(10)),
              fill: color,
              originX: "center",
              originY: "center",
              selectable: false,
              evented: false,
            }),
          );
          // Name + party — winner (official only) gets a gold ★ after the name.
          const isWinner = winner != null && cand.id === winner.id;
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
          const nameText = text(displayName, { left: x + 36, top: rowY, size: s(40), weight: 800 });
          canvas.add(nameText);
          if (isWinner) {
            canvas.add(
              text("★", {
                left: x + 36 + nameText.width + 12,
                top: rowY,
                size: s(40),
                weight: 800,
                fill: ELECTION_ACCENT,
              }),
            );
          }
          canvas.add(
            text(partyLine, {
              left: x + 36,
              top: rowY + s(52),
              size: s(22),
              weight: 700,
              fill: color,
              uppercase: true,
              spacing: 1,
            }),
          );
          // Votes + % (right)
          canvas.add(
            text(cand.vote.toLocaleString("en-MY"), {
              left: x + rowW,
              top: rowY - s(2),
              size: s(52),
              weight: 800,
              originX: "right",
            }),
          );
          canvas.add(
            text(`${pct}% ${L.undiSuffix}`, {
              left: x + rowW,
              top: rowY + s(58),
              size: s(22),
              weight: 500,
              fill: C.textMuted,
              originX: "right",
            }),
          );
          // Party-colour progress bar (fill relative to the leading candidate).
          drawProgressBar(canvas, x, rowY + rowH - s(36), rowW, Math.max(4, s(6)), maxVote > 0 ? cand.vote / maxVote : 0, color);
          rowY += rowH;
          if (rowY > rowsBottom) break; // safety — rowH already sized to fit
        }

        // Footer — stacked stat lines (left) + timestamp (right).
        statLines.forEach((line, i) => {
          canvas.add(
            text(line, {
              left: x,
              top: footerBaseY - (statLines.length - 1 - i) * statLH,
              size: 22,
              weight: 500,
              fill: C.textMuted,
              originY: "bottom",
            }),
          );
        });
        // Timestamp — only for unofficial results ("Keputusan setakat 5:50PM").
        // Official results are final, so no "as of" time is shown.
        if (!official) {
          const t = formatTime(seat.last_published_at);
          if (t) {
            canvas.add(
              text(zh ? `成绩截至 ${t}` : `Keputusan setakat ${t}`, {
                left: x + rowW,
                top: footerBaseY,
                size: 20,
                weight: 500,
                fill: C.textFaint,
                originX: "right",
                originY: "bottom",
              }),
            );
          }
        }
      },
      [seat, brand],
    );

    return (
      <ElectionCanvasBase
        ref={ref}
        render={render}
        deps={[seat, brand]}
        defaultFilename={`prn-${seat.seat_id}-${seat.seat_name}`.toLowerCase()}
        onClick={onClick}
      />
    );
  },
);
