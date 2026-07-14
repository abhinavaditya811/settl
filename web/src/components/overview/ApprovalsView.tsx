"use client";

// Approvals tab: each held first-contact draft shown as the real message it will
// become (email frame or SMS bubble), with real compliance signals. Inline edit;
// approve/skip/hold call the real engine actions - approve() re-runs the
// compliance gate server-side on send, flag() stores a real guardrail.

import { useEffect, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { InvoiceCard, InvoiceDetail } from "@/lib/types";
import { useBoard } from "@/lib/BoardContext";
import { getDetail } from "@/lib/api";
import { formatMoney, overdueLabel } from "@/lib/format";

const Title = styled.h1`font-size: 22px; font-weight: 700; margin: 0;`;
const Sub = styled.p`font-size: 13.5px; color: ${({ theme }) => theme.textMuted}; margin: 4px 0 0;`;
const QHead = styled.div`display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px;`;
const Card = styled.div`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-top: 2px solid ${({ theme }) => theme.accent};
  border-radius: 14px; padding: 16px 18px; margin-bottom: 14px;
`;
const Top = styled.div`display: flex; align-items: center; gap: 11px; margin-bottom: 12px;`;
const Avatar = styled.div`
  width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;
  color: ${({ theme }) => theme.status.awaiting_approval.fg};
  background: ${({ theme }) => theme.status.awaiting_approval.bg};
`;
const Tag = styled.span<{ $warn?: boolean }>`
  font-size: 12px; padding: 3px 9px; border-radius: 999px;
  color: ${({ theme, $warn }) => ($warn ? theme.status.awaiting_approval.fg : theme.textMuted)};
  background: ${({ theme, $warn }) => ($warn ? theme.status.awaiting_approval.bg : theme.surfaceAlt)};
`;
const Email = styled.div`border: 1px solid ${({ theme }) => theme.border}; border-radius: 11px; overflow: hidden; background: ${({ theme }) => theme.surfaceAlt};`;
const EHead = styled.div`padding: 9px 13px; border-bottom: 1px solid ${({ theme }) => theme.border}; font-size: 12px; color: ${({ theme }) => theme.textMuted};`;
const Body = styled.div`padding: 13px; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap;`;
const Bubble = styled.div`
  max-width: 80%; margin: 6px 0; padding: 11px 14px; font-size: 13.5px; line-height: 1.55;
  border-radius: 16px 16px 16px 5px;
  color: ${({ theme }) => theme.status.held.fg}; background: ${({ theme }) => theme.status.held.bg};
`;
const Editor = styled.textarea`
  width: 100%; min-height: 96px; resize: vertical; padding: 12px 14px;
  border-radius: 11px; border: 2px solid ${({ theme }) => theme.accent};
  background: ${({ theme }) => theme.surfaceAlt}; color: ${({ theme }) => theme.accent};
  font: inherit; font-size: 13.5px; line-height: 1.6; font-weight: 600;
  &:focus { outline: none; }
`;
const Pay = styled.span`display: inline-block; margin-top: 10px; padding: 8px 16px; border-radius: 8px; background: ${({ theme }) => theme.accent}; color: ${({ theme }) => theme.accentText}; font-size: 12.5px; font-weight: 700;`;
const Why = styled.div`display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12.5px; color: ${({ theme }) => theme.textMuted}; b { color: ${({ theme }) => theme.text}; font-weight: 700; }`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px;`;
const Chip = styled.span<{ $ok?: boolean }>`
  font-size: 12px; padding: 3px 10px; border-radius: 999px;
  color: ${({ theme, $ok }) => ($ok ? theme.status.sent.fg : theme.textMuted)};
  background: ${({ theme, $ok }) => ($ok ? theme.status.sent.bg : theme.surfaceAlt)};
`;
const Acts = styled.div`display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap;`;
const Btn = styled.button<{ $primary?: boolean }>`
  font-size: 13px; padding: 8px 15px; border-radius: 9px; cursor: pointer; font-weight: ${({ $primary }) => ($primary ? 700 : 400)};
  border: ${({ theme, $primary }) => ($primary ? "none" : `1px solid ${theme.border}`)};
  background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surface)};
  color: ${({ theme, $primary }) => ($primary ? theme.accentText : theme.text)};
  &:hover:not(:disabled) { filter: brightness(1.04); background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surfaceAlt)}; }
  &:disabled { opacity: 0.55; cursor: progress; }
`;
const Hint = styled.span`font-size: 11.5px; color: ${({ theme }) => theme.textMuted};`;
const Done = styled.div`text-align: center; padding: 48px 0; color: ${({ theme }) => theme.textMuted}; font-size: 14px;`;
const Loading = styled.div`padding: 16px 18px; font-size: 13.5px; color: ${({ theme }) => theme.textMuted};`;

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function PlayScript({ text }: { text: string }) {
  // Preview the call script with the browser's built-in voice (no backend, no
  // cost). The real call speaks via the engine's TTS provider; this is a preview.
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const toggle = () => {
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };
  return (
    <Btn onClick={toggle} aria-label={playing ? "Stop the call preview" : "Hear the call script"}>
      {playing ? "◼ Stop" : "▶ Play"}
    </Btn>
  );
}

interface ItemProps {
  invoice: InvoiceCard;
  detail: InvoiceDetail | undefined;
  busy: boolean;
  onApprove: (id: string, message?: string) => void;
  onSkip: (id: string) => void;
  onHold: (id: string) => void;
}

function Item({ invoice, detail, busy, onApprove, onSkip, onHold }: ItemProps) {
  const theme = useTheme() as AppTheme;
  const draft = detail?.message ?? "";
  const preview = detail?.message_preview ?? draft;
  const [text, setText] = useState(draft);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const dirty = text.trim() !== draft.trim();
  const channel = invoice.channel ?? "email";

  // The fetched draft can arrive after first render - adopt it once, don't clobber
  // an in-progress edit.
  useEffect(() => {
    if (!editing) setText(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const startEdit = () => { setEditing(true); setTimeout(() => ref.current?.focus(), 0); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setEditing(false); }
    if (e.key === "Escape") { setText(draft); setEditing(false); }
  };

  const message = !detail ? (
    <Loading>Loading draft…</Loading>
  ) : editing ? (
    <Editor ref={ref} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} spellCheck />
  ) : channel === "email" ? (
    <Email>
      <EHead>to {invoice.debtor_name} · <span style={{ color: theme.textMuted }}>Invoice — a friendly reminder</span></EHead>
      <Body>{preview}{"\n"}<Pay>Pay {formatMoney(invoice.amount_due, invoice.currency)} ↗</Pay></Body>
    </Email>
  ) : (
    <Bubble>{preview}</Bubble>
  );

  return (
    <Card>
      <Top>
        <Avatar>{invoice.channel === "voice" ? "📞" : initials(invoice.debtor_name)}</Avatar>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{invoice.debtor_name}</div>
          <div style={{ fontSize: 12.5, color: theme.textMuted }}>first contact · {channel}</div>
        </div>
        <Tag>{formatMoney(invoice.amount_due, invoice.currency)}</Tag>
        <Tag $warn>{overdueLabel(invoice.days_overdue)}</Tag>
      </Top>

      {message}

      {channel === "voice" && detail && (
        <div style={{ marginTop: 10 }}>
          <PlayScript text={preview} />
        </div>
      )}

      <Why>
        <span style={{ color: theme.accent, fontWeight: 700 }}>✦</span>
        First contact to this debtor — held for your one-tap approval.
      </Why>
      <Chips>
        <Chip $ok>✓ compliance gate passed</Chip>
        {invoice.is_b2b && <Chip $ok>✓ B2B</Chip>}
        {channel === "email" && <Chip>payment link resolves on send</Chip>}
        {dirty && <Chip style={{ color: theme.status.awaiting_approval.fg, background: theme.status.awaiting_approval.bg }}>edited — gate re-checks on send</Chip>}
      </Chips>

      <Acts>
        <Btn $primary disabled={busy || !detail} onClick={() => onApprove(invoice.invoice_id, dirty ? text : undefined)}>
          {busy ? "Sending…" : "Approve & send"}
        </Btn>
        {editing
          ? <Btn onClick={() => setEditing(false)}>Done</Btn>
          : <Btn disabled={!detail} onClick={startEdit}>Edit</Btn>}
        <Btn disabled={busy} onClick={() => onSkip(invoice.invoice_id)}>Skip</Btn>
        <Btn disabled={busy} onClick={() => onHold(invoice.invoice_id)}>Hold</Btn>
        {editing && <Hint>Enter to save · Esc to cancel</Hint>}
      </Acts>
    </Card>
  );
}

export default function ApprovalsView() {
  const { board, approve, flag, approvingId, flaggingId } = useBoard();
  const [details, setDetails] = useState<Record<string, InvoiceDetail>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const queued = (board?.invoices ?? []).filter((i) => i.can_approve);
  const queuedKey = queued.map((i) => i.invoice_id).join(",");

  useEffect(() => {
    if (!queuedKey) return;
    let active = true;
    Promise.all(
      queuedKey.split(",").map((id) => getDetail(id).then((d) => [id, d] as const)),
    ).then((pairs) => {
      if (!active) return;
      setDetails((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      active = false;
    };
  }, [queuedKey]);

  const approveAll = async () => {
    setBulkBusy(true);
    for (const inv of queued) {
      // eslint-disable-next-line no-await-in-loop
      await approve(inv.invoice_id);
    }
    setBulkBusy(false);
  };

  return (
    <>
      <QHead>
        <div>
          <Title>Approvals</Title>
          <Sub>{queued.length} first {queued.length === 1 ? "message" : "messages"} waiting.</Sub>
        </div>
        {queued.length > 1 && (
          <Btn $primary disabled={bulkBusy} onClick={approveAll}>
            {bulkBusy ? "Approving…" : "Approve all"}
          </Btn>
        )}
      </QHead>
      {queued.length === 0 ? (
        <Done>You’re all caught up — nothing is waiting for approval.</Done>
      ) : (
        queued.map((inv) => (
          <Item
            key={inv.invoice_id}
            invoice={inv}
            detail={details[inv.invoice_id]}
            busy={approvingId === inv.invoice_id || flaggingId === inv.invoice_id || bulkBusy}
            onApprove={(id, message) => approve(id, message)}
            onSkip={(id) => flag(id, { scope: "strategy", directive: "force_skip" })}
            onHold={(id) => flag(id, { scope: "strategy", directive: "force_hold" })}
          />
        ))
      )}
    </>
  );
}
