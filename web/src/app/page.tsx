"use client";

// Public landing page (/). "Operational Ledger": one recovery path expressed through
// product surfaces, a scroll-driven invoice journey, and the interactive voice demo.

import type { CSSProperties } from "react";
import styled from "styled-components";
import { MotionConfig, motion, useScroll, useSpring } from "framer-motion";
import { c } from "@/components/landing/palette";
import RecoveryPrelude from "@/components/landing/RecoveryPrelude";
import RecoveryStory from "@/components/landing/RecoveryStory";
import RecoveryProofs from "@/components/landing/RecoveryProofs";
import RecoveryClose from "@/components/landing/RecoveryClose";

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
  overflow-x: clip;
  background: ${c.bg};
  color: ${c.ink};
  font-family: ${c.body};
  -webkit-font-smoothing: antialiased;
  *, *::before, *::after { box-sizing: border-box; }
  ::selection { background: rgba(167,156,247,.28); color: ${c.ink}; }
  button, a { -webkit-tap-highlight-color: transparent; }
  button:focus-visible, a:focus-visible { outline: 2px solid ${c.accent2}; outline-offset: 3px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
`;
const Progress = styled(motion.div)`
  position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 100; transform-origin: 0%;
  background: linear-gradient(90deg, ${c.accent2}, ${c.ok});
`;

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 130, damping: 30, restDelta: 0.001 });
  return <Progress style={{ scaleX }} aria-hidden="true" />;
}

export default function LandingPage() {
  return (
    <div style={fontVars}>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={HREF} />
      <MotionConfig reducedMotion="user">
        <Canvas>
          <ScrollProgress />
          <RecoveryPrelude />
          <RecoveryStory />
          <RecoveryProofs />
          <RecoveryClose />
        </Canvas>
      </MotionConfig>
    </div>
  );
}
