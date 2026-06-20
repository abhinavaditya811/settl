"use client";

import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";
import { PageHeader, Card, Loading, ErrorState } from "@/components/ui";
import KpiCards from "@/components/overview/KpiCards";
import AgingChart from "@/components/overview/AgingChart";
import OutcomeBar from "@/components/overview/OutcomeBar";
import ActivityList from "@/components/ActivityList";

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 22px;
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const FeedCard = styled(Card)`
  padding: 6px 20px 12px;
  h3 {
    margin: 16px 0 4px;
    font-size: 14px;
    font-weight: 700;
  }
`;

export default function Overview() {
  const { board, metrics, activity, loading, error } = useBoard();

  if (error) return <ErrorState message={error} />;
  if (loading || !board || !metrics) return <Loading what="your recovery overview" />;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Where your money is, and what the agent has been doing"
      />
      <KpiCards metrics={metrics} />
      <TwoCol>
        <AgingChart metrics={metrics} />
        <OutcomeBar summary={board.summary} />
      </TwoCol>
      <FeedCard>
        <h3>Recent activity</h3>
        <ActivityList entries={activity} limit={8} />
      </FeedCard>
    </>
  );
}
