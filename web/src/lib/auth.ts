// NextAuth (Auth.js v4) configuration - the single source of auth truth.
// Kept out of the route handler so it can be imported elsewhere (e.g. server
// components, the proxy seam) and to respect the file-size cap.
//
// FR-1/FR-2: Google sign-in proves identity ONLY - scope is just openid/email/
// profile, none of which are Google *restricted* scopes, so this screen never
// shows the "unverified app" warning regardless of verification status. Gmail
// send/read authorization is a deliberate, separate opt-in step the user takes
// after logging in (backend `oauth_google.py`, surfaced as "Connect Gmail" in
// the Profile tab) - that flow requests gmail.readonly/gmail.send and stores
// its own refresh token in Supabase's `oauth_tokens`, independent of this login.
//
// token.sub (Google's OIDC subject id) is still the stable per-account
// identifier the engine uses as the tenant key (Phase 1, FR-6) - unaffected by
// the scope trim above.

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  // Our own sign-in page (not NextAuth's default) - where middleware sends
  // unauthenticated users and where errors surface.
  pages: { signIn: "/signin" },
  callbacks: {
    // Runs on sign-in and on every session read. `account`/`profile` are only
    // present on the initial sign-in.
    async jwt({ token, account, profile }) {
      if (account) {
        // Google's OIDC subject id - the stable per-account identifier the engine
        // uses as the tenant key (Phase 1, FR-6). NextAuth maps this to token.sub
        // by default already, but that's an implicit provider behavior; set it
        // explicitly from the profile so tenant resolution never depends on it.
        if (profile && "sub" in profile && typeof profile.sub === "string") {
          token.sub = profile.sub;
        } else if (account.providerAccountId) {
          token.sub = account.providerAccountId;
        }
      }
      return token;
    },
    async session({ session }) {
      return session;
    },
  },
};
