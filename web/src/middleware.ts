// Edge auth gate. Runs before any matched route renders, so a logged-out user
// never even sees the dashboard flash.
//
// next-auth/middleware checks for a valid session cookie (the encrypted
// NextAuth session JWT). No valid session → redirect to /signin. The moment
// that cookie is missing or expired, access to the dashboard is gone - exactly
// the "token not there → logged out, no logged-in view" behaviour we want.

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Local UI-development escape hatch: set DEV_BYPASS_AUTH=1 in web/.env.local
// (which is gitignored) to view the dashboard without Google sign-in. Impossible
// in production even if the env var is accidentally set.
const devBypass =
  process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "1";

// Redirect unauthenticated users to our own /signin page (the middleware does
// not read authOptions.pages, so it's set here too).
export default devBypass
  ? () => NextResponse.next()
  : withAuth({
      pages: { signIn: "/signin" },
    });

export const config = {
  // Protect the whole dashboard subtree. Public routes (/, /signin) and the
  // /api/auth/* endpoints are intentionally not matched.
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
