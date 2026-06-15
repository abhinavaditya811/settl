"use client";

import styled from "styled-components";
import type { InvoiceCard } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { StateBadge, StatusTag } from "./Badge";

const Wrap = styled.div`
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 14px;
  overflow: hidden;
  background: ${({ theme }) => theme.surface};
  box-shadow: ${({ theme }) => theme.shadow};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;

  thead th {
    text-align: left;
    padding: 12px 16px;
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${({ theme }) => theme.textMuted};
    background: ${({ theme }) => theme.surfaceAlt};
    border-bottom: 1px solid ${({ theme }) => theme.border};
  }
  td {
    padding: 13px 16px;
    border-bottom: 1px solid ${({ theme }) => theme.border};
    vertical-align: middle;
  }
  tbody tr:last-child td {
    border-bottom: none;
  }
  tbody tr {
    cursor: pointer;
    transition: background 0.12s ease;
  }
  tbody tr:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
  .id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 600;
  }
  .amt {
    font-weight: 600;
    white-space: nowrap;
  }
  .ovd {
    color: ${({ theme }) => theme.textMuted};
    white-space: nowrap;
  }
`;

const Right = styled.td`
  text-align: right;
`;

export default function InvoiceTable({
  cards,
  onSelect,
}: {
  cards: InvoiceCard[];
  onSelect: (id: string) => void;
}) {
  return (
    <Wrap>
        <Table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Debtor</th>
              <th>Amount</th>
              <th>Overdue</th>
              <th>Type</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.invoice_id} onClick={() => onSelect(c.invoice_id)}>
                <td className="id">{c.invoice_id}</td>
                <td>{c.debtor_name}</td>
                <td className="amt">{formatMoney(c.amount_due, c.currency)}</td>
                <td className="ovd">
                  {c.days_overdue > 0 ? `${c.days_overdue}d` : "—"}
                </td>
                <td>
                  <StatusTag label={c.is_b2b ? "B2B" : "Consumer"} />
                </td>
                <td>
                  <StatusTag label={c.status} />
                </td>
                <Right>
                  <StateBadge state={c.terminal_state} />
                </Right>
              </tr>
            ))}
          </tbody>
        </Table>
    </Wrap>
  );
}
