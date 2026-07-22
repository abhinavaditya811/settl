"use client";

// The payment-plan action for one invoice, shown in the drawer. CLAUDE.md's
// compliance rule: a payment-plan request always escalates to a human first; the
// AI may only offer a vendor-preapproved template and gather non-binding terms,
// never confirm anything to the debtor without an explicit vendor approve/reject.
//
// Self-contained (same pattern as FlagForm/GuardrailsPanel): fetches its own plan,
// offers one, and lets the vendor decide - the engine remains the sole authority
// on outcome (offer_payment_plan/decide_payment_plan in state.py).

import { useEffect, useState } from "react";
import styled from "styled-components";
import type { PaymentPlanView, StepView } from "@/lib/types";
import { decidePaymentPlan, getPaymentPlan, offerPaymentPlan } from "@/lib/api";
import { useBoard } from "@/lib/BoardContext";

const Box = styled.div`
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surfaceAlt};
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  .t {
    font-size: 13px;
    font-weight: 700;
  }
`;

const StatusPill = styled.span<{ $tone: "pending" | "ok" | "bad" }>`
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 999px;
  color: ${({ theme, $tone }) =>
    $tone === "ok" ? theme.status.sent.fg : $tone === "bad" ? theme.status.escalated.fg : theme.textMuted};
  background: ${({ theme, $tone }) =>
    $tone === "ok" ? theme.status.sent.bg : $tone === "bad" ? theme.status.escalated.bg : theme.surface};
`;

const Rows = styled.ul`
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Row = styled.li`
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  .amt {
    font-weight: 600;
  }
  .due {
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  flex: 1;
  padding: 9px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid ${({ theme, $primary }) => ($primary ? theme.accent : theme.border)};
  color: ${({ theme, $primary }) => ($primary ? theme.accentText : theme.text)};
  background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surface)};
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: progress; }
`;

const Note = styled.p`
  margin: 8px 0 0;
  font-size: 12px;
  color: ${({ theme }) => theme.textMuted};
`;

// Only surface this panel when it's actually relevant: a plan already exists, or
// the debtor's latest reply asked for one (pipeline.py::handle_inbound tags this
// as inbound_classifier -> payment_plan_request). Keeps every other invoice's
// drawer free of a button that mostly wouldn't apply.
export function invoiceWantsAPaymentPlan(steps: StepView[]): boolean {
  return steps.some((s) => s.agent === "inbound_classifier" && s.decision === "payment_plan_request");
}

const STATUS_TONE: Record<PaymentPlanView["status"], "pending" | "ok" | "bad"> = {
  proposed: "pending",
  approved: "ok",
  active: "ok",
  completed: "ok",
  rejected: "bad",
  broken: "bad",
};

export default function PaymentPlanPanel({ invoiceId, steps }: { invoiceId: string; steps: StepView[] }) {
  const { notify } = useBoard();
  const [plan, setPlan] = useState<PaymentPlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPaymentPlan(invoiceId)
      .then((p) => active && setPlan(p))
      .catch((e) => active && notify({ tone: "err", text: String((e as Error).message ?? e) }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [invoiceId, notify]);

  const offer = async () => {
    setBusy(true);
    try {
      const p = await offerPaymentPlan(invoiceId);
      setPlan(p);
      notify({ tone: "ok", text: "Payment plan offered - waiting on your approval." });
    } catch (e) {
      notify({ tone: "err", text: String((e as Error).message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (approved: boolean) => {
    setBusy(true);
    try {
      const out = await decidePaymentPlan(invoiceId, approved);
      notify({
        tone: approved ? "ok" : "err",
        text: approved ? "Payment plan approved - the debtor will be notified." : "Payment plan rejected.",
      });
      const refreshed = await getPaymentPlan(invoiceId);
      setPlan(refreshed);
      void out;
    } catch (e) {
      notify({ tone: "err", text: String((e as Error).message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  // Nothing to show: no plan exists yet AND nothing in this invoice's history
  // asked for one - most invoices, so the drawer stays free of an inert panel.
  if (loading || (!plan && !invoiceWantsAPaymentPlan(steps))) return null;

  return (
    <Box>
      <Head>
        <span className="t">Payment plan</span>
        {plan && <StatusPill $tone={STATUS_TONE[plan.status]}>{plan.status}</StatusPill>}
      </Head>

      {!plan && (
        <>
          <Note>The debtor asked about a payment plan. Offer your pre-approved template - nothing is confirmed to them until you approve it.</Note>
          <Actions>
            <Btn $primary disabled={busy} onClick={offer}>
              {busy ? "Offering…" : "Offer a payment plan"}
            </Btn>
          </Actions>
        </>
      )}

      {plan && (
        <>
          <Rows>
            {plan.installments.map((inst) => (
              <Row key={inst.index}>
                <span className="amt">#{inst.index + 1} — {inst.amount}</span>
                <span className="due">{inst.paid_at ? "paid" : `due ${inst.due_date}`}</span>
              </Row>
            ))}
          </Rows>
          {plan.status === "proposed" && (
            <>
              <Note>Waiting on your decision - the debtor hasn&rsquo;t seen these terms yet.</Note>
              <Actions>
                <Btn disabled={busy} onClick={() => decide(false)}>Reject</Btn>
                <Btn $primary disabled={busy} onClick={() => decide(true)}>Approve</Btn>
              </Actions>
            </>
          )}
        </>
      )}
    </Box>
  );
}
