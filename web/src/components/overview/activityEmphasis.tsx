"use client";

// Deterministic emphasis + parse for activity reasons. No model required:
// known engine shapes (would send / WITHHELD) and high-signal tokens.

import type { ReactNode } from "react";

const TOKEN =
  /(\$\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s*USD|\bINV-[\w-]+\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\bhttps?:\/\/\S+|\d+\s*d(?:ays?)?\s*(?:overdue|late|past due)?|\d+\s*days?\s*(?:overdue|past due|late)|(?:\bEmail\b|\bSMS\b|\bText\b|\bVoice\b)|(?:consumer debt|payment plan|first contact|not B2B|\bB2B\b|disputed|too soon))/gi;

export function emphasizeReason(text: string): ReactNode[] {
  if (!text) return [];
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN.source, TOKEN.flags);
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<strong key={`${m.index}-${m[0]}`}>{m[0]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : [text];
}

export function shortReason(text: string, max = 110): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export type ParsedWhy =
  | { kind: "send"; to: string; via: string; body: string }
  | { kind: "prose"; text: string };

const VIA: Record<string, string> = {
  email: "Email",
  sms: "Text",
  voice: "Voice",
};

export function viaLabel(via: string): string {
  return VIA[via.toLowerCase()] ?? via;
}

/** Turn engine dump into something a human can read. */
export function parseWhy(raw: string): ParsedWhy {
  const t = raw.replace(/\s+/g, " ").trim();
  const send = t.match(
    /^would send:\s*to=(\S+)\s*via=(\S+)\s*::\s*([\s\S]+)/i,
  );
  if (send) {
    return {
      kind: "send",
      to: send[1],
      via: send[2],
      body: send[3]
        .replace(/\s*[—–]\s*/g, ", ")
        .trim(),
    };
  }
  return { kind: "prose", text: t.replace(/\s*[—–]\s*/g, ", ") };
}
