import { NextRequest, NextResponse } from "next/server";
import { getEngineIdentityHeaders } from "@/lib/engineAuth";

// Kicks off the engine's Gmail OAuth flow for the signed-in operator's own
// tenant (SCHEMA.md §7) - no tenant_id lookup on this side, the engine resolves
// it from the forwarded identity headers. We can't just redirect the browser
// straight at the engine, since minting the real Google consent URL needs the
// internal-secret-verified identity headers, which never reach the browser -
// so this route calls the engine server-side, reads the Location it returns,
// and redirects the browser there instead.
const API_BASE = process.env.SETTL_API_BASE_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const identity = await getEngineIdentityHeaders(req);
  if (!identity) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }
  const upstream = await fetch(`${API_BASE}/oauth/google/authorize/mine`, {
    headers: identity,
    redirect: "manual",
  });
  const location = upstream.headers.get("location");
  if (!location) {
    const body = await upstream.text();
    return NextResponse.json(
      { detail: body || "Could not start the Google OAuth flow." },
      { status: upstream.status === 200 ? 502 : upstream.status },
    );
  }
  return NextResponse.redirect(location);
}
