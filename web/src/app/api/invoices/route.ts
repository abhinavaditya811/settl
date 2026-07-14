import type { NextRequest } from "next/server";
import { authedProxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return authedProxy(req, "/invoices");
}
