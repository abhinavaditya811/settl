// TS mirror of the FastAPI engine's JSON contract (src/settl/api/schemas.py).

export type TerminalState =
  | "sent"
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
  awaiting_approval: { label: "Awaiting approval", tone: "awaiting_approval" },
  escalated: { label: "Escalated", tone: "escalated" },
  skipped: { label: "Skipped", tone: "skipped" },
  held: { label: "On hold", tone: "held" },
  quarantined: { label: "Quarantined", tone: "quarantined" },
};

export const STATE_ORDER: TerminalState[] = [
  "awaiting_approval",
  "sent",
  "escalated",
  "held",
  "skipped",
  "quarantined",
];
