import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return proxy(`/invoices/${encodeURIComponent(params.id)}/payment-plan`);
}
