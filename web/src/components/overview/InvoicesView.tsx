"use client";

// Redesigned Invoices tab (preview, mock data): an "agent cockpit" - a dense table
// (invoice, debtor, amount, overdue+heat, type, status, the agent's NEXT action)
// with hover quick-actions, and a drawer that leads with what's next + steering,
// then the decision trace + message. Steering controls are mock for now.

import { useMemo, useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { TerminalState } from "@/lib/types";
import { invoices, type InvoiceRow, type Tone, toneFg, toneBg } from "./previewData";

const LABEL: Record<TerminalState, string> = {
  sent: "Sent", recovered: "Recovered", awaiting_approval: "Awaiting you",
  escalated: "Escalated", skipped: "Skipped", held: "On hold", quarantined: "Quarantined",
};
function tone(o: TerminalState): Tone {
  if (o === "sent" || o === "recovered") return "sent";
  if (o === "awaiting_approval") return "awaiting";
  if (o === "escalated") return "escalated";
  if (o === "held") return "accent";
  if (o === "quarantined") return "quarantined";
  return "muted";
}
function days(ovd: string): number | null { const n = parseInt(ovd, 10); return Number.isNaN(n) ? null : n; }
function nextAction(i: InvoiceRow): { text: string; tone: Tone } {
  switch (i.outcome) {
    case "recovered": return { text: "Done · paid", tone: "sent" };
    case "awaiting_approval": return { text: "Waiting on your approval", tone: "awaiting" };
    case "escalated": return { text: "You — debtor disputed", tone: "escalated" };
    case "held": return { text: "Resumes in 2 days", tone: "accent" };
    case "skipped": return { text: "No action — settled", tone: "muted" };
    case "quarantined": return { text: "You — couldn't read it", tone: "quarantined" };
    default: return { text: "Final notice in 14 days", tone: "muted" };
  }
}
function whatsNext(i: InvoiceRow): string {
  switch (i.outcome) {
    case "recovered": return "Paid — nothing more to do.";
    case "awaiting_approval": return "Held for your approval — approve to send the first message.";
    case "escalated": return "Routed to you — Settl won't act until you resolve it.";
    case "held": return "Settl will resume chasing in 2 days (respecting contact limits).";
    case "skipped": return "No outreach needed — already settled or not yet due.";
    case "quarantined": return "Settl couldn't read this invoice — needs a human to check.";
    default: return "Settl will send a final notice in 14 days unless it's paid.";
  }
}

const Title = styled.h1`font-size: 22px; font-weight: 700; margin: 0;`;
const Sub = styled.p`font-size: 13.5px; color: ${({ theme }) => theme.textMuted}; margin: 4px 0 16px;`;
const Search = styled.input`
  width: 100%; max-width: 340px; height: 36px; padding: 0 13px; border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.border}; background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text}; font: inherit; font-size: 13.5px; margin-bottom: 12px;
  &:focus { outline: none; border-color: ${({ theme }) => theme.accent}; }
  &::placeholder { color: ${({ theme }) => theme.textMuted}; }
`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;`;
const Chip = styled.button<{ $on: boolean }>`
  font-size: 12.5px; padding: 5px 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid ${({ theme, $on }) => ($on ? theme.accent : theme.border)};
  background: ${({ theme, $on }) => ($on ? theme.accent : theme.surface)};
  color: ${({ theme, $on }) => ($on ? theme.accentText : theme.textMuted)};
`;
const Wrap = styled.div`border: 1px solid ${({ theme }) => theme.border}; border-radius: 14px; overflow-x: auto; background: ${({ theme }) => theme.surface};`;
const COLS = "82px minmax(150px,1.4fr) 92px 78px 96px 116px minmax(160px,1.5fr)";
const HRow = styled.div`
  display: grid; grid-template-columns: ${COLS}; gap: 10px; min-width: 820px; padding: 11px 16px;
  background: ${({ theme }) => theme.surfaceAlt}; border-bottom: 1px solid ${({ theme }) => theme.border};
  font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; color: ${({ theme }) => theme.textMuted};
`;
const TRow = styled.div`
  display: grid; grid-template-columns: ${COLS}; gap: 10px; min-width: 820px; align-items: center;
  padding: 10px 16px; border-bottom: 1px solid ${({ theme }) => theme.border}; cursor: pointer; font-size: 13px;
  &:last-child { border-bottom: none; }
  &:hover { background: ${({ theme }) => theme.surfaceAlt}; }
  &:hover .next-text { display: none; }
  &:hover .next-acts { display: flex; }
`;
const Id = styled.span`font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: ${({ theme }) => theme.textMuted};`;
const Who = styled.div`display: flex; align-items: center; gap: 9px; min-width: 0;`;
const Av = styled.div<{ $fg: string; $bg: string }>`
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 700;
  color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};
`;
const Nm = styled.span`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Amt = styled.span`font-weight: 700; white-space: nowrap;`;
const Heat = styled.span`display: inline-flex; align-items: center; gap: 6px; color: ${({ theme }) => theme.textMuted}; white-space: nowrap; .d { width: 7px; height: 7px; border-radius: 50%; }`;
const Pill = styled.span<{ $fg: string; $bg: string }>`font-size: 11.5px; padding: 2px 9px; border-radius: 999px; white-space: nowrap; color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};`;
const Next = styled.div`min-width: 0; .next-text { display: flex; align-items: center; gap: 6px; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .next-acts { display: none; gap: 5px; }`;
const QA = styled.button`
  width: 26px; height: 26px; border-radius: 7px; border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface}; color: ${({ theme }) => theme.textMuted}; font-size: 13px; cursor: pointer;
  &:hover { background: ${({ theme }) => theme.surfaceAlt}; color: ${({ theme }) => theme.text}; }
`;
const Overlay = styled.div`position: fixed; inset: 0; background: rgba(8,11,15,0.45); z-index: 40;`;
const Drawer = styled.aside`position: fixed; top: 0; right: 0; height: 100vh; width: min(480px,96vw); z-index: 41; background: ${({ theme }) => theme.bg}; border-left: 1px solid ${({ theme }) => theme.border}; display: flex; flex-direction: column;`;
const DHead = styled.div`padding: 20px 22px 16px; border-bottom: 1px solid ${({ theme }) => theme.border};`;
const DBody = styled.div`flex: 1; overflow-y: auto; padding: 18px 22px;`;
const Cap = styled.div`font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: ${({ theme }) => theme.textMuted}; font-weight: 700; margin: 16px 0 10px;`;
const WhatsNext = styled.div`border: 1px solid ${({ theme }) => theme.accent}; background: ${({ theme }) => theme.surfaceAlt}; border-radius: 11px; padding: 13px 15px;`;
const Steer = styled.div`display: flex; gap: 8px; flex-wrap: wrap; margin-top: 11px;`;
const SBtn = styled.button`font-size: 12.5px; padding: 7px 12px; border-radius: 8px; border: 1px solid ${({ theme }) => theme.border}; background: ${({ theme }) => theme.surface}; color: ${({ theme }) => theme.text}; cursor: pointer; &:hover { background: ${({ theme }) => theme.surfaceAlt}; }`;
const Msg = styled.div`border: 1px solid ${({ theme }) => theme.border}; border-radius: 11px; background: ${({ theme }) => theme.surface}; padding: 13px 15px; font-size: 13.5px; line-height: 1.6;`;
const TL = styled.ol`list-style: none; margin: 0; padding: 0 0 0 6px;`;
const Hop = styled.li<{ $c: string; $last: boolean }>`
  position: relative; padding: 0 0 16px 22px; border-left: 2px solid ${({ theme, $last }) => ($last ? "transparent" : theme.border)};
  &::before { content: ""; position: absolute; left: -7px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: ${({ $c }) => $c}; border: 2px solid ${({ theme }) => theme.bg}; }
  .a { font-weight: 700; font-size: 13.5px; } .w { font-size: 13px; line-height: 1.5; color: ${({ theme }) => theme.textMuted}; margin-top: 3px; }
`;

interface Step { a: string; w: string; ok?: boolean; }
function buildTrace(i: InvoiceRow): { steps: Step[]; message?: string } {
  const base: Step[] = [
    { a: "Ingestion", w: `Read ${i.debtor}'s invoice — complete and actionable.` },
    { a: "Strategy", w: `${i.overdue} overdue, ${i.b2b ? "B2B" : "consumer"} — decided how to handle it.` },
  ];
  switch (i.outcome) {
    case "escalated": return { steps: [...base, { a: "Compliance gate", w: "Blocked and routed to you — outside policy or disputed." }] };
    case "quarantined": return { steps: [{ a: "Ingestion", w: "Couldn't read this invoice — quarantined for a human." }] };
    case "skipped": return { steps: [{ a: "Strategy", w: "Nothing to do — already paid or not yet due." }] };
    case "held": return { steps: [...base, { a: "Strategy", w: "Actionable later — backing off to respect contact limits." }] };
    case "awaiting_approval": return { steps: [...base, { a: "Drafting", w: "Wrote a first message." }, { a: "Compliance gate", w: "Clean — held for your approval.", ok: true }], message: `Hi ${i.debtor}, a friendly reminder that invoice ${i.id} for ${i.amount} is now past due. Settle it here: {{payment_link}}. Thanks!` };
    default: return { steps: [...base, { a: "Judgment · Gemini", w: "Confirmed the tone fits this age." }, { a: "Drafting", w: "Wrote a reminder in your voice." }, { a: "Compliance gate", w: "All rules cleared — safe to send.", ok: true }, { a: "Sender", w: `Sent to ${i.debtor}.`, ok: true }], message: `Hi ${i.debtor}, a quick note that invoice ${i.id} for ${i.amount} is now ${i.overdue} past due. A late fee may apply per the agreed terms. Settle it here: {{payment_link}}.` };
  }
}

export default function InvoicesView() {
  const theme = useTheme() as AppTheme;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState<InvoiceRow | null>(null);

  const counts = useMemo(() => { const c: Record<string, number> = {}; invoices.forEach((i) => { c[i.outcome] = (c[i.outcome] ?? 0) + 1; }); return c; }, []);
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return invoices.filter((i) => (filter === "all" || i.outcome === filter) && (!query || i.id.toLowerCase().includes(query) || i.debtor.toLowerCase().includes(query)));
  }, [q, filter]);

  const av = (o: TerminalState) => ({ $fg: toneFg(tone(o), theme), $bg: toneBg(tone(o), theme) });
  const heat = (ovd: string) => { const d = days(ovd); if (d == null || d === 0) return theme.textMuted; if (d <= 14) return theme.status.sent.fg; if (d <= 30) return theme.status.awaiting_approval.fg; return theme.status.escalated.fg; };
  const init = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const det = sel ? buildTrace(sel) : null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <Title>Invoices</Title>
      <Sub>Every invoice, how the agent handled it, and what it'll do next — click a row for the full trace.</Sub>
      <Search placeholder="Search by invoice ID or debtor…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Chips>
        {["all", ...Object.keys(counts)].map((k) => (
          <Chip key={k} $on={filter === k} onClick={() => setFilter(k)}>{k === "all" ? "All" : LABEL[k as TerminalState]} {k === "all" ? invoices.length : counts[k]}</Chip>
        ))}
      </Chips>
      <Wrap>
        <HRow><span>Invoice</span><span>Debtor</span><span>Amount</span><span>Overdue</span><span>Type</span><span>Status</span><span>Next action</span></HRow>
        {rows.map((i) => {
          const na = nextAction(i);
          return (
            <TRow key={i.id} onClick={() => setSel(i)}>
              <Id>{i.id}</Id>
              <Who><Av {...av(i.outcome)}>{init(i.debtor)}</Av><Nm>{i.debtor}</Nm></Who>
              <Amt>{i.amount}</Amt>
              <Heat><span className="d" style={{ background: heat(i.overdue) }} />{i.overdue}</Heat>
              <span><Pill $fg={theme.textMuted} $bg={theme.surfaceAlt}>{i.b2b ? "B2B" : "Consumer"}</Pill></span>
              <span><Pill $fg={theme.status[i.outcome].fg} $bg={theme.status[i.outcome].bg}>{LABEL[i.outcome]}</Pill></span>
              <Next>
                <span className="next-text" style={{ color: toneFg(na.tone, theme) }}>{na.text}</span>
                <span className="next-acts">
                  <QA title="Pause" onClick={stop}>❙❙</QA>
                  <QA title="Escalate" onClick={stop}>⚑</QA>
                  <QA title="Snooze" onClick={stop}>☾</QA>
                </span>
              </Next>
            </TRow>
          );
        })}
      </Wrap>

      {sel && det && (
        <Overlay onClick={() => setSel(null)}>
          <Drawer onClick={stop}>
            <DHead>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <Av {...av(sel.outcome)} style={{ width: 38, height: 38, fontSize: 13 }}>{init(sel.debtor)}</Av>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{sel.debtor}</div>
                  <Id>{sel.id} · {sel.amount} · {sel.overdue} overdue · {sel.b2b ? "B2B" : "Consumer"}</Id>
                </div>
                <Pill $fg={theme.status[sel.outcome].fg} $bg={theme.status[sel.outcome].bg}>{LABEL[sel.outcome]}</Pill>
                <button onClick={() => setSel(null)} style={{ marginLeft: 6, background: "none", border: "none", color: theme.textMuted, fontSize: 20, cursor: "pointer" }}>×</button>
              </div>
            </DHead>
            <DBody>
              <Cap style={{ marginTop: 0, color: theme.accent }}>What's next</Cap>
              <WhatsNext>
                <div style={{ fontSize: 13.5 }}>{whatsNext(sel)}</div>
                <Steer>
                  <SBtn onClick={stop}>❙❙ Pause chase</SBtn>
                  <SBtn onClick={stop}>⚙ Change tone</SBtn>
                  <SBtn onClick={stop}>✋ Take over</SBtn>
                </Steer>
              </WhatsNext>
              {det.message && (<><Cap>{sel.outcome === "awaiting_approval" ? "Drafted message" : "The message that went out"}</Cap><Msg>{det.message}</Msg></>)}
              <Cap>Decision trace</Cap>
              <TL>
                {det.steps.map((s, idx) => (
                  <Hop key={idx} $last={idx === det.steps.length - 1} $c={s.ok ? theme.status.sent.fg : theme.accent}>
                    <div className="a">{s.a}</div><div className="w">{s.w}</div>
                  </Hop>
                ))}
              </TL>
            </DBody>
          </Drawer>
        </Overlay>
      )}
    </>
  );
}
