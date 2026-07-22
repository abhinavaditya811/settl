"use client";

import styled from "styled-components";
import type { ActivityEntry, TerminalState } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { headline, cleanReasoning, stepTier } from "@/lib/reasoning";
import { EmptyState } from "@/components/ui";

// Map a logged decision to a status color so the feed reads at a glance. Exported
// so other real activity views (ActivityView.tsx) can reuse the same
// categorization instead of reinventing "what counts as a safety event."
export const TONE: Record<string, TerminalState> = {
  escalate: "escalated",
  withheld: "escalated",
  quarantined: "quarantined",
  review: "escalated",
  sent: "sent",
  would_send: "sent",
  approved: "sent",
  accepted: "sent",
  pass: "sent",
  awaiting_approval: "awaiting_approval",
  hold: "held",
  chase: "held",
  skip: "skipped",
};

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const Entry = styled.li<{ $clickable?: boolean }>`
  display: grid;
  grid-template-columns: 14px 1fr auto;
  gap: 12px;
  padding: 13px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};
  transition: background 0.12s ease;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: ${({ theme, $clickable }) =>
      $clickable ? theme.surfaceAlt : "transparent"};
  }
`;

const Dot = styled.span<{ $tone: TerminalState }>`
  margin-top: 5px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${({ theme, $tone }) => theme.status[$tone].fg};
`;

const Body = styled.div`
  min-width: 0;
  .top {
    font-size: 13px;
    .agent {
      font-weight: 700;
    }
    .id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: ${({ theme }) => theme.textMuted};
      margin-left: 8px;
      font-size: 11.5px;
    }
  }
  .why {
    margin-top: 3px;
    font-size: 12.5px;
    line-height: 1.5;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Time = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.textMuted};
  white-space: nowrap;
`;

export default function ActivityList({
  entries,
  limit,
  onSelect,
}: {
  entries: ActivityEntry[];
  limit?: number;
  onSelect?: (invoiceId: string) => void;
}) {
  // The glance widget shows only the milestones that matter, in plain English -
  // the internal mechanics live on the full Activity tab and the invoice timeline.
  const milestones = entries.filter((e) => stepTier(e.agent, e.decision) === "milestone");
  const rows = limit ? milestones.slice(0, limit) : milestones;
  if (rows.length === 0) return <EmptyState text="No activity yet." />;
  return (
    <List>
      {rows.map((e, i) => (
        <Entry
          key={`${e.invoice_id}-${i}`}
          $clickable={!!onSelect}
          onClick={onSelect ? () => onSelect(e.invoice_id) : undefined}
          title={onSelect ? `Open ${e.invoice_id}'s timeline` : undefined}
        >
          <Dot $tone={TONE[e.decision] ?? "skipped"} />
          <Body>
            <div className="top">
              <span className="agent">{headline(e.agent, e.decision)}</span>
              <span className="id">{e.invoice_id}</span>
            </div>
            <div className="why">{cleanReasoning(e.reasoning)}</div>
          </Body>
          <Time>{timeAgo(e.timestamp)}</Time>
        </Entry>
      ))}
    </List>
  );
}
