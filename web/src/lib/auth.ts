// NextAuth (Auth.js v4) configuration - the single source of auth truth.
// Kept out of the route handler so it can be imported elsewhere (e.g. server
// components, the proxy seam) and to respect the file-size cap.
//
// FR-1/FR-2: Google sign-in; the account a user logs in with is the same Gmail
// account Settl will later send from. FR-3: identity scopes + gmail.send
// (a Google *restricted* scope → app stays in test-user mode until verified) +
// offline access so we receive a refresh token.
//
// Token handling (TASKS.md "option 1"): the refresh token is parked in the
// encrypted NextAuth session JWT for now. It is NEVER exposed to the browser.
// Moving it to a server-side encrypted store is a prerequisite for autonomous
// offline sending (FR-7/FR-8) and lands in the persistence branch.

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: `openid email profile ${GMAIL_SEND}`,
          access_type: "offline",
          // Force the consent screen so Google reliably returns a refresh
          // token (it only sends one on first consent otherwise).
          prompt: "consent",
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
    // present on the initial sign-in, when the OAuth tokens are available.
    async jwt({ token, account, profile }) {
      if (account) {
        if (account.refresh_token) token.refreshToken = account.refresh_token;
        token.accessToken = account.access_token;
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
    // Identity only reaches the browser - the OAuth tokens stay server-side
    // inside the encrypted JWT and are deliberately not copied onto `session`.
    async session({ session }) {
      return session;
    },
  },
};
