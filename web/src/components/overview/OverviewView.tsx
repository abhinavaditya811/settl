"use client";

// Layout fills the page: brief + connections, cash, then columns.

import { useMemo } from "react";
import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";
import { needsYou } from "./invoiceNext";
import CashCommand from "./CashCommand";
import BookHealth from "./BookHealth";
import PipelineMap from "./PipelineMap";
import ChaseQueue from "./ChaseQueue";
import AgentPulse from "./AgentPulse";
import MorningBrief from "./MorningBrief";
import ConnectionsStrip from "./ConnectionsStrip";
import CashForecast from "./CashForecast";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Head = styled.header`
  h1 {
    margin: 0;
    font-family: var(--font-display, inherit);
    font-size: clamp(26px, 2.6vw, 32px);
    font-weight: 600;
    letter-spacing: -0.045em;
  }
  p {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 1.4;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 14px;
  align-items: start;
  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
`;

export default function OverviewView() {
  const { board, metrics, health } = useBoard();
  const brief = useMemo(() => {
    const inv = board?.invoices ?? [];
    const needs = inv.filter((i) => needsYou(i) || i.can_approve);
    const held = inv
      .filter((i) => i.can_approve)
      .reduce((s, i) => s + (Number(i.amount_due) || 0), 0);
    return {
      needsYou: needs.length,
      heldAmount: held,
      disputes: inv.filter((i) => i.terminal_state === "escalated").length,
      quarantine: inv.filter((i) => i.terminal_state === "quarantined").length,
      plansWaiting: inv.filter((i) => /payment.?plan/i.test(i.detail ?? "")).length,
      currency: metrics?.currency ?? inv[0]?.currency ?? "USD",
    };
  }, [board, metrics]);

  if (!metrics || !board) return null;

  return (
    <Page>
      <Head>
        <h1>Overview</h1>
        <p>Command room: what needs you, what Settl is doing, how the engine is armed.</p>
      </Head>
      <ConnectionsStrip health={health} />
      <MorningBrief {...brief} />
      <CashCommand metrics={metrics} />
      <ChaseQueue />
      <Columns>
        <Stack>
          <BookHealth metrics={metrics} />
          <CashForecast metrics={metrics} />
          <AgentPulse />
        </Stack>
        <PipelineMap summary={board.summary} />
      </Columns>
    </Page>
  );
}
