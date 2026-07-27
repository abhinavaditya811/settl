"use client";

// One held first-contact draft: evidence pack, preview, edit, approve / skip / hold.

import { useEffect, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { InvoiceCard, InvoiceDetail } from "@/lib/types";
import { formatMoney, overdueLabel } from "@/lib/format";
import { approvalEvidence } from "./approvalEvidence";
import ApprovalDiff from "./ApprovalDiff";
import {
  sendChannelLabel,
  sendDestination,
  sendTone,
} from "./approvalSendMeta";
import { ApprovalEditor, ApprovalMessage, PlayScript } from "./ApprovalPreview";

const Card = styled.article`
  position: relative;
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => `${theme.status.awaiting_approval.fg}55`};
  border-radius: 18px;
  padding: 20px 22px;
  overflow: hidden;
  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${({ theme }) => theme.status.awaiting_approval.fg};
  }
`;

const Top = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
`;

const Who = styled.div`
  min-width: 0;
  .tag {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.status.awaiting_approval.fg};
  }
  .name {
    margin-top: 4px;
    font-family: var(--font-display, inherit);
    font-size: clamp(20px, 2.2vw, 24px);
    font-weight: 600;
    letter-spacing: -0.035em;
    line-height: 1.15;
  }
  .meta {
    margin-top: 5px;
    font-size: 13px;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Facts = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.text};
  background: ${({ theme }) => theme.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.border};
`;

const Inv = styled.span`
  font-family: var(--font-display, inherit);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  padding: 6px 10px;
  border-radius: 8px;
  background: ${({ theme }) => theme.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.border};
`;

const SendStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.bg};
  font-size: 13.5px;
  line-height: 1.4;
  color: ${({ theme }) => theme.textMuted};
  .label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.textMuted};
  }
  b {
    font-weight: 600;
    color: ${({ theme }) => theme.text};
  }
`;

const Evidence = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 14px;
`;

const Chip = styled.span<{ $tone?: "ok" | "warn" | "muted" }>`
  font-size: 12px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 999px;
  color: ${({ theme, $tone }) =>
    $tone === "ok"
      ? theme.status.sent.fg
      : $tone === "warn"
        ? theme.status.awaiting_approval.fg
        : theme.textMuted};
  background: ${({ theme, $tone }) =>
    $tone === "ok"
      ? theme.status.sent.bg
      : $tone === "warn"
        ? theme.status.awaiting_approval.bg
        : theme.surfaceAlt};
`;

const Acts = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
  position: sticky;
  bottom: 0;
  padding-top: 4px;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  font-size: 13.5px;
  font-weight: ${({ $primary }) => ($primary ? 700 : 600)};
  padding: 9px 14px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid
    ${({ theme, $primary }) => ($primary ? "transparent" : theme.border)};
  background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surface)};
  color: ${({ theme, $primary }) => ($primary ? theme.accentText : theme.text)};
  &:hover:not(:disabled) {
    filter: brightness(1.04);
  }
  &:disabled {
    opacity: 0.55;
    cursor: progress;
  }
  kbd {
    margin-left: 6px;
    font-size: 11px;
    font-weight: 700;
    opacity: 0.75;
  }
`;

const Hint = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.textMuted};
`;

function urgencyColor(theme: AppTheme, days: number): string {
  if (days >= 15) return theme.status.escalated.fg;
  if (days >= 8) return theme.status.awaiting_approval.fg;
  return theme.status.held.fg;
}

export interface ApprovalCardProps {
  invoice: InvoiceCard;
  detail: InvoiceDetail | undefined;
  busy: boolean;
  requestEdit?: number;
  onApprove: (id: string, message?: string) => void;
  onSkip: (id: string) => void;
  onHold: (id: string) => void;
}

export default function ApprovalCard({
  invoice,
  detail,
  busy,
  requestEdit,
  onApprove,
  onSkip,
  onHold,
}: ApprovalCardProps) {
  const theme = useTheme() as AppTheme;
  const draft = detail?.message ?? "";
  const preview = detail?.message_preview ?? draft;
  const [text, setText] = useState(draft);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const dirty = text.trim() !== draft.trim();
  const channel = invoice.channel ?? "email";
  const evidence = approvalEvidence(detail);
  const tone = sendTone(detail);
  const destination = sendDestination(channel, invoice.debtor_name, preview || draft);

  useEffect(() => {
    if (!editing) setText(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => {
    if (!requestEdit) return;
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  }, [requestEdit]);

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setEditing(false);
    }
    if (e.key === "Escape") {
      setText(draft);
      setEditing(false);
    }
  };

  return (
    <Card>
      <Top>
        <Who>
          <div className="tag">Reviewing</div>
          <div className="name">{invoice.debtor_name}</div>
          <div className="meta">First contact · won&rsquo;t send without you</div>
        </Who>
        <Facts>
          <Inv>{invoice.invoice_id}</Inv>
          <Pill>{formatMoney(invoice.amount_due, invoice.currency)}</Pill>
          <Pill style={{ color: urgencyColor(theme, invoice.days_overdue) }}>
            {overdueLabel(invoice.days_overdue)}
          </Pill>
        </Facts>
      </Top>

      <SendStrip>
        <span className="label">Will send</span>
        <span>
          via <b>{sendChannelLabel(channel)}</b> to <b>{destination}</b>
          {tone ? (
            <>
              {" "}
              · <b>{tone}</b>
            </>
          ) : null}
        </span>
      </SendStrip>

      {(evidence.length > 0 || dirty) && (
        <Evidence>
          {evidence.map((e) => (
            <Chip key={e} $tone={/compliance|b2b/i.test(e) ? "ok" : "muted"}>
              {e}
            </Chip>
          ))}
          {dirty && <Chip $tone="warn">Edited · gate re-checks on send</Chip>}
        </Evidence>
      )}

      {editing ? (
        <ApprovalEditor
          inputRef={ref}
          value={text}
          onChange={setText}
          onKeyDown={onKey}
        />
      ) : (
        <ApprovalMessage
          channel={channel}
          debtorName={invoice.debtor_name}
          preview={preview}
          amount={invoice.amount_due}
          currency={invoice.currency}
          loading={!detail}
        />
      )}

      {dirty && !editing && draft && (
        <ApprovalDiff original={draft} edited={text} />
      )}

      {channel === "voice" && detail && !editing && (
        <div style={{ marginTop: 10 }}>
          <PlayScript text={preview} />
        </div>
      )}

      <Acts>
        <Btn
          $primary
          disabled={busy || !detail}
          onClick={() => onApprove(invoice.invoice_id, dirty ? text : undefined)}
        >
          {busy ? "Sending…" : "Approve & send"}
          {!busy && <kbd>A</kbd>}
        </Btn>
        {editing ? (
          <Btn onClick={() => setEditing(false)}>Done editing</Btn>
        ) : (
          <Btn disabled={!detail} onClick={startEdit}>
            Edit <kbd>E</kbd>
          </Btn>
        )}
        <Btn disabled={busy} onClick={() => onSkip(invoice.invoice_id)}>
          Skip
        </Btn>
        <Btn disabled={busy} onClick={() => onHold(invoice.invoice_id)}>
          Hold
        </Btn>
        {editing && <Hint>Enter to save · Esc to cancel</Hint>}
      </Acts>
    </Card>
  );
}
