"use client";

// Compact worklist row — one scan line, Approvals-density, detail lives in drawer.

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { InvoiceCard } from "@/lib/types";
import { formatMoney, overdueLabel } from "@/lib/format";
import {
  CHANNEL_LABEL,
  heatColor,
  initials,
  nextAction,
  truncateDetail,
} from "./invoiceNext";

const Row = styled.div<{ $focus?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) auto auto minmax(100px, 0.9fr) auto;
  gap: 12px 14px;
  align-items: center;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid
    ${({ theme, $focus }) => ($focus ? theme.accent : theme.border)};
  background: ${({ theme, $focus }) =>
    $focus ? theme.surfaceAlt : theme.surface};
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  &:hover {
    border-color: ${({ theme }) => `${theme.textMuted}66`};
    background: ${({ theme }) => theme.surfaceAlt};
  }
  &:hover .pause {
    opacity: 1;
    pointer-events: auto;
  }
  @media (max-width: 820px) {
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px 12px;
    .next,
    .open {
      display: none;
    }
  }
`;

const Who = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const Av = styled.div<{ $fg: string; $bg: string }>`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 700;
  color: ${({ $fg }) => $fg};
  background: ${({ $bg }) => $bg};
`;

const Name = styled.div`
  min-width: 0;
  .n {
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.015em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    margin-top: 2px;
    font-size: 12px;
    font-weight: 500;
    color: ${({ theme }) => theme.textMuted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Amt = styled.span`
  font-family: var(--font-display, inherit);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.02em;
  white-space: nowrap;
  text-align: right;
`;

const Heat = styled.span`
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-align: right;
  min-width: 5.5rem;
`;

const Next = styled.div`
  min-width: 0;
  .line {
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .note {
    margin-top: 2px;
    font-size: 11.5px;
    font-weight: 500;
    color: ${({ theme }) => theme.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const End = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
`;

const Open = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.accent};
  white-space: nowrap;
`;

const Pause = styled.button`
  font-size: 11.5px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 7px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.textMuted};
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.surfaceAlt};
  }
  &:disabled {
    opacity: 0.55;
    cursor: progress;
  }
  @media (hover: none) {
    opacity: 1;
    pointer-events: auto;
  }
`;

export default function InvoiceRow({
  invoice,
  focused,
  pausing,
  onOpen,
  onPause,
}: {
  invoice: InvoiceCard;
  focused: boolean;
  pausing: boolean;
  onOpen: () => void;
  onPause: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const na = nextAction(invoice.terminal_state);
  const st = theme.status[invoice.terminal_state];
  const ch = invoice.channel;
  const note = truncateDetail(invoice.detail ?? "", 36);
  const canPause =
    invoice.terminal_state === "sent" || invoice.terminal_state === "held";

  const subParts = [
    invoice.invoice_id,
    ch ? (CHANNEL_LABEL[ch] ?? ch) : null,
    invoice.is_b2b ? null : "Consumer",
  ].filter(Boolean);

  return (
    <Row
      $focus={focused}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <Who>
        <Av $fg={st.fg} $bg={st.bg}>
          {initials(invoice.debtor_name)}
        </Av>
        <Name>
          <div className="n">{invoice.debtor_name}</div>
          <div className="sub">{subParts.join(" · ")}</div>
        </Name>
      </Who>

      <Amt>{formatMoney(invoice.amount_due, invoice.currency)}</Amt>

      <Heat style={{ color: heatColor(invoice.days_overdue, theme) }}>
        {overdueLabel(invoice.days_overdue)}
      </Heat>

      <Next className="next">
        <div className="line" style={{ color: theme.status[na.tone].fg }}>
          {na.text}
        </div>
        {note && <div className="note">{note}</div>}
      </Next>

      <End className="open" onClick={(e) => e.stopPropagation()}>
        {canPause && (
          <Pause
            className="pause"
            type="button"
            disabled={pausing}
            onClick={onPause}
          >
            {pausing ? "…" : "Pause"}
          </Pause>
        )}
        <Open onClick={onOpen}>Open</Open>
      </End>
    </Row>
  );
}
