// Fonts for the landing preview. We load them via a runtime stylesheet <link>
// (NOT next/font) so a slow/unreachable Google Fonts never blocks the build — the
// page renders instantly with the system fallback and upgrades if the fonts load.

import type { CSSProperties } from "react";

const fontVars = {
  "--font-display": "'Space Grotesk', system-ui, sans-serif",
  "--font-body": "'Inter', system-ui, sans-serif",
  "--font-mono": "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
} as CSSProperties;

const HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap";

export default function LandingPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={fontVars}>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={HREF} />
      {children}
    </div>
  );
}
