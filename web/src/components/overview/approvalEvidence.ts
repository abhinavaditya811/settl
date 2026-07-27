// Build a short "evidence pack" from engine steps so an operator can decide
// in ~15 seconds without re-reading the whole draft.

import type { InvoiceDetail } from "@/lib/types";

const TONE_LABEL: Record<string, string> = {
  friendly_reminder: "Friendly reminder",
  firm_reminder: "Firm reminder",
  final_notice: "Final notice",
};

/** 2–4 plain facts that justify approving this send. */
export function approvalEvidence(detail: InvoiceDetail | undefined): string[] {
  if (!detail) return [];
  const out: string[] = [];

  const strategy = detail.steps.find((s) => s.agent === "strategy");
  if (strategy?.reasoning) {
    const tone = strategy.reasoning.match(/→\s*([a-z_]+)/i)?.[1];
    if (tone) out.push(`Tone: ${TONE_LABEL[tone] ?? tone.replace(/_/g, " ")}`);
    if (/late fee not applied/i.test(strategy.reasoning)) out.push("No late fee in message");
    if (/late fee applied/i.test(strategy.reasoning)) out.push("Late fee mentioned");
  }

  const gate = detail.steps.find((s) => s.agent === "compliance_gate");
  if (gate?.decision === "pass") {
    out.push("Compliance cleared");
  } else if (gate && /First contact/i.test(gate.reasoning)) {
    out.push("Held for first-contact OK");
  }

  if (detail.channel === "email") out.push("Payment link fills on send");
  if (detail.is_b2b) out.push("B2B customer");

  // Dedupe while preserving order
  return [...new Set(out)].slice(0, 4);
}
