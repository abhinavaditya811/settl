"use client";

// Redesigned Activity tab (preview, mock data): the audit + observability surface.
// A period digest of what the agent did, a safety strip (the trust proof), and a
// grouped plain-English timeline filterable by agent + "safety only". Export and
// the period rollups are mock for now.

import { useMemo, useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { activity, agentLabel, digest, toneFg, type DigestPeriod } from "./previewData";

const Title = styled.h1`font-size: 22px; font-weight: 700; margin: 0;`;
const Row1 = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 4px 0 16px;`;
const Sub = styled.p`font-size: 13.5px; color: ${({ theme }) => theme.textMuted}; margin: 0;`;
const Export = styled.button`
  font-size: 12.5px; padding: 8px 13px; border-radius: 8px; cursor: pointer; white-space: nowrap;
  border: 1px solid ${({ theme }) => theme.border}; background: ${({ theme }) => theme.surface}; color: ${({ theme }) => theme.text};
  &:hover { background: ${({ theme }) => theme.surfaceAlt}; }
`;
const Seg = styled.div`display: inline-flex; border: 1px solid ${({ theme }) => theme.border}; border-radius: 9px; overflow: hidden; margin-bottom: 14px;`;
const SegBtn = styled.button<{ $on: boolean }>`
  font-size: 12.5px; padding: 6px 14px; cursor: pointer; border: none;
  background: ${({ theme, $on }) => ($on ? theme.accent : "transparent")};
  color: ${({ theme, $on }) => ($on ? theme.accentText : theme.textMuted)};
`;
const Card = styled.div`background: ${({ theme }) => theme.surface}; border: 1px solid ${({ theme }) => theme.border}; border-radius: 12px; padding: 16px 18px; margin-bottom: 14px;`;
const Stats = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 12px;`;
const Stat = styled.div`background: ${({ theme }) => theme.surfaceAlt}; border-radius: 9px; padding: 10px 12px; .v { font-size: 20px; font-weight: 700; } .l { font-size: 12px; color: ${({ theme }) => theme.textMuted}; margin-top: 1px; }`;
const Safe = styled.div`display: flex; align-items: center; gap: 12px; background: ${({ theme }) => theme.status.sent.bg}; border: 1px solid ${({ theme }) => theme.status.sent.fg}; border-radius: 11px; padding: 13px 16px; margin-bottom: 14px; .big { font-size: 13.5px; font-weight: 700; color: ${({ theme }) => theme.status.sent.fg}; } .sub { font-size: 12.5px; color: ${({ theme }) => theme.status.sent.fg}; }`;
const Shield = styled.span<{ $c: string }>`font-size: 22px; line-height: 1; color: ${({ $c }) => $c};`;
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
const PERIODS: { k: DigestPeriod; label: string }[] = [
  { k: "today", label: "Today" }, { k: "week", label: "Week" }, { k: "month", label: "Month" },
];
const PERIOD_WORD: Record<DigestPeriod, string> = { today: "Today", week: "This week", month: "This month" };

export default function ActivityView() {
  const theme = useTheme() as AppTheme;
  const [period, setPeriod] = useState<DigestPeriod>("week");
  const [agent, setAgent] = useState("all");
  const [safetyOnly, setSafetyOnly] = useState(false);
  const d = digest[period];

  const agents = useMemo(() => Array.from(new Set(activity.map((e) => e.agent))), []);
  const rows = activity.filter((e) => (agent === "all" || e.agent === agent) && (!safetyOnly || e.safety));
  const byDay = (["Today", "Yesterday"] as const).map((day) => ({ day, items: rows.filter((e) => e.day === day) })).filter((g) => g.items.length);

  return (
    <>
      <Title>Activity</Title>
      <Row1>
        <Sub>Everything the agent did — the audit trail behind every invoice.</Sub>
        <Export>↓ Export audit log</Export>
      </Row1>

      <Seg>
        {PERIODS.map((p) => <SegBtn key={p.k} $on={period === p.k} onClick={() => setPeriod(p.k)}>{p.label}</SegBtn>)}
      </Seg>

      <Card>
        <div style={{ fontSize: 13.5 }}>
          <span style={{ fontWeight: 700 }}>{PERIOD_WORD[period]},</span> Settl handled{" "}
          <span style={{ fontWeight: 700 }}>{d.handled} invoices</span> across {d.customers} customers — autonomously.
        </div>
        <Stats>
          <Stat><div className="v">{d.sent}</div><div className="l">reminders sent</div></Stat>
          <Stat><div className="v" style={{ color: theme.status.sent.fg }}>{d.recovered}</div><div className="l">recovered</div></Stat>
          <Stat><div className="v" style={{ color: theme.status.awaiting_approval.fg }}>{d.held}</div><div className="l">held for you</div></Stat>
          <Stat><div className="v" style={{ color: theme.status.escalated.fg }}>{d.blocked}</div><div className="l">blocked by the gate</div></Stat>
        </Stats>
      </Card>

      <Safe>
        <Shield $c={theme.status.sent.fg}>🛡</Shield>
        <div>
          <div className="big">0 unsafe or consumer-debt messages ever sent</div>
          <div className="sub">every decision logged · {d.blocked} risky {d.blocked === 1 ? "draft" : "drafts"} caught and escalated to you</div>
        </div>
      </Safe>

      <Chips>
        <Chip $on={agent === "all"} onClick={() => setAgent("all")}>All</Chip>
        {agents.map((a) => <Chip key={a} $on={agent === a} onClick={() => setAgent(a)}>{agentLabel[a] ?? a}</Chip>)}
        <Chip $on={safetyOnly} onClick={() => setSafetyOnly((s) => !s)}>🛡 Safety only</Chip>
      </Chips>

      {byDay.length === 0 ? (
        <Sub>No activity matches your filters.</Sub>
      ) : byDay.map((g) => (
        <div key={g.day}>
          <Day>{g.day}</Day>
          {g.items.map((e, i) => (
            <Ev key={i}>
              <span className="dot" style={{ background: toneFg(e.tone, theme) }} />
              <div>
                <div className="a">{agentLabel[e.agent] ?? e.agent}</div>
                <div className="l">{e.line}</div>
                <span className="inv">{e.inv} ↗</span>
              </div>
              <span className="t">{e.time}</span>
            </Ev>
          ))}
        </div>
      ))}
    </>
  );
}
