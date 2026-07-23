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
import type { PaymentPlanTemplateInput, PaymentPlanView, StepView } from "@/lib/types";
import { decidePaymentPlan, getPaymentPlan, offerPaymentPlan, reofferPaymentPlan } from "@/lib/api";
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

const Callout = styled.div<{ $tone: "ok" | "warn" }>`
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 9px;
  font-size: 12.5px;
  line-height: 1.5;
  border: 1px solid ${({ theme, $tone }) => ($tone === "ok" ? theme.status.sent.fg : theme.status.escalated.fg)}44;
  background: ${({ theme, $tone }) => ($tone === "ok" ? theme.status.sent.bg : theme.status.escalated.bg)};
  color: ${({ theme, $tone }) => ($tone === "ok" ? theme.status.sent.fg : theme.status.escalated.fg)};
  .label {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.04em;
    display: block;
    margin-bottom: 3px;
  }
  .said {
    color: ${({ theme }) => theme.text};
    font-style: italic;
  }
`;

const ReofferForm = styled.div`
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr 1.3fr;
  gap: 8px;
  input {
    font: inherit;
    font-size: 12.5px;
    padding: 7px 8px;
    border-radius: 7px;
    border: 1px solid ${({ theme }) => theme.border};
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    width: 100%;
  }
  label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: ${({ theme }) => theme.textMuted};
    margin-bottom: 3px;
  }
`;

const LinkBtn = styled.button`
  margin-top: 10px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.accent};
  cursor: pointer;
  text-decoration: underline;
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

const EMPTY_REOFFER: PaymentPlanTemplateInput = { installments: 3, period_days: 30, label: "" };

export default function PaymentPlanPanel({ invoiceId, steps }: { invoiceId: string; steps: StepView[] }) {
  const { notify } = useBoard();
  const [plan, setPlan] = useState<PaymentPlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showReoffer, setShowReoffer] = useState(false);
  const [reofferTerms, setReofferTerms] = useState<PaymentPlanTemplateInput>(EMPTY_REOFFER);

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

  const reoffer = async () => {
    setBusy(true);
    try {
      const p = await reofferPaymentPlan(invoiceId, reofferTerms);
      setPlan(p);
      setShowReoffer(false);
      notify({ tone: "ok", text: "New terms offered - waiting on your approval." });
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
          {plan.status === "proposed" && plan.negotiation_outcome === "wants_different_terms" && (
            <Callout $tone="warn">
              <span className="label">They asked for something different</span>
              {plan.requested_terms ? <span className="said">&ldquo;{plan.requested_terms}&rdquo;</span> : null}
            </Callout>
          )}
          {plan.status === "proposed" && plan.negotiation_outcome === "accepted" && (
            <Callout $tone="ok">
              <span className="label">They said these terms work</span>
            </Callout>
          )}

          {plan.status === "proposed" && (
            <>
              <Note>
                {plan.negotiation_outcome === "wants_different_terms"
                  ? "You can still approve the original terms below, or offer what they asked for instead."
                  : "Waiting on your decision - the debtor hasn't seen these terms yet."}
              </Note>
              <Actions>
                <Btn disabled={busy} onClick={() => decide(false)}>Reject</Btn>
                <Btn $primary disabled={busy} onClick={() => decide(true)}>Approve</Btn>
              </Actions>
              {plan.can_reoffer && !showReoffer && (
                <LinkBtn type="button" onClick={() => setShowReoffer(true)}>
                  Offer different terms instead
                </LinkBtn>
              )}
              {showReoffer && (
                <ReofferForm>
                  <div>
                    <label>Installments</label>
                    <input
                      type="number" min={1} max={24} value={reofferTerms.installments}
                      onChange={(e) => setReofferTerms((t) => ({ ...t, installments: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label>Days apart</label>
                    <input
                      type="number" min={1} max={365} value={reofferTerms.period_days}
                      onChange={(e) => setReofferTerms((t) => ({ ...t, period_days: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label>Label</label>
                    <input
                      type="text" placeholder="6 installments over 180 days" value={reofferTerms.label}
                      onChange={(e) => setReofferTerms((t) => ({ ...t, label: e.target.value }))}
                    />
                  </div>
                  <Actions style={{ gridColumn: "1 / -1" }}>
                    <Btn disabled={busy} onClick={() => setShowReoffer(false)}>Cancel</Btn>
                    <Btn $primary disabled={busy} onClick={reoffer}>
                      {busy ? "Offering…" : "Send new terms"}
                    </Btn>
                  </Actions>
                </ReofferForm>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
}
