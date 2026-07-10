"use client";

// Redesigned Approvals tab (preview, mock data): each held first-contact draft is
// shown as the real message it will become (email frame or SMS bubble), with the
// agent's reasoning and compliance signals. Inline edit; approve / skip / snooze
// shrink the queue.

import { useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { approvals, type Approval } from "./previewData";

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
  &:hover { filter: brightness(1.04); background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surfaceAlt)}; }
`;
const Hint = styled.span`font-size: 11.5px; color: ${({ theme }) => theme.textMuted};`;
const Done = styled.div`text-align: center; padding: 48px 0; color: ${({ theme }) => theme.textMuted}; font-size: 14px;`;

function slug(name: string) { return "billing@" + name.toLowerCase().replace(/[^a-z]/g, "") + ".com"; }

function Item({ a, onAct }: { a: Approval; onAct: (id: string) => void }) {
  const theme = useTheme() as AppTheme;
  const [text, setText] = useState(a.draft);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const dirty = text.trim() !== a.draft.trim();
  const isEmail = a.channel === "email";

  const startEdit = () => { setEditing(true); setTimeout(() => ref.current?.focus(), 0); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setEditing(false); }
    if (e.key === "Escape") { setText(a.draft); setEditing(false); }
  };

  const message = editing ? (
    <Editor ref={ref} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} spellCheck />
  ) : isEmail ? (
    <Email>
      <EHead>to {slug(a.name)} · <span style={{ color: theme.textMuted }}>Invoice — a friendly reminder</span></EHead>
      <Body>{text}{"\n"}<Pay>Pay {a.amount} ↗</Pay></Body>
    </Email>
  ) : (
    <Bubble>{text}</Bubble>
  );

  return (
    <Card>
      <Top>
        <Avatar>{a.initials}</Avatar>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{a.name}</div>
          <div style={{ fontSize: 12.5, color: theme.textMuted }}>first contact · {a.channel}</div>
        </div>
        <Tag>{a.amount}</Tag>
        <Tag $warn>{a.overdue}</Tag>
      </Top>

      {message}

      <Why>
        <span style={{ color: theme.accent, fontWeight: 700 }}>✦</span>
        Settl chose a <b>{isEmail ? "friendly" : "short SMS"}</b> tone — first message.
      </Why>
      <Chips>
        <Chip $ok>✓ compliance gate passed</Chip>
        <Chip $ok>✓ B2B</Chip>
        {isEmail && <Chip>payment link resolves on send</Chip>}
        {dirty && <Chip style={{ color: theme.status.awaiting_approval.fg, background: theme.status.awaiting_approval.bg }}>edited — gate re-checks on send</Chip>}
      </Chips>

      <Acts>
        <Btn $primary onClick={() => onAct(a.initials)}>Approve &amp; send</Btn>
        {editing
          ? <Btn onClick={() => setEditing(false)}>Done</Btn>
          : <Btn onClick={startEdit}>Edit</Btn>}
        <Btn onClick={() => onAct(a.initials)}>Skip</Btn>
        <Btn onClick={() => onAct(a.initials)}>Snooze</Btn>
        {editing && <Hint>Enter to save · Esc to cancel</Hint>}
      </Acts>
    </Card>
  );
}

export default function ApprovalsView() {
  const [items, setItems] = useState<Approval[]>(approvals);
  const act = (id: string) => setItems((xs) => xs.filter((x) => x.initials !== id));

  return (
    <>
      <QHead>
        <div>
          <Title>Approvals</Title>
          <Sub>{items.length} first {items.length === 1 ? "message" : "messages"} waiting · about 30 seconds to clear.</Sub>
        </div>
        {items.length > 0 && <Btn $primary onClick={() => setItems([])}>Approve all</Btn>}
      </QHead>
      {items.length === 0
        ? <Done>You’re all caught up — nothing is waiting for approval.</Done>
        : items.map((a) => <Item key={a.initials} a={a} onAct={act} />)}
    </>
  );
}
