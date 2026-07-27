"use client";

// Active payment-plan monitor: proposed / active / broken across the book.

import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import type { InvoiceCard, PaymentPlanView } from "@/lib/types";
import { useBoard } from "@/lib/BoardContext";
import { getPaymentPlan } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { goToInvoice } from "./focusInvoice";
import { buildDemoPlans } from "./demoPlans";
import { Rise } from "./overviewChrome";
import { Empty, Head, Page, Stack } from "./invoicesChrome";

const Card = styled.button`
  width: 100%;
  text-align: left;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: inherit;
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
  }
  .name {
    font-size: 14.5px;
    font-weight: 600;
  }
  .amt {
    font-family: var(--font-display, inherit);
    font-weight: 600;
  }
  .meta {
    margin-top: 6px;
    font-size: 12.5px;
    color: ${({ theme }) => theme.textMuted};
  }
  .status {
    font-weight: 700;
    text-transform: capitalize;
    color: ${({ theme }) => theme.text};
  }
  .status[data-s="proposed"] {
    color: ${({ theme }) => theme.status.awaiting_approval.fg};
  }
  .status[data-s="active"] {
    color: ${({ theme }) => theme.status.recovered.fg};
  }
  .status[data-s="broken"] {
    color: ${({ theme }) => theme.status.escalated.fg};
  }
`;

function isPlanCandidate(inv: InvoiceCard): boolean {
  if (/payment.?plan/i.test(inv.detail ?? "")) return true;
  if (inv.terminal_state === "escalated" && inv.needs_human) return true;
  return false;
}

export default function PlansMonitorView() {
  const { board } = useBoard();
  const candidates = useMemo(
    () => (board?.invoices ?? []).filter(isPlanCandidate),
    [board],
  );
  const [plans, setPlans] = useState<
    { inv: InvoiceCard; plan: PaymentPlanView }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const fallback = () => buildDemoPlans(board?.invoices ?? []);
    if (candidates.length === 0) {
      setPlans(fallback());
      setLoading(false);
      return;
    }
    Promise.all(
      candidates.map(async (inv) => {
        const plan = await getPaymentPlan(inv.invoice_id);
        return plan ? { inv, plan } : null;
      }),
    )
      .then((rows) => {
        if (!active) return;
        const live = rows.filter(Boolean) as {
          inv: InvoiceCard;
          plan: PaymentPlanView;
        }[];
        // Demo / empty engine: seed sample proposed / active / broken rows.
        setPlans(live.length > 0 ? live : fallback());
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [candidates, board?.invoices]);

  return (
    <Rise>
      <Page>
        <Head>
          <div>
            <h1>Plans</h1>
            <p>
              Payment plans waiting on your decide, active schedules, and broken
              installs.
            </p>
          </div>
        </Head>

        {loading && plans.length === 0 ? (
          <Empty>
            <div className="t">Loading plans…</div>
            <div className="s">Checking escalated invoices for plan state.</div>
          </Empty>
        ) : plans.length === 0 ? (
          <Empty>
            <div className="t">No plans in flight</div>
            <div className="s">
              When a debtor asks for a plan, it shows up here for your approve or
              reject.
            </div>
          </Empty>
        ) : (
          <Stack>
            {plans.map(({ inv, plan }) => (
              <Card
                key={inv.invoice_id}
                type="button"
                onClick={() => goToInvoice(inv.invoice_id)}
              >
                <div className="top">
                  <span className="name">{inv.debtor_name}</span>
                  <span className="amt">
                    {formatMoney(inv.amount_due, inv.currency)}
                  </span>
                </div>
                <div className="meta">
                  <span className="status" data-s={plan.status}>
                    {plan.status}
                  </span>
                  {" · "}
                  {inv.invoice_id}
                  {" · "}
                  {plan.installments.length} installment
                  {plan.installments.length === 1 ? "" : "s"}
                  {plan.negotiation_outcome
                    ? ` · ${plan.negotiation_outcome.replace(/_/g, " ")}`
                    : ""}
                </div>
              </Card>
            ))}
          </Stack>
        )}
      </Page>
    </Rise>
  );
}
