"use client";

// Unified Needs-you inbox: first-touch, disputes, quarantine, plan signals.

import { useMemo, useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { InvoiceCard } from "@/lib/types";
import { STATE_META } from "@/lib/types";
import { useBoard } from "@/lib/BoardContext";
import { formatMoney, overdueLabel } from "@/lib/format";
import { needsYou } from "./invoiceNext";
import { goToInvoice } from "./focusInvoice";
import { Rise } from "./overviewChrome";
import {
  Empty,
  Filter,
  Filters,
  Head,
  Page,
  Search,
  Stack,
  Toolbar,
} from "./invoicesChrome";
import { useAutonomyLevel } from "./useAutonomy";

type Lane = "all" | "approve" | "dispute" | "quarantine" | "plan" | "other";

function laneOf(inv: InvoiceCard): Lane {
  if (inv.can_approve) return "approve";
  if (inv.terminal_state === "quarantined") return "quarantine";
  if (
    inv.terminal_state === "escalated" &&
    /payment.?plan/i.test(inv.detail ?? "")
  ) {
    return "plan";
  }
  if (inv.terminal_state === "escalated" || /disput/i.test(inv.detail ?? "")) {
    return "dispute";
  }
  if (inv.needs_human) return "other";
  return "other";
}

function laneLabel(l: Lane): string {
  switch (l) {
    case "approve":
      return "First send";
    case "dispute":
      return "Dispute";
    case "quarantine":
      return "Can't read";
    case "plan":
      return "Payment plan";
    case "other":
      return "Needs you";
    default:
      return "All";
  }
}

const Row = styled.button`
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) auto auto minmax(90px, 0.8fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
    border-color: ${({ theme }) => `${theme.textMuted}66`};
  }
  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr) auto;
  }
`;

const Name = styled.div`
  min-width: 0;
  .n {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.015em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    margin-top: 2px;
    font-size: 12px;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Amt = styled.span`
  font-family: var(--font-display, inherit);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
`;

const Meta = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.textMuted};
  white-space: nowrap;
  @media (max-width: 720px) {
    display: none;
  }
`;

const Lane = styled.span<{ $fg: string; $bg: string }>`
  font-size: 11.5px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  color: ${({ $fg }) => $fg};
  background: ${({ $bg }) => $bg};
  white-space: nowrap;
  @media (max-width: 720px) {
    display: none;
  }
`;

const Open = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.accent};
  white-space: nowrap;
`;

export default function InboxView() {
  const theme = useTheme() as AppTheme;
  const { board } = useBoard();
  const [level] = useAutonomyLevel();
  const [lane, setLane] = useState<Lane>("all");
  const [q, setQ] = useState("");

  const all = useMemo(() => {
    const list = (board?.invoices ?? []).filter((i) => needsYou(i) || i.can_approve);
    list.sort(
      (a, b) =>
        (Number(b.amount_due) || 0) * Math.max(1, b.days_overdue) -
        (Number(a.amount_due) || 0) * Math.max(1, a.days_overdue),
    );
    return list;
  }, [board]);

  const counts = useMemo(() => {
    const c: Record<Lane, number> = {
      all: all.length,
      approve: 0,
      dispute: 0,
      quarantine: 0,
      plan: 0,
      other: 0,
    };
    all.forEach((i) => {
      c[laneOf(i)] += 1;
    });
    return c;
  }, [all]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((i) => {
      if (lane !== "all" && laneOf(i) !== lane) return false;
      // Trusted / hands-off still show first sends, but default sort already risk-first.
      if (level === "handsoff" && lane === "all" && i.can_approve && counts.dispute + counts.plan + counts.quarantine > 0) {
        // Still include them; filter chips handle focus.
      }
      if (!query) return true;
      return (
        i.invoice_id.toLowerCase().includes(query) ||
        i.debtor_name.toLowerCase().includes(query) ||
        (i.detail ?? "").toLowerCase().includes(query)
      );
    });
  }, [all, lane, q, level, counts]);

  const openItem = (inv: InvoiceCard) => {
    if (inv.can_approve) {
      window.location.hash = "approvals";
      return;
    }
    goToInvoice(inv.invoice_id);
  };

  return (
    <Rise>
      <Page>
        <Head>
          <div>
            <h1>Inbox</h1>
            <p>
              Everything waiting on you: first sends, disputes, unreadable invoices,
              and payment plans.
            </p>
          </div>
        </Head>

        <Search
          placeholder="Search inbox…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <Toolbar>
          <Filters>
            {(
              [
                ["all", "All"],
                ["approve", "First send"],
                ["dispute", "Dispute"],
                ["plan", "Plans"],
                ["quarantine", "Can't read"],
              ] as const
            ).map(([key, label]) => (
              <Filter
                key={key}
                type="button"
                $on={lane === key}
                onClick={() => setLane(key)}
              >
                {label}
                {counts[key] > 0 ? ` · ${counts[key]}` : ""}
              </Filter>
            ))}
          </Filters>
        </Toolbar>

        {rows.length === 0 ? (
          <Empty>
            <div className="t">Inbox clear</div>
            <div className="s">
              {q.trim()
                ? "Nothing matches that search."
                : "No human work queued. New escalations and first contacts land here."}
            </div>
          </Empty>
        ) : (
          <Stack>
            {rows.map((inv) => {
              const l = laneOf(inv);
              const st = theme.status[inv.terminal_state];
              return (
                <Row key={inv.invoice_id} type="button" onClick={() => openItem(inv)}>
                  <Name>
                    <div className="n">{inv.debtor_name}</div>
                    <div className="sub">
                      {inv.invoice_id} · {STATE_META[inv.terminal_state].label}
                    </div>
                  </Name>
                  <Amt>{formatMoney(inv.amount_due, inv.currency)}</Amt>
                  <Meta>{overdueLabel(inv.days_overdue)}</Meta>
                  <Lane $fg={st.fg} $bg={st.bg}>
                    {laneLabel(l)}
                  </Lane>
                  <Open>{inv.can_approve ? "Review →" : "Open →"}</Open>
                </Row>
              );
            })}
          </Stack>
        )}
      </Page>
    </Rise>
  );
}
