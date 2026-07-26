export const CONSOLE_TABS = [
  { key: "overview", label: "Overview", sub: "Cash position" },
  { key: "approvals", label: "Approvals", sub: "Needs sign-off", badge: 2 },
  { key: "invoices", label: "Invoices", sub: "Full ledger" },
  { key: "activity", label: "Activity", sub: "Execution log" },
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
  activity: {
    label: "Activity",
    title: "Every decision leaves a reason.",
    desc: "Plain-English headlines from the execution log: strategy, compliance, send, reconcile.",
  },
};
