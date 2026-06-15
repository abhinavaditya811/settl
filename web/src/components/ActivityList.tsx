"use client";

import styled from "styled-components";
import type { ActivityEntry, TerminalState } from "@/lib/types";
import { prettyAgent, timeAgo } from "@/lib/format";
import { EmptyState } from "@/components/ui";

// Map a logged decision to a status color so the feed reads at a glance.
const TONE: Record<string, TerminalState> = {
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

const Entry = styled.li`
  display: grid;
  grid-template-columns: 14px 1fr auto;
  gap: 12px;
  padding: 13px 2px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  &:last-child {
    border-bottom: none;
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
      text-transform: capitalize;
    }
    .id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: ${({ theme }) => theme.textMuted};
      margin-left: 8px;
    }
    .decision {
      color: ${({ theme }) => theme.textMuted};
      margin-left: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
}: {
  entries: ActivityEntry[];
  limit?: number;
}) {
  const rows = limit ? entries.slice(0, limit) : entries;
  if (rows.length === 0) return <EmptyState text="No activity yet." />;
  return (
    <List>
      {rows.map((e, i) => (
        <Entry key={`${e.invoice_id}-${i}`}>
          <Dot $tone={TONE[e.decision] ?? "skipped"} />
          <Body>
            <div className="top">
              <span className="agent">{prettyAgent(e.agent)}</span>
              <span className="id">{e.invoice_id}</span>
              <span className="decision">{e.decision}</span>
            </div>
            <div className="why">{e.reasoning}</div>
          </Body>
          <Time>{timeAgo(e.timestamp)}</Time>
        </Entry>
      ))}
    </List>
  );
}
