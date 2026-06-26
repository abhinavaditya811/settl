import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST() {
  // Poll the engine, which checks Stripe and auto-reconciles any paid invoices.
  return proxy("/check-payments", { method: "POST" });
}
