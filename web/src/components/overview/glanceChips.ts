// Split engine reasoning into short chips + an optional full detail line.
// Chips stay tiny; detail wraps so the whole reason is readable.

import { cleanReasoning } from "@/lib/reasoning";

export type ChipKind = "channel" | "money" | "risk" | "ok" | "neutral";

export interface GlanceChip {
  label: string;
  kind: ChipKind;
}

export interface Glance {
  chips: GlanceChip[];
  /** Full plain-English reason; shown as wrapping text, never clipped in a pill. */
  detail?: string;
}

const MAX_CHIPS = 3;

function moneyLabel(amount: string, ccy: string): string {
  const n = Number(amount.replace(/,/g, ""));
  if (Number.isNaN(n)) return `${amount} ${ccy}`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${amount} ${ccy}`;
  }
}

/** Normalize escalate prose into one clean sentence (no audit prefixes / doubles). */
function cleanDetail(s: string): string {
  let t = s.trim();
  t = t.replace(/\s+/g, " ");
  // Drop trailing "Escalate; do not send." style instructions.
  t = t.replace(/\s*;?\s*Escalate[^.]*\.?\s*$/i, "");
  t = t.replace(/\s*;?\s*do not send\.?\s*$/i, "");
  // Prefer first clause if the engine stacked several with "; ".
  const parts = t.split(/\s*;\s*/).filter(Boolean);
  if (parts.length > 1) {
    // Keep the human-meaningful first part; join a short second if tiny.
    t = parts[0];
    if (parts[1] && parts[1].length < 40 && !/escalate/i.test(parts[1])) {
      t = `${parts[0]}. ${parts[1]}`;
    }
  }
  if (t && !/[.!?]$/.test(t)) t = `${t}.`;
  return t;
}

function riskChips(raw: string): GlanceChip[] {
  const chips: GlanceChip[] = [];
  if (/DISPUTE|disputed/i.test(raw)) chips.push({ label: "Disputed", kind: "risk" });
  if (/FIRST_CONTACT|first contact/i.test(raw)) {
    chips.push({ label: "Needs your OK", kind: "ok" });
  }
  if (/Consumer|FDCPA|non-B2B|B2B_ONLY/i.test(raw)) {
    chips.push({ label: "Not B2B", kind: "risk" });
  }
  if (/FREQUENCY|too soon/i.test(raw)) chips.push({ label: "Too soon", kind: "neutral" });
  return chips.slice(0, MAX_CHIPS);
}

/** Auto facts + full detail for Overview cards. */
export function glanceFacts(
  _agent: string,
  decision: string,
  reasoning: string,
): Glance {
  const raw = cleanReasoning(reasoning);
  if (!raw) return { chips: [] };

  const send = raw.match(/^would send:\s*to=(\S+)\s*via=(\S+)/i);
  if (send) {
    const chips: GlanceChip[] = [];
    const via = send[2].toLowerCase();
    chips.push({
      label: via === "email" ? "Email" : via === "sms" ? "Text" : via,
      kind: "channel",
    });
    const amt = raw.match(/for\s+([\d,.]+)\s+([A-Z]{3})/i);
    if (amt) chips.push({ label: moneyLabel(amt[1], amt[2]), kind: "money" });
    const days = raw.match(/(\d+)\s+days?\s+past due/i);
    if (days) chips.push({ label: `${days[1]}d late`, kind: "neutral" });
    const to = send[1];
    return {
      chips: chips.slice(0, MAX_CHIPS),
      detail: `Sent to ${to}.`,
    };
  }

  if (decision === "withheld" || /^WITHHELD/i.test(raw)) {
    const chips = riskChips(raw);
    if (!chips.length) chips.push({ label: "Held back", kind: "risk" });
    let detail = raw
      .replace(/^WITHHELD[^:]*:\s*/i, "")
      .replace(/\s*-\s*routed to human, not sent\.?/i, "")
      .trim();
    detail = cleanDetail(detail);
    return { chips, detail: detail || undefined };
  }

  if (decision === "paid" || decision === "recovered") {
    return { chips: [{ label: "Money in", kind: "ok" }], detail: "Payment verified." };
  }

  const esc = raw.match(/Escalated to human:\s*(.+)/i);
  if (esc) {
    const chips = riskChips(raw);
    if (!chips.length) chips.push({ label: "Needs you", kind: "ok" });
    return { chips, detail: cleanDetail(esc[1]) };
  }

  if (raw.length <= 90) {
    return { chips: [], detail: cleanDetail(raw) };
  }

  return { chips: [], detail: cleanDetail(raw.split(/[.\n]/)[0]) };
}

/** @deprecated use glanceFacts */
export function glanceChips(
  agent: string,
  decision: string,
  reasoning: string,
): GlanceChip[] {
  return glanceFacts(agent, decision, reasoning).chips;
}
