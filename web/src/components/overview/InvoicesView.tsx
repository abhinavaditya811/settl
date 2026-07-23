"use client";

// Invoices tab: an "agent cockpit" - a dense table (invoice, debtor, amount,
// overdue+heat, type, status, the agent's next action) with a drawer showing
// what's next, real steering (via flag()), the real decision trace, and a real
// approve action. All data from useBoard()/getDetail()/getTrace().

import { useEffect, useMemo, useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { STATE_META, type InvoiceCard, type InvoiceDetail, type TerminalState, type TraceEntry } from "@/lib/types";
import { useBoard } from "@/lib/BoardContext";
import { getDetail, getTrace } from "@/lib/api";
import { formatMoney, overdueLabel } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import DecisionTrace from "@/components/DecisionTrace";
import PaymentPlanPanel from "@/components/PaymentPlanPanel";
import UploadCsvModal from "@/components/zero/UploadCsvModal";
import ManualEntryModal from "@/components/zero/ManualEntryModal";

function nextAction(o: TerminalState): { text: string; tone: TerminalState } {
  switch (o) {
    case "recovered": return { text: "Done · paid", tone: "sent" };
    case "awaiting_approval": return { text: "Waiting on your approval", tone: "awaiting_approval" };
    case "escalated": return { text: "You — debtor disputed", tone: "escalated" };
    case "held": return { text: "On hold — will resume automatically", tone: "held" };
    case "skipped": return { text: "No action — settled", tone: "skipped" };
    case "quarantined": return { text: "You — couldn't read it", tone: "quarantined" };
    default: return { text: "Chasing on schedule", tone: "sent" };
  }
}
function whatsNext(o: TerminalState): string {
  switch (o) {
    case "recovered": return "Paid — nothing more to do.";
    case "awaiting_approval": return "Held for your approval — approve to send the first message.";
    case "escalated": return "Routed to you — Settl won't act until you resolve it.";
    case "held": return "Settl will resume chasing automatically (respecting contact limits).";
    case "skipped": return "No outreach needed — already settled or not yet due.";
    case "quarantined": return "Settl couldn't read this invoice — needs a human to check.";
    default: return "Settl is chasing this invoice on schedule.";
  }
}

const Head = styled.div`display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;`;
const Title = styled.h1`font-size: 22px; font-weight: 700; margin: 0;`;
const Sub = styled.p`font-size: 13.5px; color: ${({ theme }) => theme.textMuted}; margin: 4px 0 16px;`;
const HeadBtns = styled.div`display: flex; gap: 8px; flex-shrink: 0; margin-top: 2px;`;
const AddBtn = styled.button<{ $primary?: boolean }>`
  font-size: 12.5px; padding: 7px 13px; border-radius: 9px; cursor: pointer; white-space: nowrap;
  border: 1px solid ${({ theme, $primary }) => ($primary ? theme.accent : theme.border)};
  background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surface)};
  color: ${({ theme, $primary }) => ($primary ? theme.accentText : theme.text)};
  &:hover { opacity: 0.92; }
`;
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
const DFooter = styled.div`padding: 14px 22px; border-top: 1px solid ${({ theme }) => theme.border};`;
const Cap = styled.div`font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: ${({ theme }) => theme.textMuted}; font-weight: 700; margin: 16px 0 10px;`;
const WhatsNext = styled.div`border: 1px solid ${({ theme }) => theme.accent}; background: ${({ theme }) => theme.surfaceAlt}; border-radius: 11px; padding: 13px 15px;`;
const Steer = styled.div`display: flex; gap: 8px; flex-wrap: wrap; margin-top: 11px;`;
const SBtn = styled.button`font-size: 12.5px; padding: 7px 12px; border-radius: 8px; border: 1px solid ${({ theme }) => theme.border}; background: ${({ theme }) => theme.surface}; color: ${({ theme }) => theme.text}; cursor: pointer; &:hover:not(:disabled) { background: ${({ theme }) => theme.surfaceAlt}; } &:disabled { opacity: 0.5; cursor: progress; }`;
const Msg = styled.div`border: 1px solid ${({ theme }) => theme.border}; border-radius: 11px; background: ${({ theme }) => theme.surface}; padding: 13px 15px; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap;`;
const Approve = styled.button`
  width: 100%; padding: 11px; border-radius: 10px; border: none; cursor: pointer;
  font-size: 13.5px; font-weight: 700;
  background: ${({ theme }) => theme.accent}; color: ${({ theme }) => theme.accentText};
  &:hover:not(:disabled) { filter: brightness(1.05); }
  &:disabled { opacity: 0.55; cursor: progress; }
`;

function heatColor(days: number, theme: AppTheme): string {
  if (days <= 0) return theme.textMuted;
  if (days <= 14) return theme.status.sent.fg;
  if (days <= 30) return theme.status.awaiting_approval.fg;
  return theme.status.escalated.fg;
}
function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("");
}

export default function InvoicesView() {
  const theme = useTheme() as AppTheme;
  const { board, approve, flag, flaggingId, approvingId, refresh } = useBoard();
  const invoices = board?.invoices ?? [];
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<TerminalState | "all">("all");
  const [sel, setSel] = useState<InvoiceCard | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [modal, setModal] = useState<"csv" | "manual" | null>(null);

  const addButtons = (
    <HeadBtns>
      <AddBtn onClick={() => setModal("csv")}>Upload CSV</AddBtn>
      <AddBtn $primary onClick={() => setModal("manual")}>Add invoice</AddBtn>
    </HeadBtns>
  );
  const addModals = (
    <>
      {modal === "csv" && (
        <UploadCsvModal onClose={() => setModal(null)} onImported={() => { setModal(null); refresh(); }} />
      )}
      {modal === "manual" && (
        <ManualEntryModal onClose={() => setModal(null)} onAdded={() => { setModal(null); refresh(); }} />
      )}
    </>
  );

  const counts = useMemo(() => {
    const c: Partial<Record<TerminalState, number>> = {};
    invoices.forEach((i) => { c[i.terminal_state] = (c[i.terminal_state] ?? 0) + 1; });
    return c;
  }, [invoices]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return invoices.filter(
      (i) =>
        (filter === "all" || i.terminal_state === filter) &&
        (!query || i.invoice_id.toLowerCase().includes(query) || i.debtor_name.toLowerCase().includes(query)),
    );
  }, [invoices, q, filter]);

  useEffect(() => {
    if (!sel) { setDetail(null); setTrace([]); return; }
    let active = true;
    Promise.all([getDetail(sel.invoice_id), getTrace(sel.invoice_id)]).then(([d, t]) => {
      if (!active) return;
      setDetail(d);
      setTrace(t);
    });
    return () => {
      active = false;
    };
  }, [sel]);

  const av = (o: TerminalState) => ({ $fg: theme.status[o].fg, $bg: theme.status[o].bg });
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (invoices.length === 0) {
    return (
      <>
        <Head>
          <div>
            <Title>Invoices</Title>
            <Sub>Every invoice, how the agent handled it, and what it&rsquo;ll do next.</Sub>
          </div>
          {addButtons}
        </Head>
        <EmptyState text="No invoices yet." />
        {addModals}
      </>
    );
  }

  return (
    <>
      <Head>
        <div>
          <Title>Invoices</Title>
          <Sub>Every invoice, how the agent handled it, and what it&rsquo;ll do next — click a row for the full trace.</Sub>
        </div>
        {addButtons}
      </Head>
      <Search placeholder="Search by invoice ID or debtor…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Chips>
        <Chip $on={filter === "all"} onClick={() => setFilter("all")}>All {invoices.length}</Chip>
        {(Object.keys(counts) as TerminalState[]).map((k) => (
          <Chip key={k} $on={filter === k} onClick={() => setFilter(k)}>{STATE_META[k].label} {counts[k]}</Chip>
        ))}
      </Chips>
      <Wrap>
        <HRow><span>Invoice</span><span>Debtor</span><span>Amount</span><span>Overdue</span><span>Type</span><span>Status</span><span>Next action</span></HRow>
        {rows.map((i) => {
          const na = nextAction(i.terminal_state);
          return (
            <TRow key={i.invoice_id} onClick={() => setSel(i)}>
              <Id>{i.invoice_id}</Id>
              <Who><Av {...av(i.terminal_state)}>{initials(i.debtor_name)}</Av><Nm>{i.debtor_name}</Nm></Who>
              <Amt>{formatMoney(i.amount_due, i.currency)}</Amt>
              <Heat><span className="d" style={{ background: heatColor(i.days_overdue, theme) }} />{overdueLabel(i.days_overdue)}</Heat>
              <span><Pill $fg={theme.textMuted} $bg={theme.surfaceAlt}>{i.is_b2b ? "B2B" : "Consumer"}</Pill></span>
              <span><Pill {...av(i.terminal_state)}>{STATE_META[i.terminal_state].label}</Pill></span>
              <Next>
                <span className="next-text" style={{ color: theme.status[na.tone].fg }}>{na.text}</span>
                <span className="next-acts">
                  <QA title="Flag this decision" onClick={(e) => { stop(e); setSel(i); }}>⚑</QA>
                </span>
              </Next>
            </TRow>
          );
        })}
      </Wrap>

      {sel && (
        <Overlay onClick={() => setSel(null)}>
          <Drawer onClick={stop}>
            <DHead>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <Av {...av(sel.terminal_state)} style={{ width: 38, height: 38, fontSize: 13 }}>{initials(sel.debtor_name)}</Av>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{sel.debtor_name}</div>
                  <Id>{sel.invoice_id} · {formatMoney(sel.amount_due, sel.currency)} · {overdueLabel(sel.days_overdue)} · {sel.is_b2b ? "B2B" : "Consumer"}</Id>
                </div>
                <Pill {...av(sel.terminal_state)}>{STATE_META[sel.terminal_state].label}</Pill>
                <button onClick={() => setSel(null)} style={{ marginLeft: 6, background: "none", border: "none", color: theme.textMuted, fontSize: 20, cursor: "pointer" }}>×</button>
              </div>
            </DHead>
            <DBody>
              <Cap style={{ marginTop: 0, color: theme.accent }}>What&rsquo;s next</Cap>
              <WhatsNext>
                <div style={{ fontSize: 13.5 }}>{whatsNext(sel.terminal_state)}</div>
                <Steer>
                  <SBtn disabled={flaggingId === sel.invoice_id} onClick={() => flag(sel.invoice_id, { scope: "strategy", directive: "force_hold" })}>❙❙ Pause chase</SBtn>
                  <SBtn disabled={flaggingId === sel.invoice_id} onClick={() => flag(sel.invoice_id, { scope: "strategy", directive: "soften_tone" })}>⚙ Change tone</SBtn>
                </Steer>
              </WhatsNext>
              {detail?.message_preview && (
                <>
                  <Cap>{sel.terminal_state === "awaiting_approval" ? "Drafted message" : "The message"}</Cap>
                  <Msg>{detail.message_preview}</Msg>
                </>
              )}
              {detail && <PaymentPlanPanel invoiceId={sel.invoice_id} steps={detail.steps} />}
              <Cap>Decision trace</Cap>
              {trace.length === 0 ? (
                <div style={{ fontSize: 13, color: theme.textMuted }}>Loading…</div>
              ) : (
                <DecisionTrace trace={trace} />
              )}
            </DBody>
            {detail?.can_approve && (
              <DFooter>
                <Approve disabled={approvingId === sel.invoice_id} onClick={() => approve(sel.invoice_id)}>
                  {approvingId === sel.invoice_id ? "Sending…" : "Approve & send"}
                </Approve>
              </DFooter>
            )}
          </Drawer>
        </Overlay>
      )}
      {addModals}
    </>
  );
}
