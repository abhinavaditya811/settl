// Small display helpers shared by the board components.

export function formatMoney(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    // Unknown currency code → fall back to a plain number + code.
    return `${n.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency}`;
  }
}

export function formatAmount(n: number, currency: string): string {
  return formatMoney(String(n), currency);
}

export function overdueLabel(days: number): string {
  if (days <= 0) return `${Math.abs(days)}d until due`;
  return `${days}d overdue`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function prettyAgent(agent: string): string {
  return agent.replace(/_/g, " ");
}
