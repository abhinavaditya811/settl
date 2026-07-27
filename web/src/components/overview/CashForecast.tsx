"use client";

// Honest cash-in estimate from aging buckets (labeled model, not a promise).

import styled from "styled-components";
import type { Metrics } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { Panel, PanelHead } from "./overviewChrome";

const Body = styled.div`
  padding: 0 22px 18px;
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid ${({ theme }) => theme.border};
    font-size: 13.5px;
    &:last-child {
      border-bottom: none;
    }
  }
  .k {
    color: ${({ theme }) => theme.textMuted};
  }
  .v {
    font-family: var(--font-display, inherit);
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .note {
    margin-top: 10px;
    font-size: 12.5px;
    line-height: 1.4;
    color: ${({ theme }) => theme.textMuted};
  }
`;

/** Rough weights: sooner buckets more likely in the next 14 days. */
function weight(bucket: string): number {
  const b = bucket.toLowerCase();
  if (b.includes("current") || b.includes("0")) return 0.55;
  if (b.includes("1") && b.includes("30")) return 0.4;
  if (b.includes("31") || b.includes("60")) return 0.25;
  if (b.includes("61") || b.includes("90")) return 0.12;
  return 0.05;
}

export default function CashForecast({ metrics }: { metrics: Metrics }) {
  const estimate = metrics.aging.reduce(
    (s, a) => s + a.amount * weight(a.bucket),
    0,
  );
  return (
    <Panel>
      <PanelHead>
        <div className="copy">
          <span className="title">Cash forecast</span>
          <span className="hint">Model estimate for the next ~14 days</span>
        </div>
      </PanelHead>
      <Body>
        <div className="row">
          <span className="k">Expected if chase continues</span>
          <span className="v">{formatAmount(estimate, metrics.currency)}</span>
        </div>
        <div className="row">
          <span className="k">Open book</span>
          <span className="v">{formatAmount(metrics.outstanding, metrics.currency)}</span>
        </div>
        <p className="note">
          Weighted from aging buckets only. Not a guarantee, not revenue evidence.
        </p>
      </Body>
    </Panel>
  );
}
