"use client";

// Hero stats for Activity: events today + safety flags in the windowed feed.

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { useCountUp } from "./useCountUp";

const Pulse = styled.section`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.border};
  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const Cell = styled.div<{ $hot?: boolean }>`
  padding: 18px 20px;
  background: ${({ theme, $hot }) =>
    $hot ? theme.status.escalated.bg : theme.surface};
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
      $hot ? theme.status.escalated.fg : theme.text};
  }
  .s {
    margin-top: 8px;
    font-size: 13.5px;
    line-height: 1.35;
    color: ${({ theme }) => theme.textMuted};
  }
`;

export default function ActivityPulse({
  eventsToday,
  safetyFlags,
}: {
  eventsToday: number;
  safetyFlags: number;
}) {
  const theme = useTheme() as AppTheme;
  const todayShown = useCountUp(eventsToday, 550);
  const safetyShown = useCountUp(safetyFlags, 550);

  return (
    <Pulse>
      <Cell>
        <div className="k">Events today</div>
        <div className="v" style={{ color: theme.text }}>
          {Math.round(todayShown)}
        </div>
        <div className="s">
          {eventsToday === 0
            ? "Quiet so far today"
            : eventsToday === 1
              ? "Logged action in the trail"
              : "Logged actions in the trail"}
        </div>
      </Cell>
      <Cell $hot={safetyFlags > 0}>
        <div className="k">Safety flags</div>
        <div className="v">{Math.round(safetyShown)}</div>
        <div className="s">
          {safetyFlags === 0
            ? "No escalations or quarantines in this feed"
            : "Escalated or quarantined in this feed"}
        </div>
      </Cell>
    </Pulse>
  );
}
