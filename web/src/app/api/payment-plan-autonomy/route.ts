import type { NextRequest } from "next/server";
import { getEngineIdentityHeaders } from "@/lib/engineAuth";
import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// Always the signed-in operator's own tenant - same reasoning as
// payment-plan-templates/route.ts (no demo variant of a vendor's own settings).

export async function GET(req: NextRequest) {
  const identity = await getEngineIdentityHeaders(req);
  return proxy("/payment-plan-autonomy/mine", { headers: { ...(identity ?? {}) } });
}

export async function PUT(req: NextRequest) {
  const identity = await getEngineIdentityHeaders(req);
  const body = await req.text();
  return proxy("/payment-plan-autonomy/mine", {
    method: "PUT",
    body,
    headers: { "content-type": "application/json", ...(identity ?? {}) },
  });
}
