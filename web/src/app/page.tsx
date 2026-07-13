"use client";

// Public landing page (/). Cinematic "Mission Control" design: dark, glassmorphism,
// ambient glow + canvas mesh + faint grid behind frosted-glass content.
// Dark-locked by design. Font loading is inlined (no separate layout needed).

import type { CSSProperties } from "react";
import styled from "styled-components";
import { c } from "@/components/landing/palette";
import MeshBackground from "@/components/landing/MeshBackground";
import Hero from "@/components/landing/Hero";
import Explainer from "@/components/landing/Explainer";
import Showcase from "@/components/landing/Showcase";
import LandingSections from "@/components/landing/LandingSections";

const fontVars = {
  "--font-display": "'Space Grotesk', system-ui, sans-serif",
  "--font-body": "'Inter', system-ui, sans-serif",
  "--font-mono": "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
} as CSSProperties;

const HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap";

const Canvas = styled.div`
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(1200px 720px at 50% -8%, rgba(109, 94, 246, 0.2), transparent 60%),
    ${c.bg};
  color: ${c.ink};
  font-family: ${c.body};
  -webkit-font-smoothing: antialiased;
`;
const Bg = styled.div`
  position: absolute; top: 0; left: 0; right: 0; height: 1040px; z-index: 0; pointer-events: none;
  -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent);
  mask-image: linear-gradient(to bottom, #000 60%, transparent);
`;
const Grid = styled.div`
  position: absolute; inset: 0; opacity: 0.45;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 54px 54px;
  -webkit-mask-image: radial-gradient(ellipse 72% 55% at 50% 22%, #000, transparent 72%);
  mask-image: radial-gradient(ellipse 72% 55% at 50% 22%, #000, transparent 72%);
`;
const Inner = styled.div`position: relative; z-index: 1; max-width: 1120px; margin: 0 auto; padding: 0 24px 90px;`;

export default function LandingPage() {
  return (
    <div style={fontVars}>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={HREF} />
      <Canvas>
        <Bg>
          <MeshBackground />
          <Grid />
        </Bg>
        <Inner>
          <Hero />
          <Explainer />
          <Showcase />
          <LandingSections />
        </Inner>
      </Canvas>
    </div>
  );
}
