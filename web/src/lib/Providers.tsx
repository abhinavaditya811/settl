"use client";

// Client-side context providers that must wrap the whole app. Currently the
// NextAuth SessionProvider so any client component can call useSession().

import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
