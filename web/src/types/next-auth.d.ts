// Type augmentation: the extra fields we stash on the NextAuth session JWT.
// These live server-side only (see @/lib/auth) and are not surfaced on the
// client `Session`.

import "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    refreshToken?: string;
    accessToken?: string;
  }
}
