// Cross-tab handoff: Activity (or Overview) → open a case on Invoices.

const KEY = "settl:focusInvoice";

export function setFocusInvoice(invoiceId: string): void {
  try {
    sessionStorage.setItem(KEY, invoiceId);
  } catch {
    /* private mode */
  }
}

/** Read and clear the pending invoice focus, if any. */
export function takeFocusInvoice(): string | null {
  try {
    const id = sessionStorage.getItem(KEY);
    if (id) sessionStorage.removeItem(KEY);
    return id;
  } catch {
    return null;
  }
}

export function goToInvoice(invoiceId: string): void {
  setFocusInvoice(invoiceId);
  if (typeof window !== "undefined") {
    window.location.hash = "invoices";
  }
}
