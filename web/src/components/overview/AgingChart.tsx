"use client";

import styled from "styled-components";
import type { Metrics } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { Card } from "@/components/ui";

const Box = styled(Card)`
  padding: 18px 20px 20px;
  h3 {
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 700;
  }
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 78px 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 13px;
  &:last-child {
    margin-bottom: 0;
  }
  .label {
    font-size: 12.5px;
    color: ${({ theme }) => theme.textMuted};
    font-weight: 600;
  }
  .amt {
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
  }
`;

const Track = styled.div`
  height: 9px;
  border-radius: 999px;
  background: ${({ theme }) => theme.surfaceAlt};
  overflow: hidden;
`;

const Fill = styled.div<{ $pct: number; $tone: "held" | "awaiting_approval" | "escalated" }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  border-radius: 999px;
  background: ${({ theme, $tone }) => theme.status[$tone].fg};
  transition: width 0.3s ease;
`;

const TONES = ["held", "awaiting_approval", "escalated"] as const;

export default function AgingChart({ metrics }: { metrics: Metrics }) {
  const max = Math.max(1, ...metrics.aging.map((b) => b.amount));
  return (
    <Box>
      <h3>Overdue by age</h3>
      {metrics.aging.map((b, i) => (
        <Row key={b.bucket}>
          <div className="label">{b.bucket}</div>
          <Track>
            <Fill $pct={(b.amount / max) * 100} $tone={TONES[i] ?? "held"} />
          </Track>
          <div className="amt">
            {formatAmount(b.amount, metrics.currency)}
            <span style={{ opacity: 0.6 }}> · {b.count}</span>
          </div>
        </Row>
      ))}
    </Box>
  );
}
