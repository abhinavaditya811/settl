// Client-side fetchers. They hit our own Next route handlers under /api/*, which
// proxy to the FastAPI engine server-side - so the engine URL never reaches the
// browser. Each returns parsed JSON or throws on a non-2xx response.

import type {
  ActivityEntry,
  ApproveResponse,
  BoardResponse,
  CheckPaymentsResponse,
  FlagRequest,
  FlagResponse,
  GuardrailView,
  InvoiceDetail,
  Metrics,
  TraceEntry,
} from "./types";

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

export const getBoard = () => getJSON<BoardResponse>("/api/invoices");

export const getMetrics = () => getJSON<Metrics>("/api/metrics");

export const getActivity = () => getJSON<ActivityEntry[]>("/api/activity");

export const getDetail = (id: string) =>
  getJSON<InvoiceDetail>(`/api/invoices/${id}`);

export const getTrace = (id: string) =>
  getJSON<TraceEntry[]>(`/api/invoices/${id}/trace`);

export const refreshBoard = () =>
  getJSON<BoardResponse>("/api/refresh", { method: "POST" });

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
export const getGuardrails = () => getJSON<GuardrailView[]>("/api/guardrails");
