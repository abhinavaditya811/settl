// Server-only helper: forward a request to the FastAPI engine and relay its JSON.
// The engine base URL lives in a server env var (SETTL_API_BASE_URL), so it is
// never exposed to the browser.

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
