import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.text();
  return proxy(`/invoices/${encodeURIComponent(params.id)}/payment-plan/reoffer`, {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
}
