import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export function GET() {
  return proxy("/health");
}
