// Client-side fetchers. They hit our own Next route handlers under /api/*, which
// proxy to the FastAPI engine server-side - so the engine URL never reaches the
// browser. Each returns parsed JSON or throws on a non-2xx response.

import type {
  ActivityEntry,
  ApproveResponse,
  BoardResponse,
  CheckInboundMailResponse,
  CheckPaymentsResponse,
  CsvImportResponse,
  FlagRequest,
  FlagResponse,
  GuardrailView,
  InvoiceDetail,
  ManualEntryResponse,
  ManualInvoiceBody,
  Metrics,
  PaymentPlanAutonomy,
  PaymentPlanDecisionResponse,
  PaymentPlanTemplateInput,
  PaymentPlanView,
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

// Poll Gmail for new debtor replies across every tenant in view. On-demand version
// of the ~2min scheduled poller, so a reply shows up without a manual page refresh.
export const checkInboundMail = (mode: BoardMode = "demo") =>
  getJSON<CheckInboundMailResponse>(`/api/check-inbound-mail?view=${mode}`, { method: "POST" });

// The offered/active payment plan for an invoice, or null if none exists yet -
// a 404 is the expected "nothing offered" case, not an error to surface.
export const getPaymentPlan = async (id: string): Promise<PaymentPlanView | null> => {
  const res = await fetch(`/api/invoices/${id}/payment-plan`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<PaymentPlanView>;
};

// Offer the vendor's pre-approved template (CLAUDE.md: bounded autonomous handling -
// gathers non-binding terms, never confirmed to the debtor without a vendor decision).
export const offerPaymentPlan = (id: string) =>
  getJSON<PaymentPlanView>(`/api/invoices/${id}/payment-plan/offer`, { method: "POST" });

// Vendor-constructed terms, typically after the debtor asked for something
// different (negotiation_outcome === "wants_different_terms") - amends the same
// plan in place, still needs the vendor's explicit approve/reject to confirm.
export const reofferPaymentPlan = (id: string, template: PaymentPlanTemplateInput) =>
  getJSON<PaymentPlanView>(`/api/invoices/${id}/payment-plan/reoffer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(template),
  });

// Vendor approve/reject on an offered plan - the only step that can ever confirm
// terms to the debtor (re-gated server-side on approval).
export const decidePaymentPlan = (id: string, approved: boolean) =>
  getJSON<PaymentPlanDecisionResponse>(`/api/invoices/${id}/payment-plan/decide`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ approved }),
  });

// The signed-in vendor's own payment-plan templates (Profile tab settings).
export const getPaymentPlanTemplates = () =>
  getJSON<PaymentPlanTemplateInput[]>("/api/payment-plan-templates");

// Replace the vendor's full set of templates - not a partial patch.
export const savePaymentPlanTemplates = (templates: PaymentPlanTemplateInput[]) =>
  getJSON<PaymentPlanTemplateInput[]>("/api/payment-plan-templates", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ templates }),
  });

// Whether the vendor opted in to letting an explicit approve/reject confirm a
// payment plan to the debtor - asked at signup, changeable in the Profile tab.
export const getPaymentPlanAutonomy = () =>
  getJSON<PaymentPlanAutonomy>("/api/payment-plan-autonomy");

export const setPaymentPlanAutonomy = (enabled: boolean) =>
  getJSON<PaymentPlanAutonomy>("/api/payment-plan-autonomy", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled }),
  });

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
