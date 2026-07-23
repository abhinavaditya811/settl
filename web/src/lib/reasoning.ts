// Turn the engine's raw decision `details` into plain-English label/value pairs a
// business owner can read - no raw booleans, no snake_case keys, no internal codes.
// The engine logs structured facts (factors, violation codes, tone, flags); this is the
// presentation layer that phrases them for a human. Pure + unit-testable.

// Which step of the engine ran → what it's doing, in a business owner's words.
const AGENT_LABELS: Record<string, string> = {
  ingestion: "Checked the invoice",
  strategy: "Deciding what to do",
  strategy_judgment: "Double-checking the plan",
  drafting: "Writing the message",
  reply_drafting: "Writing a reply",
  compliance_gate: "Compliance check",
  human_approval: "Your approval",
  sender: "Sending",
  email_sender: "Sending by email",
  sms_sender: "Sending by text",
  inbound_mail: "Checking your inbox",
  inbound_classifier: "Read their reply",
  inbound: "Handling their reply",
  payment_plan_negotiate: "Their payment-plan reply",
  payment_plan: "Payment plan",
  reconcile: "Checking for payment",
  reconcile_notify: "Keeping you posted",
  operator_flag: "Your feedback",
  voice_artifact: "Call summary",
  webhook: "Payment update",
};

// The outcome each step reached → plain English, no internal codes. Used as the
// fallback label for a detail step; milestone steps get an agent-aware headline
// (see HEADLINES / headline() below).
const DECISION_LABELS: Record<string, string> = {
  accepted: "Looks good",
  quarantined: "Couldn't read the invoice",
  chase: "Ready to send a reminder",
  skip: "Nothing to do",
  hold: "Waiting for the right time",
  held: "Waiting for the right time",
  review: "Needs your review",
  pass: "Cleared to send",
  escalate: "Sent to you for approval",
  escalated: "Sent to you for approval",
  awaiting_approval: "Waiting for your approval",
  approved: "You approved it",
  drafted: "Message written",
  refined: "Plan fine-tuned",
  skipped: "Kept the original plan",
  sent: "Message sent",
  withheld: "Held back, not sent",
  benign: "No action needed",
  dispute: "They disputed it",
  opt_out: "They asked us to stop",
  payment_plan_request: "They asked for a payment plan",
  escalate_low_confidence: "Flagged for you to read",
  operator_notified: "You were notified",
  operator_escalated: "Escalated to you",
  waiver_refused: "Waiver declined",
  guardrail_stored: "Your guardrail saved",
  unresolved: "Couldn't match this payment",
  paid: "Paid in full",
  partial: "Partially paid",
  unpaid: "Still unpaid",
  disputed: "Payment disputed",
  recovered: "Recovered",
  wants_different_terms: "Wants different terms",
};

// Milestone headline for a step a business owner actually cares about - phrased
// as a short event, agent-aware (the same decision means different things for
// different steps, e.g. "accepted" from ingestion vs. a payment-plan reply).
const HEADLINES: Record<string, string> = {
  "ingestion:quarantined": "Couldn't read this invoice",
  "compliance_gate:escalate": "Flagged for your review",
  "human_approval:awaiting_approval": "Waiting for your approval",
  "human_approval:approved": "You approved it",
  "sender:sent": "Reminder sent",
  "sender:withheld": "Held back — not sent",
  "email_sender:sent": "Emailed them",
  "email_sender:withheld": "Held back — not sent",
  "sms_sender:sent": "Texted them",
  "sms_sender:withheld": "Held back — not sent",
  "inbound_classifier:benign": "They replied — no action needed",
  "inbound_classifier:dispute": "They disputed the invoice",
  "inbound_classifier:opt_out": "They asked us to stop",
  "inbound_classifier:payment_plan_request": "They asked for a payment plan",
  "inbound_classifier:escalate_low_confidence": "They replied — flagged for you",
  "reconcile:paid": "Paid in full",
  "reconcile:partial": "Partially paid",
  "reconcile:disputed": "Payment disputed",
  "operator_flag:guardrail_stored": "You set a rule",
  "operator_flag:waiver_refused": "Rule can't be waived",
  "payment_plan_negotiate:accepted": "They accepted the plan",
  "payment_plan_negotiate:wants_different_terms": "They want different terms",
};

// Steps that are pure internal bookkeeping - never shown, not even under "details".
const HIDDEN_STEPS = new Set<string>([
  "ingestion:accepted",
  "reconcile_notify:operator_notified",
  "reconcile_notify:operator_escalated",
  "webhook:unresolved",
]);

// Agents whose every step is a milestone the owner should see by default.
const MILESTONE_AGENTS = new Set<string>([
  "human_approval", "sender", "email_sender", "sms_sender",
  "inbound_classifier", "operator_flag", "payment_plan_negotiate",
]);

// Specific (agent:decision) steps that are milestones even though the agent's
// other decisions are just mechanics (e.g. the gate is only a milestone when it
// blocks; reconcile only when something actually changed).
const MILESTONE_STEPS = new Set<string>([
  "ingestion:quarantined",
  "compliance_gate:escalate",
  "reconcile:paid", "reconcile:partial", "reconcile:disputed",
]);

export type StepTier = "milestone" | "detail" | "hidden";

/** How prominently to show a step: milestone (default view), detail (under
 * "Show details"), or hidden (internal bookkeeping, never shown). */
export function stepTier(agent: string, decision: string): StepTier {
  const key = `${agent}:${decision}`;
  if (HIDDEN_STEPS.has(key)) return "hidden";
  if (MILESTONE_STEPS.has(key) || MILESTONE_AGENTS.has(agent)) return "milestone";
  return "detail";
}

/** The short headline for a milestone step (agent-aware); falls back to the
 * decision label, then the agent label. */
export function headline(agent: string, decision: string): string {
  return HEADLINES[`${agent}:${decision}`] ?? DECISION_LABELS[decision] ?? AGENT_LABELS[agent] ?? decision;
}

// Compliance rule codes → what they mean in business terms.
const CODE_LABELS: Record<string, string> = {
  B2B_ONLY: "Consumer debt — outside our scope",
  DISPUTED: "Invoice is disputed",
  DISPUTE_RAISED: "Debtor disputed in a reply",
  PAYMENT_PLAN_REQUEST: "Debtor asked for a payment plan",
  FIRST_CONTACT_APPROVAL: "First contact — needs your approval",
  FREQUENCY_LIMIT: "Too many reminders too soon",
  LEGAL_THREAT: "Message contained a legal threat",
  UNENFORCEABLE_CONSEQUENCE: "Message claimed a consequence we can't enforce",
  LEGAL_ADVICE: "Message read like legal advice",
  TONE_BREACH: "Message tone was out of bounds",
  FABRICATED_LINK: "Message contained an unapproved link",
  OPERATOR_GUARDRAIL: "Your guardrail flagged this",
};

const TONE_LABELS: Record<string, string> = {
  friendly_reminder: "Friendly reminder",
  firm_reminder: "Firm reminder",
  final_notice: "Final notice",
};

const HINT_LABELS: Record<string, string> = {
  consumer_debt: "Consumer debt (out of scope)",
  disputed: "Invoice disputed",
  first_contact: "First contact — needs approval",
  frequency: "Contact-frequency limit",
};

const CRITERION_LABELS: Record<string, string> = {
  debtor_name: "debtor",
  is_b2b: "business customer",
  status: "status",
  source: "source",
  invoice_id: "invoice",
  days_overdue_gte: "overdue at least (days)",
};

// Internal bookkeeping fields that mean nothing to a business owner.
const SKIP = new Set(["message_checked"]);

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const code = (c: unknown) => CODE_LABELS[String(c)] ?? String(c);

function isEmpty(v: unknown): boolean {
  return (
    v == null ||
    v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
  );
}

// The strategy "factors" object, expanded into individual plain-English lines.
function factorPairs(factors: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(factors)) {
    if (isEmpty(v) && typeof v !== "boolean" && v !== 0) continue;
    if (k === "days_overdue") out.push(["Overdue", `${v} days`]);
    else if (k === "status") out.push(["Invoice status", titleCase(String(v))]);
    else if (k === "is_b2b") out.push(["Customer type", v ? "Business (B2B)" : "Consumer"]);
    else if (k === "outbound_touches") out.push(["Reminders already sent", String(v)]);
    else out.push([titleCase(k), typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)]);
  }
  return out;
}

function criteria(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${CRITERION_LABELS[k] ?? titleCase(k)} = ${String(v)}`)
    .join(", ");
}

/**
 * Strip the engine's `[CODE]` audit prefixes from a reasoning sentence so a
 * business owner reads plain English. The gate logs "[B2B_ONLY] Consumer debt…"
 * for the audit trail; the message after the code is already human-readable.
 */
export const cleanReasoning = (reasoning: string) =>
  reasoning.replace(/\[[A-Z0-9_]+\]\s*/g, "").trim();

/** The engine step name (e.g. "compliance_gate") → what a business owner reads. */
export const friendlyAgent = (agent: string) =>
  AGENT_LABELS[agent] ?? titleCase(agent);

/** The step's outcome code (e.g. "escalate") → plain English. */
export const friendlyDecision = (decision: string) =>
  DECISION_LABELS[decision] ?? titleCase(decision);

/** Turn a trace entry's `details` into readable (label, value) pairs for display. */
export function humanizeDetails(details: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(details)) {
    if (SKIP.has(key) || isEmpty(value)) continue;
    switch (key) {
      case "factors":
        out.push(...factorPairs(value as Record<string, unknown>));
        break;
      case "violation_codes":
        out.push(["Blocked by", (value as unknown[]).map(code).join(", ")]);
        break;
      case "waived_codes":
        out.push(["You waived", (value as unknown[]).map(code).join(", ")]);
        break;
      case "include_late_fee":
        out.push(["Late fee", value ? "Applied" : "Not applied"]);
        break;
      case "tone":
        out.push(["Tone", TONE_LABELS[String(value)] ?? titleCase(String(value))]);
        break;
      case "channel":
        out.push(["Channel", titleCase(String(value))]);
        break;
      case "escalation_hint":
        out.push(["Why a human is needed", HINT_LABELS[String(value)] ?? titleCase(String(value))]);
        break;
      case "criteria":
        out.push(["Applies to", criteria(value as Record<string, unknown>)]);
        break;
      case "rule_id":
        out.push(["Guardrail", String(value)]);
        break;
      case "fee_amount":
        out.push(["Success fee (recorded, not charged)", String(value)]);
        break;
      case "recovered_amount":
        out.push(["Amount recovered", String(value)]);
        break;
      default:
        out.push([
          titleCase(key),
          typeof value === "boolean" ? (value ? "Yes" : "No") : String(value),
        ]);
    }
  }
  return out;
}
