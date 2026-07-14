// Server-only helper: forward a request to the FastAPI engine and relay its JSON.
// The engine base URL lives in a server env var (SETTL_API_BASE_URL), so it is
// never exposed to the browser.

import type { NextRequest } from "next/server";
import { getEngineIdentityHeaders } from "./engineAuth";

const API_BASE = process.env.SETTL_API_BASE_URL ?? "http://localhost:8000";

export async function proxy(path: string, init?: RequestInit): Promise<Response> {
  try {
    const upstream = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ detail: `Engine API unreachable at ${API_BASE}` }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}

// Tenant-aware proxy (Phase 1, FR-6): reads ?view=demo|mine off the incoming
// request and, only for "mine", attaches the signed-in operator's identity over
// the internal-secret-verified boundary. A "mine" request with no valid session
// still forwards view=mine with NO identity headers - the engine 401s rather than
// silently falling back to something else (fail closed, not fail open).
export async function authedProxy(
  req: NextRequest,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const view = req.nextUrl.searchParams.get("view") === "mine" ? "mine" : "demo";
  const identity = view === "mine" ? await getEngineIdentityHeaders(req) : null;
  const headers = new Headers(init?.headers);
  if (identity) {
    for (const [key, value] of Object.entries(identity)) headers.set(key, value);
  }
  const separator = path.includes("?") ? "&" : "?";
  return proxy(`${path}${separator}view=${view}`, { ...init, headers });
}
