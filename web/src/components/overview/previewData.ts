// Mock data for the local /preview redesign. No backend or auth needed - this lets
// us iterate on all four tabs and screen-share before wiring real data.

import type { AppTheme, ThemeMode } from "@/lib/theme";
import type { TerminalState } from "@/lib/types";

export type Tone = "sent" | "escalated" | "awaiting" | "accent" | "muted" | "quarantined";

export const hero = {
  workspace: "Brightline Collective",
  invoices: 127,
  customers: 38,
  inMotion: 45970,
  recovered: 1410,
  outstanding: 55580,
  chasing: 12,
  hoursSaved: 14,
  dsoFrom: 31,
  dsoTo: 19,
  trend: [120, 240, 360, 540, 720, 980, 1180, 1410],
};

export interface AgingRow { label: string; count: number; amount: number; tone: Tone; }
export const aging: AgingRow[] = [
  { label: "0–30 days", count: 12, amount: 15540, tone: "accent" },
  { label: "31–60 days", count: 6, amount: 25740, tone: "awaiting" },
  { label: "61+ days", count: 2, amount: 13000, tone: "escalated" },
];

export interface DecisionRow { label: string; value: number; tone: Tone; }
export const decisions: DecisionRow[] = [
  { label: "Sent", value: 10, tone: "sent" },
  { label: "Escalated", value: 6, tone: "escalated" },
  { label: "Awaiting you", value: 4, tone: "awaiting" },
  { label: "Skipped", value: 3, tone: "muted" },
  { label: "On hold", value: 1, tone: "accent" },
  { label: "Quarantined", value: 1, tone: "quarantined" },
];

export interface Approval {
  initials: string; name: string; amount: string; overdue: string; channel: string; draft: string;
}
export const approvals: Approval[] = [
  { initials: "BS", name: "Brightline Studio", amount: "$1,000", overdue: "7 days overdue", channel: "email",
    draft: "Hi Brightline Studio, just a friendly reminder that invoice INV-031 for $1,000 is now 7 days past due. You can settle it here whenever convenient: {{payment_link}}. Thanks so much!" },
  { initials: "AS", name: "Acme Supply Co", amount: "$1,090", overdue: "12 days overdue", channel: "email",
    draft: "Hi Acme Supply Co, a quick note that invoice INV-034 for $1,090 is now 12 days overdue. Here is your secure payment link to settle it: {{payment_link}}. Let us know if anything is holding it up." },
  { initials: "VT", name: "Vertex Tooling", amount: "$750", overdue: "9 days overdue", channel: "sms",
    draft: "Hi Vertex Tooling — invoice INV-029 for $750 is 9 days past due. Settle it here whenever you can: {{payment_link}}. Thank you!" },
];

export interface FeedRow { initials: string; tone: Tone; line: string; sub: string; status: string; time: string; }
export const feed: FeedRow[] = [
  { initials: "SR", tone: "sent", line: "Sent a firm reminder to Summit Roofing Co", sub: "$2,750 · 40 days overdue · cleared the compliance gate", status: "sent", time: "just now" },
  { initials: "NL", tone: "sent", line: "Reminder delivered to Northwind Logistics", sub: "$5,200 · 22 days overdue", status: "sent", time: "11m ago" },
  { initials: "CC", tone: "escalated", line: "Paused — Cedar & Co disputed this invoice", sub: "$3,400 · routed to you, not sent", status: "escalated", time: "18m ago" },
  { initials: "JA", tone: "escalated", line: "Flagged to you — J. Alvarez is consumer debt", sub: "$760 · outside B2B policy, never auto-sent", status: "escalated", time: "25m ago" },
];

export interface InvoiceRow {
  id: string; debtor: string; amount: string; overdue: string; b2b: boolean; status: string; outcome: TerminalState;
}
export const invoices: InvoiceRow[] = [
  { id: "INV-025", debtor: "Summit Roofing Co", amount: "$2,750", overdue: "40d", b2b: true, status: "partial", outcome: "sent" },
  { id: "INV-018", debtor: "Northwind Logistics", amount: "$5,200", overdue: "22d", b2b: true, status: "open", outcome: "sent" },
  { id: "INV-031", debtor: "Brightline Studio", amount: "$1,000", overdue: "7d", b2b: true, status: "open", outcome: "awaiting_approval" },
  { id: "INV-024", debtor: "Cedar & Co", amount: "$3,400", overdue: "23d", b2b: true, status: "disputed", outcome: "escalated" },
  { id: "INV-003", debtor: "J. Alvarez", amount: "$760", overdue: "20d", b2b: false, status: "open", outcome: "escalated" },
  { id: "INV-005", debtor: "Harbor Freight Ltd", amount: "$4,100", overdue: "0d", b2b: true, status: "paid", outcome: "recovered" },
  { id: "INV-009", debtor: "Pinewood Interiors", amount: "$2,300", overdue: "8d", b2b: true, status: "open", outcome: "held" },
  { id: "INV-012", debtor: "Atlas Mechanical", amount: "$6,800", overdue: "21d", b2b: true, status: "open", outcome: "sent" },
  { id: "INV-010", debtor: "Solace Dental", amount: "$1,250", overdue: "0d", b2b: true, status: "open", outcome: "skipped" },
  { id: "INV-040", debtor: "(unreadable)", amount: "—", overdue: "—", b2b: true, status: "unknown", outcome: "quarantined" },
];

export interface ActivityRow { agent: string; line: string; time: string; tone: Tone; day: "Today" | "Yesterday"; inv: string; safety?: boolean; }
export const activity: ActivityRow[] = [
  { day: "Today", agent: "sender", line: "Sent a firm reminder to Summit Roofing Co — $2,750", time: "just now", tone: "sent", inv: "INV-025" },
  { day: "Today", agent: "strategy_judgment", line: "Refined Northwind Logistics' tone to a firm reminder", time: "11m ago", tone: "accent", inv: "INV-018" },
  { day: "Today", agent: "compliance_gate", line: "Blocked a draft to Cedar & Co — the customer disputed it", time: "18m ago", tone: "escalated", inv: "INV-024", safety: true },
  { day: "Today", agent: "drafting", line: "Drafted a first message for Brightline Studio — held for you", time: "32m ago", tone: "awaiting", inv: "INV-031" },
  { day: "Today", agent: "ingestion", line: "Couldn't read INV-040 — quarantined for a human", time: "1h ago", tone: "quarantined", inv: "INV-040", safety: true },
  { day: "Yesterday", agent: "compliance_gate", line: "Flagged J. Alvarez — consumer debt, outside B2B policy", time: "19h ago", tone: "escalated", inv: "INV-003", safety: true },
  { day: "Yesterday", agent: "reconcile", line: "Marked Harbor Freight Ltd paid — recovered $4,100", time: "22h ago", tone: "sent", inv: "INV-005" },
  { day: "Yesterday", agent: "sender", line: "Sent a final notice to Atlas Mechanical — $6,800", time: "1d ago", tone: "sent", inv: "INV-012" },
];

export type DigestPeriod = "today" | "week" | "month";
export interface Digest { handled: number; customers: number; sent: number; recovered: string; held: number; blocked: number; }
export const digest: Record<DigestPeriod, Digest> = {
  today: { handled: 12, customers: 9, sent: 8, recovered: "$1,410", held: 3, blocked: 1 },
  week: { handled: 63, customers: 38, sent: 42, recovered: "$8,200", held: 11, blocked: 3 },
  month: { handled: 247, customers: 96, sent: 168, recovered: "$34,900", held: 38, blocked: 9 },
};

export function toneFg(tone: Tone, theme: AppTheme): string {
  switch (tone) {
    case "sent": return theme.status.sent.fg;
    case "escalated": return theme.status.escalated.fg;
    case "awaiting": return theme.status.awaiting_approval.fg;
    case "quarantined": return theme.status.quarantined.fg;
    case "accent": return theme.accent;
    case "muted": return theme.textMuted;
  }
}
export function toneBg(tone: Tone, theme: AppTheme): string {
  switch (tone) {
    case "sent": return theme.status.sent.bg;
    case "escalated": return theme.status.escalated.bg;
    case "awaiting": return theme.status.awaiting_approval.bg;
    case "quarantined": return theme.status.quarantined.bg;
    case "accent": return theme.surfaceAlt;
    case "muted": return theme.surfaceAlt;
  }
}

export const agentLabel: Record<string, string> = {
  ingestion: "Ingestion", strategy: "Strategy", strategy_judgment: "Judgment",
  drafting: "Drafting", compliance_gate: "Compliance gate", sender: "Sender",
  reconcile: "Reconcile",
};

export type { ThemeMode };
