import type { NextRequest } from "next/server";
import { getEngineIdentityHeaders } from "@/lib/engineAuth";
import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// Always the signed-in operator's own tenant - there is no demo variant of a
// vendor's own templates, so this calls proxy() directly with identity headers
// rather than authedProxy()'s demo/mine view switch (same as invoices/import).

export async function GET(req: NextRequest) {
  const identity = await getEngineIdentityHeaders(req);
  return proxy("/payment-plan-templates/mine", { headers: { ...(identity ?? {}) } });
}

export async function PUT(req: NextRequest) {
  const identity = await getEngineIdentityHeaders(req);
  const body = await req.text();
  return proxy("/payment-plan-templates/mine", {
    method: "PUT",
    body,
    headers: { "content-type": "application/json", ...(identity ?? {}) },
  });
}
