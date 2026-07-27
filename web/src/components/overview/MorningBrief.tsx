"use client";

// One-line morning command: what needs you, cash held, disputes, plans signal.

import styled from "styled-components";
import { formatAmount } from "@/lib/format";
import { useCountUp } from "./useCountUp";

const Brief = styled.section`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 18px;
  padding: 14px 18px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  font-size: 14.5px;
  line-height: 1.45;
  color: ${({ theme }) => theme.textMuted};
  b {
    font-family: var(--font-display, inherit);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: ${({ theme }) => theme.text};
  }
  .hot {
    color: ${({ theme }) => theme.status.awaiting_approval.fg};
  }
`;

export default function MorningBrief({
  needsYou,
  heldAmount,
  currency,
  disputes,
  quarantine,
  plansWaiting,
}: {
  needsYou: number;
  heldAmount: number;
  currency: string;
  disputes: number;
  quarantine: number;
  plansWaiting: number;
}) {
  const held = useCountUp(heldAmount, 700);
  if (needsYou === 0 && disputes === 0 && quarantine === 0 && plansWaiting === 0) {
    return (
      <Brief>
        <span>
          <b>You&rsquo;re clear</b> for now. Settl is chasing the open book.
        </span>
      </Brief>
    );
  }
  return (
    <Brief>
      <span>
        <b className="hot">{needsYou}</b> need you
      </span>
      <span>
        <b>{formatAmount(held, currency)}</b> held on first sends
      </span>
      {disputes > 0 && (
        <span>
          <b>{disputes}</b> dispute{disputes === 1 ? "" : "s"}
        </span>
      )}
      {quarantine > 0 && (
        <span>
          <b>{quarantine}</b> can&rsquo;t read
        </span>
      )}
      {plansWaiting > 0 && (
        <span>
          <b>{plansWaiting}</b> plan{plansWaiting === 1 ? "" : "s"} waiting
        </span>
      )}
    </Brief>
  );
}
