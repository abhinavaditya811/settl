"use client";

import styled from "styled-components";
import type { Metrics, TerminalState } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { Card } from "@/components/ui";

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin-bottom: 22px;
`;

const Kpi = styled(Card)<{ $accent?: TerminalState }>`
  padding: 18px 18px 16px;
  .label {
    font-size: 12.5px;
    color: ${({ theme }) => theme.textMuted};
    font-weight: 600;
  }
  .value {
    margin-top: 8px;
    font-size: 25px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: ${({ theme, $accent }) => ($accent ? theme.status[$accent].fg : theme.text)};
  }
  .sub {
    margin-top: 3px;
    font-size: 12px;
    color: ${({ theme }) => theme.textMuted};
  }
`;

interface Item {
  label: string;
  value: string;
  sub: string;
  accent?: TerminalState;
}

export default function KpiCards({ metrics }: { metrics: Metrics }) {
  const ccy = metrics.currency;
  const items: Item[] = [
    {
      label: "Outstanding",
      value: formatAmount(metrics.outstanding, ccy),
      sub: "still owed across open invoices",
    },
    {
      label: "In flight",
      value: formatAmount(metrics.in_flight, ccy),
      sub: "actively being chased",
      accent: "held",
    },
    {
      label: "Recovered",
      value: formatAmount(metrics.recovered, ccy),
      sub: "marked paid",
      accent: "sent",
    },
    {
      label: "Awaiting you",
      value: String(metrics.awaiting_count),
      sub: `${formatAmount(metrics.awaiting_amount, ccy)} pending sign-off`,
      accent: "awaiting_approval",
    },
  ];

  return (
    <Grid>
      {items.map((it) => (
        <Kpi key={it.label} $accent={it.accent}>
          <div className="label">{it.label}</div>
          <div className="value">{it.value}</div>
          <div className="sub">{it.sub}</div>
        </Kpi>
      ))}
    </Grid>
  );
}
