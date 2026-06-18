// NextAuth route handler - exposes /api/auth/* (signin, callback, session,
// signout). All real config lives in @/lib/auth so it can be reused.

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
