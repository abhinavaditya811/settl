import type { Metadata } from "next";

// Server Component wrapper - metadata exports require a Server Component, but
// the page itself is a Client Component (styled-components' theme access needs
// the client-side ThemeProvider, same as every other page in this app).
export const metadata: Metadata = {
  title: "Terms of Service - Settl",
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
