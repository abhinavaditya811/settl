// Client-side evidence pack from activity + optional trace (no new engine route).

import type { ActivityEntry, TraceEntry } from "@/lib/types";

export function downloadEvidencePack(opts: {
  invoiceId?: string;
  activity: ActivityEntry[];
  trace?: TraceEntry[];
}): void {
  const generated_at = new Date().toISOString();
  const activity = opts.invoiceId
    ? opts.activity.filter((e) => e.invoice_id === opts.invoiceId)
    : opts.activity;
  const bundle = {
    format: "settl.evidence.v1",
    generated_at,
    scope: opts.invoiceId ? { invoice_id: opts.invoiceId } : { board: "windowed_activity" },
    note: "Projection of engine execution log for sales / audit review. Not a substitute for the server-side audit sink.",
    activity,
    trace: opts.trace ?? [],
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.invoiceId
    ? `settl-evidence-${opts.invoiceId}.json`
    : `settl-evidence-${generated_at.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
