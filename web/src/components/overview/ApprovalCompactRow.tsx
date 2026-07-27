"use client";

// Collapsed queue row — expands in place (list order never reshuffles).

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { InvoiceCard } from "@/lib/types";
import { formatMoney, overdueLabel } from "@/lib/format";

const CHANNEL: Record<string, string> = { email: "Email", sms: "SMS", voice: "Voice" };

const Row = styled.button`
  width: 100%;
  display: grid;
  grid-template-columns: 36px minmax(0, 1.4fr) auto auto auto;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
  &:hover {
    border-color: ${({ theme }) => theme.textMuted}66;
    background: ${({ theme }) => theme.surfaceAlt};
    transform: translateY(-1px);
  }
  @media (max-width: 720px) {
    grid-template-columns: 32px minmax(0, 1fr) auto;
    gap: 8px 12px;
  }
`;

const Rank = styled.span`
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-family: var(--font-display, inherit);
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.textMuted};
  background: ${({ theme }) => theme.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.border};
`;

const Name = styled.div`
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: -0.015em;
  .sub {
    margin-top: 3px;
    font-size: 12.5px;
    font-weight: 500;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Amt = styled.span`
  font-family: var(--font-display, inherit);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  white-space: nowrap;
`;

const Meta = styled.span`
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ theme }) => theme.textMuted};
  white-space: nowrap;
  @media (max-width: 720px) {
    display: none;
  }
`;

const Open = styled.span`
  font-size: 12.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.accent};
  white-space: nowrap;
`;

function urgencyColor(theme: AppTheme, days: number): string {
  if (days >= 15) return theme.status.escalated.fg;
  if (days >= 8) return theme.status.awaiting_approval.fg;
  return theme.status.held.fg;
}

export default function ApprovalCompactRow({
  invoice,
  rank,
  onOpen,
}: {
  invoice: InvoiceCard;
  rank: number;
  onOpen: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const ch = invoice.channel ?? "email";
  return (
    <Row type="button" onClick={onOpen}>
      <Rank>{rank}</Rank>
      <Name>
        {invoice.debtor_name}
        <div className="sub">
          {invoice.invoice_id} · {CHANNEL[ch] ?? ch}
        </div>
      </Name>
      <Amt>{formatMoney(invoice.amount_due, invoice.currency)}</Amt>
      <Meta style={{ color: urgencyColor(theme, invoice.days_overdue) }}>
        {overdueLabel(invoice.days_overdue)}
      </Meta>
      <Open>Review →</Open>
    </Row>
  );
}
