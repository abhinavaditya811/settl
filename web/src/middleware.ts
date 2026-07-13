// Edge auth gate. Runs before any matched route renders, so a logged-out user
// never even sees the dashboard flash.
//
// next-auth/middleware checks for a valid session cookie (the encrypted
// NextAuth session JWT). No valid session → redirect to /signin. The moment
// that cookie is missing or expired, access to the dashboard is gone - exactly
// the "token not there → logged out, no logged-in view" behaviour we want.

import { withAuth } from "next-auth/middleware";

// Redirect unauthenticated users to our own /signin page (the middleware does
// not read authOptions.pages, so it's set here too).
export default withAuth({
  pages: { signIn: "/signin" },
});

export const config = {
  // Protect the whole dashboard subtree. Public routes (/, /signin) and the
  // /api/auth/* endpoints are intentionally not matched.
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
