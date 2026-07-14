import type { NextRequest } from "next/server";
import { getEngineIdentityHeaders } from "@/lib/engineAuth";
import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// CSV upload always targets the signed-in operator's own tenant - there is no
// "demo" variant of adding your own invoices, so this calls proxy() directly
// with identity headers rather than authedProxy()'s demo/mine view switch.
export async function POST(req: NextRequest) {
  const identity = await getEngineIdentityHeaders(req);
  const body = await req.text();
  return proxy("/invoices/import/csv", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...(identity ?? {}) },
  });
}
