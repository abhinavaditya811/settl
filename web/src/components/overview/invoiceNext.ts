// Plain-language next-action copy for the Invoices worklist + drawer.

import type { AppTheme } from "@/lib/theme";
import type { TerminalState } from "@/lib/types";

export function needsYou(inv: {
  needs_human: boolean;
  terminal_state: TerminalState;
}): boolean {
  if (inv.needs_human) return true;
  return (
    inv.terminal_state === "awaiting_approval" ||
    inv.terminal_state === "escalated" ||
    inv.terminal_state === "quarantined"
  );
}

export function isOpenBook(state: TerminalState): boolean {
  return state !== "recovered" && state !== "skipped";
}

export function nextAction(o: TerminalState): { text: string; tone: TerminalState } {
  switch (o) {
    case "recovered":
      return { text: "Paid", tone: "recovered" };
    case "awaiting_approval":
      return { text: "Needs your OK", tone: "awaiting_approval" };
    case "escalated":
      return { text: "Needs you", tone: "escalated" };
    case "held":
      return { text: "On hold", tone: "held" };
    case "skipped":
      return { text: "Settled", tone: "skipped" };
    case "quarantined":
      return { text: "Couldn't read", tone: "quarantined" };
    default:
      return { text: "Chasing", tone: "sent" };
  }
}

export function whatsNext(o: TerminalState): string {
  switch (o) {
    case "recovered":
      return "Paid. Nothing more to do.";
    case "awaiting_approval":
      return "Held for your approval. Approve to send the first message.";
    case "escalated":
      return "Routed to you. Settl won't act until you resolve it.";
    case "held":
      return "Settl will resume chasing automatically (respecting contact limits).";
    case "skipped":
      return "No outreach needed. Already settled or not yet due.";
    case "quarantined":
      return "Settl couldn't read this invoice. A human needs to check it.";
    default:
      return "Settl is chasing this invoice on schedule.";
  }
}

export function heatColor(days: number, theme: AppTheme): string {
  if (days <= 0) return theme.textMuted;
  if (days <= 14) return theme.status.sent.fg;
  if (days <= 30) return theme.status.awaiting_approval.fg;
  return theme.status.escalated.fg;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const DETAIL_LABELS: Record<string, string> = {
  PAYMENT_PLAN_REQUEST: "Payment plan requested",
  DISPUTED: "Disputed",
  disputed: "Disputed",
};

/** Humanize engine detail codes for UI; empty if nothing useful. */
export function truncateDetail(raw: string, max = 60): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  // Skip noise that already lives in status / next-action.
  if (/^(disputed|escalated|held|sent|paid|recovered)$/i.test(clean)) return "";
  const mapped = DETAIL_LABELS[clean] ?? DETAIL_LABELS[clean.toUpperCase()];
  const text =
    mapped ??
    clean
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  voice: "Voice",
};
