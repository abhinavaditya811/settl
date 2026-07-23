import { NextRequest, NextResponse } from "next/server";
import { getEngineIdentityHeaders } from "@/lib/engineAuth";

const API_BASE = process.env.SETTL_API_BASE_URL ?? "http://localhost:8000";

// Whether the signed-in operator's tenant already has a Gmail token on file -
// lets the dashboard show "Connected" vs. "Connect Gmail" without guessing.
export async function GET(req: NextRequest) {
  const identity = await getEngineIdentityHeaders(req);
  if (!identity) return NextResponse.json({ connected: false });
  const upstream = await fetch(`${API_BASE}/oauth/google/status`, {
    headers: identity,
    cache: "no-store",
  });
  if (!upstream.ok) return NextResponse.json({ connected: false });
  return NextResponse.json(await upstream.json());
}
