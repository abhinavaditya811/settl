// TS mirror of the FastAPI engine's JSON contract (src/settl/api/schemas.py).

export type TerminalState =
  | "sent"
  | "recovered"
  | "awaiting_approval"
  | "escalated"
  | "skipped"
  | "held"
  | "quarantined";

export interface InvoiceCard {
  invoice_id: string;
  debtor_name: string;
  amount_due: string;
  currency: string;
  days_overdue: number;
  status: string; // open | paid | partial | disputed
  is_b2b: boolean;
  channel: string | null;
  payment_link: string | null;
  terminal_state: TerminalState;
  detail: string;
  needs_human: boolean;
  can_approve: boolean;
}

export interface StepView {
  agent: string;
  decision: string;
  reasoning: string;
}

export interface InvoiceDetail extends InvoiceCard {
  message: string | null;
  message_preview: string | null; // message with {{payment_link}} resolved (read-only)
  steps: StepView[];
}

export interface TraceEntry {
  timestamp: string;
  agent: string;
  decision: string;
  reasoning: string;
  details: Record<string, unknown>;
}

export interface BoardSummary {
  total: number;
  counts: Partial<Record<TerminalState, number>>;
}

export interface BoardResponse {
  summary: BoardSummary;
  invoices: InvoiceCard[];
}

export interface ApproveResponse {
  invoice_id: string;
  terminal_state: TerminalState;
  detail: string;
  sent: boolean;
  message: string | null;
}

export interface CheckPaymentsResponse {
  recovered: string[]; // invoice ids auto-reconciled to RECOVERED on this poll
}

export interface CheckInboundMailResponse {
  changed: string[]; // invoice ids whose board state moved on this poll
}

export interface InstallmentView {
  index: number;
  amount: string;
  due_date: string;
  payment_link: string | null;
  paid_at: string | null;
}

export type PaymentPlanStatus = "proposed" | "approved" | "rejected" | "active" | "broken" | "completed";

export type NegotiationOutcome = "accepted" | "wants_different_terms";

export interface PaymentPlanView {
  invoice_id: string;
  status: PaymentPlanStatus;
  installments: InstallmentView[];
  source: "template" | "negotiated";
  template_ref: string | null;
  offer_count: number;
  can_reoffer: boolean;
  // The debtor's response to the CURRENT offer, if any - cleared on a fresh
  // offer/reoffer. Surfaced so the vendor sees it before deciding.
  negotiation_outcome: NegotiationOutcome | null;
  requested_terms: string | null;
}

export interface PaymentPlanDecisionResponse {
  invoice_id: string;
  plan_status: string;
  offer_count: number;
  terminal_state: string;
  detail: string;
}

// A vendor-preapproved installment option (Profile tab settings). No platform
// ceiling on installments/period_days at the engine level - eligibility is
// enforced at the compliance gate, not here (see PaymentPlanTemplate's docstring).
export interface PaymentPlanTemplateInput {
  installments: number;
  period_days: number;
  label: string;
}

// Whether an explicit vendor approve/reject may confirm a payment plan to the
// debtor (SCHEMA.md §8) - asked at signup, changeable in the Profile tab.
export interface PaymentPlanAutonomy {
  enabled: boolean;
}

// Human-in-the-loop: flag a decision → guardrail + re-orchestrate.
export type FlagScope = "strategy" | "compliance";
export type FlagDirective =
  | "always_escalate"
  | "force_skip"
  | "force_hold"
  | "soften_tone"
  | "waive";

export interface FlagRequest {
  scope: FlagScope;
  directive: FlagDirective;
  waive_code?: string | null; // for directive=waive (soft codes only)
  reason?: string;
  criteria?: Record<string, unknown> | null;
}

export interface FlagResponse {
  invoice_id: string;
  terminal_state: TerminalState;
  detail: string;
  rule_id: string;
  applied: boolean; // false if refused (e.g. waiving a non-waivable rule)
  note: string;
}

export interface GuardrailView {
  rule_id: string;
  scope: FlagScope;
  directive: FlagDirective;
  criteria: Record<string, unknown>;
  waive_code: string | null;
  reason: string;
  created_at: string;
}

export interface RowIssue {
  row: number; // 1-indexed, matching what a spreadsheet user sees
  reasons: string[];
}

export interface CsvImportResponse {
  accepted: number; // written (actionable + quarantined)
  quarantined: number; // subset of accepted the orchestrator will quarantine
  rejected: RowIssue[]; // never written - a required field didn't parse
  invoice_ids: string[];
}

export interface ManualInvoiceBody {
  debtor_name: string;
  amount_due: string;
  issue_date: string; // YYYY-MM-DD
  due_date: string;
  is_b2b: boolean;
  debtor_email?: string | null;
  debtor_phone?: string | null;
  currency?: string;
  late_fee_allowed?: boolean;
  payment_link?: string | null;
  invoice_number?: string | null;
}

export interface ManualEntryResponse {
  invoice_id: string;
  quarantined: boolean;
  issues: string[];
}

export interface ActivityEntry {
  timestamp: string;
  invoice_id: string;
  agent: string;
  decision: string;
  reasoning: string;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  amount: number;
}

export interface Metrics {
  currency: string;
  other_currencies: string[];
  outstanding: number;
  in_flight: number;
  recovered: number;
  awaiting_count: number;
  awaiting_amount: number;
  aging: AgingBucket[];
}

// Display metadata for each terminal state - label + which theme color key to use.
export const STATE_META: Record<TerminalState, { label: string; tone: TerminalState }> = {
  sent: { label: "Sent", tone: "sent" },
  recovered: { label: "Recovered", tone: "recovered" },
  awaiting_approval: { label: "Awaiting approval", tone: "awaiting_approval" },
  escalated: { label: "Escalated", tone: "escalated" },
  skipped: { label: "Skipped", tone: "skipped" },
  held: { label: "On hold", tone: "held" },
  quarantined: { label: "Quarantined", tone: "quarantined" },
};

export const STATE_ORDER: TerminalState[] = [
  "awaiting_approval",
  "recovered",
  "sent",
  "escalated",
  "held",
  "skipped",
  "quarantined",
];
