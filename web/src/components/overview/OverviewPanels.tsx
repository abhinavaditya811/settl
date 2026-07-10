"use client";

// The supporting Overview panels: overdue-by-age, what-the-agent-decided,
// needs-your-approval, and the plain-English activity feed.

import { useEffect, useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import {
  aging, decisions, approvals, feed, toneFg, toneBg,
} from "./previewData";

const Card = styled.div`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 14px;
  margin-bottom: 14px;
`;
const Pad = styled(Card)`padding: 16px 18px;`;
const Head = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  .t { font-size: 14px; font-weight: 700; }
  .m { font-size: 12.5px; color: ${({ theme }) => theme.textMuted}; }
`;
const Title = styled.div`font-size: 14px; font-weight: 700; margin-bottom: 14px;`;
const Two = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 14px;
`;
const Row = styled.div`
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 11px 18px;
  border-top: 1px solid ${({ theme }) => theme.border};
`;
const Avatar = styled.div<{ $fg: string; $bg: string }>`
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
  color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};
`;
const Pill = styled.span<{ $fg: string; $bg: string }>`
  font-size: 12px; padding: 3px 10px; border-radius: 999px; white-space: nowrap;
  color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};
`;
const Btn = styled.button`
  font-size: 13px; padding: 6px 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  &:hover { background: ${({ theme }) => theme.surfaceAlt}; }
`;
const BtnPrimary = styled(Btn)`
  border: none;
  background: ${({ theme }) => theme.accent};
  color: ${({ theme }) => theme.accentText};
  &:hover { filter: brightness(1.05); background: ${({ theme }) => theme.accent}; }
`;
const Line = styled.div`font-size: 14px; b { font-weight: 700; }`;
const Sub = styled.div`font-size: 12.5px; color: ${({ theme }) => theme.textMuted}; margin-top: 2px;`;

function AgingPanel() {
  const theme = useTheme() as AppTheme;
  const [m, setM] = useState(false);
  useEffect(() => { const id = setTimeout(() => setM(true), 80); return () => clearTimeout(id); }, []);
  const max = Math.max(...aging.map((a) => a.amount));
  return (
    <Pad style={{ margin: 0 }}>
      <Title>Overdue by age</Title>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {aging.map((a) => (
          <div key={a.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ color: theme.textMuted }}>{a.label} · {a.count}</span>
              <span style={{ fontWeight: 700 }}>${a.amount.toLocaleString()}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: theme.surfaceAlt }}>
              <div style={{
                height: 8, borderRadius: 999, background: toneFg(a.tone, theme),
                width: m ? `${Math.round((a.amount / max) * 100)}%` : 0,
                transition: "width 1.1s cubic-bezier(.2,.7,.2,1)",
              }} />
            </div>
          </div>
        ))}
      </div>
    </Pad>
  );
}

function DecisionsPanel() {
  const theme = useTheme() as AppTheme;
  const [m, setM] = useState(false);
  useEffect(() => { const id = setTimeout(() => setM(true), 80); return () => clearTimeout(id); }, []);
  const total = decisions.reduce((s, d) => s + d.value, 0);
  return (
    <Pad style={{ margin: 0 }}>
      <Title>What the agent decided</Title>
      <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: theme.surfaceAlt }}>
        {decisions.map((d) => (
          <div key={d.label} style={{
            height: "100%", background: toneFg(d.tone, theme),
            width: m ? `${(d.value / total) * 100}%` : 0,
            transition: "width 1.1s cubic-bezier(.2,.7,.2,1)",
          }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 14px", marginTop: 14 }}>
        {decisions.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: theme.textMuted }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: toneFg(d.tone, theme) }} />
            <span style={{ color: theme.text }}>{d.label}</span> {d.value}
          </div>
        ))}
      </div>
    </Pad>
  );
}

function ApprovalsPanel() {
  const theme = useTheme() as AppTheme;
  const fg = theme.status.awaiting_approval.fg, bg = theme.status.awaiting_approval.bg;
  return (
    <Card>
      <Head>
        <span className="t">Needs your approval</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Pill $fg={fg} $bg={bg}>{approvals.length} waiting</Pill>
          <BtnPrimary>Review all</BtnPrimary>
        </span>
      </Head>
      {approvals.map((a) => (
        <Row key={a.initials}>
          <Avatar $fg={fg} $bg={bg}>{a.initials}</Avatar>
          <div><Line>First message to <b>{a.name}</b></Line><Sub>{a.sub}</Sub></div>
          <Btn>Review</Btn>
        </Row>
      ))}
    </Card>
  );
}

function ActivityFeed() {
  const theme = useTheme() as AppTheme;
  return (
    <Card>
      <Head><span className="t">What Settl did</span><span className="m">last 24 hours</span></Head>
      {feed.map((f, i) => (
        <Row key={i}>
          <Avatar $fg={toneFg(f.tone, theme)} $bg={toneBg(f.tone, theme)}>{f.initials}</Avatar>
          <div><Line dangerouslySetInnerHTML={{ __html: f.line.replace(/(Summit Roofing Co|Northwind Logistics|Cedar & Co|J\. Alvarez)/, "<b>$1</b>") }} /><Sub>{f.sub}</Sub></div>
          <div style={{ textAlign: "right" }}>
            <Pill $fg={toneFg(f.tone, theme)} $bg={toneBg(f.tone, theme)}>{f.status}</Pill>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{f.time}</div>
          </div>
        </Row>
      ))}
    </Card>
  );
}

export default function OverviewPanels() {
  return (
    <>
      <Two>
        <AgingPanel />
        <DecisionsPanel />
      </Two>
      <ApprovalsPanel />
      <ActivityFeed />
    </>
  );
}
