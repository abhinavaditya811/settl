import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Forward an optional edited-message body to the engine (re-gated server-side).
  const body = await req.text();
  return proxy(`/invoices/${encodeURIComponent(params.id)}/approve`, {
    method: "POST",
    body: body || undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}
