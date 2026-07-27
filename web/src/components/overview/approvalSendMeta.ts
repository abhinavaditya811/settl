// Facts for the "will send…" strip on an approval card.

import type { InvoiceDetail } from "@/lib/types";

const CHANNEL: Record<string, string> = {
  email: "Email",
  sms: "Text",
  voice: "Voice",
};

const TONE: Record<string, string> = {
  friendly_reminder: "Friendly reminder",
  firm_reminder: "Firm reminder",
  final_notice: "Final notice",
};

export function sendTone(detail: InvoiceDetail | undefined): string | null {
  const strategy = detail?.steps.find((s) => s.agent === "strategy");
  const raw = strategy?.reasoning.match(/→\s*([a-z_]+)/i)?.[1];
  if (!raw) return null;
  return TONE[raw] ?? raw.replace(/_/g, " ");
}

/** Best available destination label (email/phone if present in draft, else name). */
export function sendDestination(
  channel: string,
  debtorName: string,
  preview: string,
): string {
  if (channel === "email") {
    const email = preview.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (email) return email[0];
  }
  if (channel === "sms" || channel === "voice") {
    const phone = preview.match(/\+?\d[\d\s().-]{7,}\d/);
    if (phone) return phone[0].trim();
  }
  return debtorName;
}

export function sendChannelLabel(channel: string): string {
  return CHANNEL[channel] ?? channel;
}
