"use client";

// Hero stats for Approvals: waiting count + cash held (Overview-grade presence).

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { formatAmount } from "@/lib/format";
import { useCountUp } from "./useCountUp";

const Pulse = styled.section`
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  gap: 1px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.border};
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Cell = styled.div<{ $hot?: boolean }>`
  padding: 18px 20px;
  background: ${({ theme, $hot }) =>
    $hot ? theme.status.awaiting_approval.bg : theme.surface};
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
    font-size: clamp(28px, 3.2vw, 36px);
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

export default function ApprovalPulse({
  waiting,
  heldAmount,
  currency,
}: {
  waiting: number;
  heldAmount: number;
  currency: string;
}) {
  const theme = useTheme() as AppTheme;
  const waitingShown = useCountUp(waiting, 550);
  const heldShown = useCountUp(heldAmount, 750);

  return (
    <Pulse>
      <Cell $hot>
        <div className="k">Waiting on you</div>
        <div className="v">{Math.round(waitingShown)}</div>
        <div className="s">
          First {waiting === 1 ? "message" : "messages"} held until you OK
        </div>
      </Cell>
      <Cell>
        <div className="k">Cash held back</div>
        <div className="v" style={{ color: theme.text }}>
          {formatAmount(heldShown, currency)}
        </div>
        <div className="s">Won&rsquo;t move until these sends go out</div>
      </Cell>
    </Pulse>
  );
}
