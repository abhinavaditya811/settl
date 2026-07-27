"use client";

// Layout fills the page: left column stacks aging + activity under Needs OK,
// so Pipeline's height never leaves a dead black band beside a short card.

import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";
import CashCommand from "./CashCommand";
import BookHealth from "./BookHealth";
import PipelineMap from "./PipelineMap";
import ChaseQueue from "./ChaseQueue";
import AgentPulse from "./AgentPulse";

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
  const { board, metrics } = useBoard();
  if (!metrics || !board) return null;

  return (
    <Page>
      <Head>
        <h1>Overview</h1>
        <p>What you&rsquo;re owed, what needs your OK, and what Settl already did.</p>
      </Head>
      <CashCommand metrics={metrics} />
      <ChaseQueue />
      <Columns>
        <Stack>
          <BookHealth metrics={metrics} />
          <AgentPulse />
        </Stack>
        <PipelineMap summary={board.summary} />
      </Columns>
    </Page>
  );
}
