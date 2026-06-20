"use client";

import { useMemo, useState } from "react";
import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";
import { prettyAgent } from "@/lib/format";
import { PageHeader, Card, Loading, ErrorState } from "@/components/ui";
import Chips, { type ChipOption } from "@/components/Chips";
import ActivityList from "@/components/ActivityList";

const Controls = styled.div`
  margin-bottom: 16px;
`;

const FeedCard = styled(Card)`
  padding: 4px 20px 8px;
`;

export default function ActivityPage() {
  const { activity, loading, error } = useBoard();
  const [agent, setAgent] = useState("all");

  const chips: ChipOption[] = useMemo(() => {
    const counts: Record<string, number> = {};
    activity.forEach((e) => {
      counts[e.agent] = (counts[e.agent] ?? 0) + 1;
    });
    return [
      { key: "all", label: "All", count: activity.length },
      ...Object.keys(counts).map((a) => ({
        key: a,
        label: prettyAgent(a),
        count: counts[a],
      })),
    ];
  }, [activity]);

  const rows = useMemo(
    () => (agent === "all" ? activity : activity.filter((e) => e.agent === agent)),
    [activity, agent],
  );

  if (error) return <ErrorState message={error} />;
  if (loading) return <Loading what="the activity log" />;

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Every agent decision, newest first - the audit trail behind each invoice"
      />
      <Controls>
        <Chips options={chips} active={agent} onPick={setAgent} />
      </Controls>
      <FeedCard>
        <ActivityList entries={rows} />
      </FeedCard>
    </>
  );
}
