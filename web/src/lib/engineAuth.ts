// Server-only: resolves the signed-in operator's identity from the NextAuth JWT
// cookie, for forwarding to the engine over the internal-secret-verified boundary
// (Phase 1, FR-6). The engine is publicly reachable directly, so a forwarded
// identity header is only trustworthy alongside SETTL_INTERNAL_SECRET - this
// helper attaches both, or returns null when there's no signed-in session (the
// caller falls back to the demo view rather than guessing an identity).

import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function getEngineIdentityHeaders(
  req: NextRequest,
): Promise<Record<string, string> | null> {
  const secret = process.env.SETTL_INTERNAL_SECRET;
  if (!secret) return null;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return null;
  return {
    "x-settl-internal-secret": secret,
    "x-settl-google-sub": token.sub,
    "x-settl-user-email": token.email ?? "",
  };
}
