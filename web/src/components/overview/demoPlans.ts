// Synthetic plan rows for the demo board when the engine has no live plans yet.
// Keeps Plans monitor reviewable for YC / walkthroughs without seeding the API.

import type { InvoiceCard, PaymentPlanStatus, PaymentPlanView } from "@/lib/types";

const FALLBACK: InvoiceCard[] = [
  {
    invoice_id: "INV-014",
    debtor_name: "Northline Fabrication",
    amount_due: "4800.00",
    currency: "USD",
    days_overdue: 34,
    status: "open",
    is_b2b: true,
    channel: "email",
    payment_link: null,
    terminal_state: "escalated",
    detail: "Debtor asked for a payment plan",
    needs_human: true,
    can_approve: false,
  },
  {
    invoice_id: "INV-021",
    debtor_name: "Harbor Dental Group",
    amount_due: "2100.00",
    currency: "USD",
    days_overdue: 18,
    status: "open",
    is_b2b: true,
    channel: "email",
    payment_link: null,
    terminal_state: "awaiting_response",
    detail: "Payment plan active",
    needs_human: false,
    can_approve: false,
  },
  {
    invoice_id: "INV-008",
    debtor_name: "Cedar & Co. Studio",
    amount_due: "950.00",
    currency: "USD",
    days_overdue: 47,
    status: "open",
    is_b2b: true,
    channel: "sms",
    payment_link: null,
    terminal_state: "escalated",
    detail: "Payment plan installment missed",
    needs_human: true,
    can_approve: false,
  },
];

const STATUSES: {
  status: PaymentPlanStatus;
  outcome: PaymentPlanView["negotiation_outcome"];
  installs: number;
  source: PaymentPlanView["source"];
}[] = [
  { status: "proposed", outcome: null, installs: 3, source: "template" },
  { status: "active", outcome: "accepted", installs: 4, source: "negotiated" },
  { status: "broken", outcome: "accepted", installs: 3, source: "template" },
];

function planFor(inv: InvoiceCard, i: number): PaymentPlanView {
  const spec = STATUSES[i % STATUSES.length];
  const total = Number(inv.amount_due) || 1200;
  const each = (total / spec.installs).toFixed(2);
  const start = new Date();
  return {
    invoice_id: inv.invoice_id,
    status: spec.status,
    source: spec.source,
    template_ref: spec.source === "template" ? "3x30" : null,
    offer_count: spec.status === "proposed" ? 1 : 2,
    can_reoffer: spec.status === "broken",
    negotiation_outcome: spec.outcome,
    requested_terms: null,
    installments: Array.from({ length: spec.installs }, (_, idx) => {
      const due = new Date(start);
      due.setDate(due.getDate() + (idx + 1) * 30);
      return {
        index: idx + 1,
        amount: each,
        due_date: due.toISOString().slice(0, 10),
        payment_link: null,
        paid_at:
          spec.status === "active" && idx === 0
            ? start.toISOString()
            : null,
      };
    }),
  };
}

/** Prefer real board invoices so clicks land on known rows; fall back to fixtures. */
export function buildDemoPlans(
  invoices: InvoiceCard[],
): { inv: InvoiceCard; plan: PaymentPlanView }[] {
  const pool = invoices.length >= 3 ? invoices.slice(0, 3) : FALLBACK;
  return pool.map((inv, i) => ({ inv, plan: planFor(inv, i) }));
}
