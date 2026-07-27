"use client";

// Persistent engine arming strip: live send, inbound, payments, drafting.

import styled from "styled-components";
import type { EngineHealth } from "@/lib/health";
import { timeAgo } from "@/lib/format";

const Strip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Chip = styled.span<{ $ok?: boolean; $warn?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 11px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.textMuted};
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${({ theme, $ok, $warn }) =>
      $ok
        ? theme.status.recovered.fg
        : $warn
          ? theme.status.awaiting_approval.fg
          : theme.textMuted};
  }
  b {
    color: ${({ theme }) => theme.text};
    font-weight: 700;
  }
`;

export default function ConnectionsStrip({ health }: { health: EngineHealth }) {
  const poll = health.inbound_poll;
  const lastPoll = poll?.last_polled_at ? timeAgo(poll.last_polled_at) : null;
  return (
    <Strip aria-label="Engine connections">
      <Chip $ok={health.live_send} $warn={!health.live_send}>
        <span className="dot" />
        Send <b>{health.live_send ? "live" : "mock"}</b>
      </Chip>
      <Chip $ok={health.inbound_reply_live} $warn={!health.inbound_reply_live}>
        <span className="dot" />
        Inbound <b>{health.inbound_reply_live ? "live" : "off"}</b>
        {lastPoll ? ` · polled ${lastPoll}` : ""}
      </Chip>
      <Chip $ok={health.payments === "stripe"} $warn={health.payments !== "stripe"}>
        <span className="dot" />
        Payments <b>{health.payments === "stripe" ? "Stripe" : "none"}</b>
      </Chip>
      <Chip $ok={health.drafting === "gemini"}>
        <span className="dot" />
        Drafting <b>{health.drafting}</b>
      </Chip>
    </Strip>
  );
}
