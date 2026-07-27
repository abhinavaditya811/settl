"use client";

// Pipeline as a split of agent vs human, plus readable status tiles with big counts.

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import {
  STATE_META,
  STATE_ORDER,
  type BoardSummary,
  type TerminalState,
} from "@/lib/types";
import { Panel, PanelHead, Rise } from "./overviewChrome";

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 22px 20px;
`;

const Split = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const SplitCard = styled.div<{ $tone: "agent" | "you" }>`
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme, $tone }) =>
    $tone === "you" ? theme.status.awaiting_approval.bg : theme.surfaceAlt};
  .k {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.textMuted};
  }
  .v {
    margin-top: 6px;
    font-family: var(--font-display, inherit);
    font-size: 32px;
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 1;
    color: ${({ theme, $tone }) =>
      $tone === "you" ? theme.status.awaiting_approval.fg : theme.text};
  }
  .s {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.35;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Bar = styled.div`
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: ${({ theme }) => theme.surfaceAlt};
`;

const Seg = styled.div<{ $tone: TerminalState; $pct: number }>`
  width: ${({ $pct }) => $pct}%;
  min-width: ${({ $pct }) => ($pct > 0 ? "3px" : "0")};
  background: ${({ theme, $tone }) => theme.status[$tone].fg};
  transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Item = styled.div<{ $fg: string; $bg: string }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 11px 12px 11px 14px;
  border-radius: 12px;
  background: ${({ $bg }) => $bg};
  border-left: 3px solid ${({ $fg }) => $fg};
  .label {
    font-size: 14px;
    font-weight: 600;
    color: ${({ theme }) => theme.text};
  }
  .count {
    font-family: var(--font-display, inherit);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.03em;
    color: ${({ $fg }) => $fg};
  }
`;

export default function PipelineMap({ summary }: { summary: BoardSummary }) {
  const theme = useTheme() as AppTheme;
  const total = Math.max(1, summary.total);
  const present = STATE_ORDER.filter((s) => (summary.counts[s] ?? 0) > 0);
  const human = (summary.counts.awaiting_approval ?? 0) + (summary.counts.escalated ?? 0);
  const autonomous = Math.max(0, summary.total - human);

  return (
    <Rise $delay={120}>
      <Panel>
        <PanelHead>
          <div className="copy">
            <span className="title">Where invoices stand</span>
            <span className="hint">{summary.total} open invoices in the recovery flow.</span>
          </div>
        </PanelHead>
        <Body>
          <Split>
            <SplitCard $tone="agent">
              <div className="k">Settl is handling</div>
              <div className="v">{autonomous}</div>
              <div className="s">No action needed from you</div>
            </SplitCard>
            <SplitCard $tone="you">
              <div className="k">Waiting on you</div>
              <div className="v">{human}</div>
              <div className="s">Approve or review these</div>
            </SplitCard>
          </Split>
          <Bar>
            {present.map((s) => (
              <Seg key={s} $tone={s} $pct={((summary.counts[s] ?? 0) / total) * 100} />
            ))}
          </Bar>
          <List>
            {present.map((s) => (
              <Item key={s} $fg={theme.status[s].fg} $bg={theme.status[s].bg}>
                <span className="label">{STATE_META[s].label}</span>
                <span className="count">{summary.counts[s] ?? 0}</span>
              </Item>
            ))}
          </List>
        </Body>
      </Panel>
    </Rise>
  );
}
