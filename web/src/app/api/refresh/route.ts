import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export function POST() {
  return proxy("/refresh", { method: "POST" });
}
