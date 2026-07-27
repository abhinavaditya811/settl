export const CONSOLE_TABS = [
  { key: "overview", label: "Overview", sub: "Cash position" },
  { key: "inbox", label: "Inbox", sub: "Needs you", badge: 3 },
  { key: "approvals", label: "Approvals", sub: "Needs sign-off", badge: 2 },
  { key: "invoices", label: "Invoices", sub: "Full ledger" },
  { key: "plans", label: "Plans", sub: "Installments" },
  { key: "activity", label: "Activity", sub: "Execution log" },
  { key: "settings", label: "Settings", sub: "Autonomy & rules" },
] as const;

export type ConsoleTabKey = (typeof CONSOLE_TABS)[number]["key"];

export const CONSOLE_DATA: Record<
  ConsoleTabKey,
  { label: string; title: string; desc: string }
> = {
  overview: {
    label: "Overview",
    title: "Money in motion.",
    desc: "Outstanding, in flight, recovered, and awaiting you. Same KPIs as the live board.",
  },
  inbox: {
    label: "Inbox",
    title: "Everything waiting on you.",
    desc: "First sends, disputes, quarantine, and payment plans in one triage queue.",
  },
  approvals: {
    label: "Approvals",
    title: "Waiting for your approval.",
    desc: "First contact and anything the gate escalates land here with the exact draft and reason.",
  },
  invoices: {
    label: "Invoices",
    title: "Every invoice and its next move.",
    desc: "Canonical state, amount, age, and what the engine chose next.",
  },
  plans: {
    label: "Plans",
    title: "Payment plans in flight.",
    desc: "Proposed, active, and broken installment schedules waiting on your call.",
  },
  activity: {
    label: "Activity",
    title: "Every decision leaves a reason.",
    desc: "Plain-English headlines from the execution log: strategy, compliance, send, reconcile.",
  },
  settings: {
    label: "Settings",
    title: "How the engine is armed.",
    desc: "Autonomy dial, guardrails, connections, and evidence export, pinned under the board.",
  },
};
