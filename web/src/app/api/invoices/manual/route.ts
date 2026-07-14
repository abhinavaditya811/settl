import type { NextRequest } from "next/server";
import { getEngineIdentityHeaders } from "@/lib/engineAuth";
import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// Same reasoning as invoices/import/route.ts - manual entry always targets the
// signed-in operator's own tenant, so this bypasses authedProxy()'s view switch.
export async function POST(req: NextRequest) {
  const identity = await getEngineIdentityHeaders(req);
  const body = await req.text();
  return proxy("/invoices/manual", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...(identity ?? {}) },
  });
}
