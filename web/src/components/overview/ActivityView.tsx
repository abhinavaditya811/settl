"use client";

// Activity tab: the audit + observability surface - a grouped, plain-English
// timeline of every real logged decision, filterable by agent + "safety only."
// The old period digest (today/week/month rollups) and "0 unsafe ever" trust
// strip are cut - no rollup endpoint exists, and a windowed 50-row fetch can't
// honestly back a global guarantee. See ActivityList.tsx's TONE map for what
// counts as a "safety" decision - reused here rather than reinvented.

import { useMemo, useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { useBoard } from "@/lib/BoardContext";
import { prettyAgent, timeAgo } from "@/lib/format";
import { TONE } from "@/components/ActivityList";

const Title = styled.h1`font-size: 22px; font-weight: 700; margin: 0;`;
const Sub = styled.p`font-size: 13.5px; color: ${({ theme }) => theme.textMuted}; margin: 4px 0 16px;`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;`;
const Chip = styled.button<{ $on: boolean }>`
  font-size: 12.5px; padding: 5px 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid ${({ theme, $on }) => ($on ? theme.accent : theme.border)};
  background: ${({ theme, $on }) => ($on ? theme.accent : theme.surface)};
  color: ${({ theme, $on }) => ($on ? theme.accentText : theme.textMuted)};
`;
const Day = styled.div`font-size: 11.5px; font-weight: 700; color: ${({ theme }) => theme.textMuted}; text-transform: uppercase; letter-spacing: 0.04em; margin: 6px 0 8px;`;
const Ev = styled.div`
  display: grid; grid-template-columns: 12px 1fr auto; gap: 12px; align-items: start;
  padding: 11px 0; border-bottom: 1px solid ${({ theme }) => theme.border};
  &:last-child { border-bottom: none; }
  .dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 5px; }
  .a { font-size: 12.5px; font-weight: 700; }
  .l { font-size: 13px; color: ${({ theme }) => theme.textMuted}; margin-top: 1px; line-height: 1.5; }
  .inv { font-size: 11px; color: ${({ theme }) => theme.accent}; font-family: ui-monospace, Menlo, monospace; }
  .t { font-size: 12px; color: ${({ theme }) => theme.textMuted}; white-space: nowrap; }
`;

const SAFETY_TONES = new Set(["escalated", "quarantined"]);

function dayBucket(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ActivityView() {
  const theme = useTheme() as AppTheme;
  const { activity } = useBoard();
  const [agent, setAgent] = useState("all");
  const [safetyOnly, setSafetyOnly] = useState(false);

  const agents = useMemo(() => Array.from(new Set(activity.map((e) => e.agent))), [activity]);

  const rows = useMemo(
    () =>
      activity.filter((e) => {
        const tone = TONE[e.decision] ?? "skipped";
        return (agent === "all" || e.agent === agent) && (!safetyOnly || SAFETY_TONES.has(tone));
      }),
    [activity, agent, safetyOnly],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const e of rows) {
      const key = dayBucket(e.timestamp);
      const bucket = map.get(key) ?? [];
      bucket.push(e);
      map.set(key, bucket);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <>
      <Title>Activity</Title>
      <Sub>Everything the agent did — the audit trail behind every invoice.</Sub>

      {activity.length > 0 && (
        <Chips>
          <Chip $on={agent === "all"} onClick={() => setAgent("all")}>All</Chip>
          {agents.map((a) => (
            <Chip key={a} $on={agent === a} onClick={() => setAgent(a)}>{prettyAgent(a)}</Chip>
          ))}
          <Chip $on={safetyOnly} onClick={() => setSafetyOnly((s) => !s)}>🛡 Safety only</Chip>
        </Chips>
      )}

      {activity.length === 0 ? (
        <Sub>Settl hasn&rsquo;t taken any actions yet.</Sub>
      ) : groups.length === 0 ? (
        <Sub>No activity matches your filters.</Sub>
      ) : (
        groups.map(([day, items]) => (
          <div key={day}>
            <Day>{day}</Day>
            {items.map((e, i) => (
              <Ev key={`${e.invoice_id}-${i}`}>
                <span className="dot" style={{ background: theme.status[TONE[e.decision] ?? "skipped"].fg }} />
                <div>
                  <div className="a">{prettyAgent(e.agent)}</div>
                  <div className="l">{e.reasoning}</div>
                  <span className="inv">{e.invoice_id} ↗</span>
                </div>
                <span className="t">{timeAgo(e.timestamp)}</span>
              </Ev>
            ))}
          </div>
        ))
      )}
    </>
  );
}
