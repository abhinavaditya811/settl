// Client-side fetchers. They hit our own Next route handlers under /api/*, which
// proxy to the FastAPI engine server-side - so the engine URL never reaches the
// browser. Each returns parsed JSON or throws on a non-2xx response.

import type {
  ActivityEntry,
  ApproveResponse,
  BoardResponse,
  CheckPaymentsResponse,
  CsvImportResponse,
  FlagRequest,
  FlagResponse,
  GuardrailView,
  InvoiceDetail,
  ManualEntryResponse,
  ManualInvoiceBody,
  Metrics,
  TraceEntry,
} from "./types";

// Which board a fetch reads: the shared synthetic demo tenants, or the signed-in
// operator's own tenant (Phase 1, FR-6). Threaded through as ?view= on every
// engine-backed route so the Next.js proxy knows which identity headers to attach.
export type BoardMode = "demo" | "mine";

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) message = String(body.detail);
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const getBoard = (mode: BoardMode = "demo") =>
  getJSON<BoardResponse>(`/api/invoices?view=${mode}`);

export const getMetrics = (mode: BoardMode = "demo") =>
  getJSON<Metrics>(`/api/metrics?view=${mode}`);

export const getActivity = (mode: BoardMode = "demo") =>
  getJSON<ActivityEntry[]>(`/api/activity?view=${mode}`);

export const getDetail = (id: string) =>
  getJSON<InvoiceDetail>(`/api/invoices/${id}`);

export const getTrace = (id: string) =>
  getJSON<TraceEntry[]>(`/api/invoices/${id}/trace`);

export const refreshBoard = (mode: BoardMode = "demo") =>
  getJSON<BoardResponse>(`/api/refresh?view=${mode}`, { method: "POST" });

// Approve a held draft. Pass `message` to send a human-edited version (the engine
// re-runs it through the compliance gate before sending).
export const approveInvoice = (id: string, message?: string) =>
  getJSON<ApproveResponse>(`/api/invoices/${id}/approve`, {
    method: "POST",
    headers: message ? { "content-type": "application/json" } : undefined,
    body: message ? JSON.stringify({ message }) : undefined,
  });

// Poll the engine for Stripe payments; it auto-reconciles any that were paid.
export const checkPayments = () =>
  getJSON<CheckPaymentsResponse>("/api/check-payments", { method: "POST" });

// Flag a decision: the engine stores a guardrail and re-orchestrates this invoice.
// The engine decides the outcome (and refuses waiving a non-waivable rule).
export const flagDecision = (id: string, body: FlagRequest) =>
  getJSON<FlagResponse>(`/api/invoices/${id}/flag`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// The stored operator guardrails (active human-in-the-loop rules).
export const getGuardrails = (mode: BoardMode = "demo") =>
  getJSON<GuardrailView[]>(`/api/guardrails?view=${mode}`);

// Upload a CSV of the operator's own invoices. Always scoped to "mine" - there is
// no demo variant of adding your own data (see the /api/invoices/import route).
export const uploadCsv = (csv: string) =>
  getJSON<CsvImportResponse>("/api/invoices/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv }),
  });

// Add one invoice by hand. Same "always mine" scoping as uploadCsv.
export const addManualInvoice = (body: ManualInvoiceBody) =>
  getJSON<ManualEntryResponse>("/api/invoices/manual", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
