import type { NextRequest } from "next/server";
import { authedProxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  // Session-scoped: polls every tenant in view (mine or demo), no tenant_id needed.
  return authedProxy(req, "/check-inbound-mail/mine", { method: "POST" });
}
