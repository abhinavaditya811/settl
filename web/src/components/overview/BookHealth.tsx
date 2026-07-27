"use client";

// Aging as horizontal bars (classic AR pattern): compare buckets at a glance,
// then one plain-English takeaway. No stretch gaps, no jargon.

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { Metrics } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { Panel, PanelHead, Rise } from "./overviewChrome";

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 22px 20px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
    gap: 6px;
  }
`;

const Label = styled.div`
  .name {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: ${({ theme }) => theme.text};
  }
  .sub {
    margin-top: 2px;
    font-size: 12.5px;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Track = styled.div`
  height: 12px;
  border-radius: 999px;
  background: ${({ theme }) => theme.surfaceAlt};
  overflow: hidden;
`;

const Fill = styled.div<{ $pct: number; $tone: string }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  min-width: ${({ $pct }) => ($pct > 0 ? "4px" : "0")};
  border-radius: 999px;
  background: ${({ $tone }) => $tone};
  transition: width 0.65s cubic-bezier(0.22, 1, 0.36, 1);
`;

const Amt = styled.div`
  text-align: right;
  min-width: 7.5rem;
  .v {
    font-family: var(--font-display, inherit);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: ${({ theme }) => theme.text};
  }
  .s {
    margin-top: 2px;
    font-size: 12.5px;
    color: ${({ theme }) => theme.textMuted};
  }
  @media (max-width: 560px) {
    text-align: left;
  }
`;

const Takeaway = styled.p<{ $warn: boolean }>`
  margin: 4px 0 0;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.45;
  color: ${({ theme, $warn }) => ($warn ? theme.status.escalated.fg : theme.text)};
  background: ${({ theme, $warn }) => ($warn ? theme.status.escalated.bg : theme.surfaceAlt)};
  strong {
    font-weight: 700;
  }
`;

const TONES = ["held", "awaiting_approval", "escalated"] as const;

const BUCKET_COPY: Record<string, { name: string; meaning: string }> = {
  "0-30 days": { name: "0-30 days late", meaning: "Still early" },
  "31-60 days": { name: "31-60 days late", meaning: "Needs follow-up" },
  "61+ days": { name: "61+ days late", meaning: "At risk" },
};

function bucketCopy(bucket: string) {
  return BUCKET_COPY[bucket] ?? { name: bucket, meaning: "Open balance" };
}

export default function BookHealth({ metrics }: { metrics: Metrics }) {
  const theme = useTheme() as AppTheme;
  const total = Math.max(1, metrics.aging.reduce((s, b) => s + b.amount, 0));
  const oldest = metrics.aging[metrics.aging.length - 1];
  const oldestShare = oldest ? oldest.amount / total : 0;
  const warn = oldestShare >= 0.35;
  const oldestLabel = oldest ? bucketCopy(oldest.bucket).name : "61+ days late";

  return (
    <Rise $delay={80}>
      <Panel>
        <PanelHead>
          <div className="copy">
            <span className="title">How late is the money?</span>
            <span className="hint">Open invoices grouped by how overdue they are.</span>
          </div>
        </PanelHead>
        <Body>
          {metrics.aging.map((b, i) => {
            const tone = theme.status[TONES[i] ?? "held"].fg;
            const share = Math.round((b.amount / total) * 100);
            const copy = bucketCopy(b.bucket);
            return (
              <Row key={b.bucket}>
                <Label>
                  <div className="name">{copy.name}</div>
                  <div className="sub">{copy.meaning}</div>
                </Label>
                <Track>
                  <Fill $pct={(b.amount / total) * 100} $tone={tone} />
                </Track>
                <Amt>
                  <div className="v">{formatAmount(b.amount, metrics.currency)}</div>
                  <div className="s">
                    {share}% · {b.count} invoice{b.count === 1 ? "" : "s"}
                  </div>
                </Amt>
              </Row>
            );
          })}
          <Takeaway $warn={warn}>
            {warn ? (
              <>
                <strong>{Math.round(oldestShare * 100)}%</strong> of what you&rsquo;re owed is{" "}
                {oldestLabel}. Chase that group first.
              </>
            ) : (
              <>Most of what you&rsquo;re owed is still early. Looking good.</>
            )}
          </Takeaway>
        </Body>
      </Panel>
    </Rise>
  );
}
