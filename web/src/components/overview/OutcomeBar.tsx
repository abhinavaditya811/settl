"use client";

import styled from "styled-components";
import {
  STATE_META,
  STATE_ORDER,
  type BoardSummary,
  type TerminalState,
} from "@/lib/types";
import { Card } from "@/components/ui";

const Box = styled(Card)`
  padding: 18px 20px 20px;
  h3 {
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 700;
  }
`;

const Bar = styled.div`
  display: flex;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: ${({ theme }) => theme.surfaceAlt};
  margin-bottom: 16px;
`;

const Seg = styled.div<{ $tone: TerminalState; $pct: number }>`
  width: ${({ $pct }) => $pct}%;
  background: ${({ theme, $tone }) => theme.status[$tone].fg};
`;

const Legend = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px 18px;
`;

const Item = styled.div<{ $tone: TerminalState }>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    background: ${({ theme, $tone }) => theme.status[$tone].fg};
  }
  .label {
    color: ${({ theme }) => theme.textMuted};
  }
  .count {
    margin-left: auto;
    font-weight: 700;
  }
`;

export default function OutcomeBar({ summary }: { summary: BoardSummary }) {
  const total = Math.max(1, summary.total);
  const present = STATE_ORDER.filter((s) => (summary.counts[s] ?? 0) > 0);
  return (
    <Box>
      <h3>What the agent decided</h3>
      <Bar>
        {present.map((s) => (
          <Seg key={s} $tone={s} $pct={((summary.counts[s] ?? 0) / total) * 100} />
        ))}
      </Bar>
      <Legend>
        {present.map((s) => (
          <Item key={s} $tone={s}>
            <span className="dot" />
            <span className="label">{STATE_META[s].label}</span>
            <span className="count">{summary.counts[s] ?? 0}</span>
          </Item>
        ))}
      </Legend>
    </Box>
  );
}
