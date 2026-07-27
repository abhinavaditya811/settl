import { NextRequest, NextResponse } from "next/server";

// Google's own redirect after consent lands here - this exact path is what's
// registered as the OAuth client's authorized redirect URI in Google Cloud
// Console (and what the engine's GOOGLE_OAUTH_REDIRECT_URI declares when it
// mints the consent URL, so the two stay in lockstep). Forwards code/state to
// the engine's real callback handler (which does the token exchange - no
// identity headers needed here, `state` itself carries the tenant via an
// encrypted, CSRF-protected blob) and follows its redirect back to the
// dashboard, so the whole flow stays on this domain instead of ever showing
// the raw Cloud Run URL in the browser.
const API_BASE = process.env.SETTL_API_BASE_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard?gmail_error=connect_failed", req.url));
  }
  const upstream = await fetch(
    `${API_BASE}/oauth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    { redirect: "manual" },
  );
  const location = upstream.headers.get("location");
  if (!location) {
    return NextResponse.redirect(new URL("/dashboard?gmail_error=connect_failed", req.url));
  }
  return NextResponse.redirect(location);
}
