"use client";

// Hero stats for Invoices: open book $, needs-you count, in-flight / recovered.

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { formatAmount } from "@/lib/format";
import { useCountUp } from "./useCountUp";

const Pulse = styled.section`
  display: grid;
  grid-template-columns: 1.35fr 1fr 1fr;
  gap: 1px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.border};
  @media (max-width: 720px) {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const Cell = styled.div<{ $hot?: boolean; $span?: boolean }>`
  padding: 18px 20px;
  background: ${({ theme, $hot }) =>
    $hot ? theme.status.awaiting_approval.bg : theme.surface};
  ${({ $span }) =>
    $span
      ? `
    @media (max-width: 720px) and (min-width: 481px) {
      grid-column: 1 / -1;
    }
  `
      : ""}
  .k {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.textMuted};
  }
  .v {
    margin-top: 8px;
    font-family: var(--font-display, inherit);
    font-size: clamp(26px, 3vw, 34px);
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 1;
    color: ${({ theme, $hot }) =>
      $hot ? theme.status.awaiting_approval.fg : theme.text};
  }
  .s {
    margin-top: 8px;
    font-size: 13.5px;
    line-height: 1.35;
    color: ${({ theme }) => theme.textMuted};
  }
`;

export default function InvoicePulse({
  openBook,
  needsYou,
  inFlight,
  recovered,
  currency,
}: {
  openBook: number;
  needsYou: number;
  inFlight: number;
  recovered: number;
  currency: string;
}) {
  const theme = useTheme() as AppTheme;
  const openShown = useCountUp(openBook, 750);
  const needsShown = useCountUp(needsYou, 550);

  return (
    <Pulse>
      <Cell $span>
        <div className="k">Open book</div>
        <div className="v" style={{ color: theme.text }}>
          {formatAmount(openShown, currency)}
        </div>
        <div className="s">Still outstanding across the board</div>
      </Cell>
      <Cell $hot={needsYou > 0}>
        <div className="k">Needs you</div>
        <div className="v">{Math.round(needsShown)}</div>
        <div className="s">
          {needsYou === 0
            ? "Nothing blocked on a human"
            : needsYou === 1
              ? "Invoice waiting on your call"
              : "Invoices waiting on your call"}
        </div>
      </Cell>
      <Cell>
        <div className="k">In flight · recovered</div>
        <div className="v" style={{ fontSize: "clamp(22px, 2.4vw, 28px)" }}>
          {inFlight}
          <span style={{ color: theme.textMuted, fontWeight: 500 }}> · </span>
          <span style={{ color: theme.status.recovered.fg }}>{recovered}</span>
        </div>
        <div className="s">Chasing now · already paid</div>
      </Cell>
    </Pulse>
  );
}
