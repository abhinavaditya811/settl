"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import type { InvoiceCard } from "@/lib/types";
import { formatMoney, overdueLabel } from "@/lib/format";
import { Card } from "@/components/ui";
import { StatusTag } from "@/components/Badge";

const Box = styled(Card)`
  padding: 18px 20px;
  border-top: 3px solid ${({ theme }) => theme.status.awaiting_approval.fg};
`;

const Head = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 13px;
  .who {
    font-size: 15.5px;
    font-weight: 700;
  }
  .id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: ${({ theme }) => theme.textMuted};
    margin-top: 2px;
  }
  .tags {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
`;

const Draft = styled.textarea`
  width: 100%;
  min-height: 96px;
  resize: vertical;
  padding: 13px 14px;
  border-radius: 11px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surfaceAlt};
  color: ${({ theme }) => theme.text};
  font: inherit;
  font-size: 13.5px;
  line-height: 1.6;
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.accent};
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 13px;
  .note {
    font-size: 12px;
    color: ${({ theme }) => theme.status.awaiting_approval.fg};
  }
  .reset {
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.textMuted};
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
  }
`;

const Approve = styled.button`
  margin-left: auto;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ theme }) => theme.accentText};
  background: ${({ theme }) => theme.accent};
  &:hover {
    opacity: 0.92;
  }
  &:disabled {
    opacity: 0.55;
    cursor: progress;
  }
`;

interface Props {
  card: InvoiceCard;
  message: string | undefined;
  approvingId: string | null;
  onApprove: (id: string, message?: string) => void;
}

export default function ApprovalItem({ card, message, approvingId, onApprove }: Props) {
  const [text, setText] = useState(message ?? "");
  useEffect(() => setText(message ?? ""), [message]);

  const original = message ?? "";
  const dirty = text.trim() !== original.trim();
  const busy = approvingId === card.invoice_id;
  const loading = message === undefined;

  return (
    <Box>
      <Head>
        <div>
          <div className="who">{card.debtor_name}</div>
          <div className="id">{card.invoice_id}</div>
        </div>
        <div className="tags">
          <StatusTag label={formatMoney(card.amount_due, card.currency)} />
          <StatusTag label={overdueLabel(card.days_overdue)} />
          {card.channel && <StatusTag label={card.channel} />}
        </div>
      </Head>

      <Draft
        value={loading ? "Loading the drafted message…" : text}
        disabled={loading || busy}
        onChange={(e) => setText(e.target.value)}
        spellCheck
      />

      <Footer>
        {dirty && <span className="note">Edited — the gate re-checks it on send</span>}
        {dirty && (
          <button className="reset" onClick={() => setText(original)}>
            Reset to AI draft
          </button>
        )}
        <Approve
          disabled={busy || loading}
          onClick={() => onApprove(card.invoice_id, dirty ? text : undefined)}
        >
          {busy ? "Sending…" : "Approve & Send"}
        </Approve>
      </Footer>
    </Box>
  );
}
