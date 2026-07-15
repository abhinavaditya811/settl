"use client";

// Public landing page (/). Cinematic "Mission Control": one living, scroll-reactive
// background behind the whole page, a hero, a scrollytelling "follow one invoice"
// scene, the voice USP, then the rest. Font loading is inlined (no separate layout).

import type { CSSProperties } from "react";
import styled from "styled-components";
import { motion, useScroll, useSpring } from "framer-motion";
import { c } from "@/components/landing/palette";
import LivingBackground from "@/components/landing/LivingBackground";
import Hero from "@/components/landing/Hero";
import InvoiceJourney from "@/components/landing/InvoiceJourney";
import VoiceHighlight from "@/components/landing/VoiceHighlight";
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
  overflow-x: clip; /* the aurora/spotlight can overflow; clip is sticky-safe unlike hidden */
  background: ${c.bg};
  color: ${c.ink};
  font-family: ${c.body};
  -webkit-font-smoothing: antialiased;
`;
const Inner = styled.div`position: relative; z-index: 1; max-width: 1120px; margin: 0 auto; padding: 0 24px 90px;`;
const Progress = styled(motion.div)`
  position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 100; transform-origin: 0%;
  background: linear-gradient(90deg, ${c.accent2}, ${c.accent});
  box-shadow: 0 0 12px rgba(109, 94, 246, 0.6);
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
      <Canvas>
        <ScrollProgress />
        <LivingBackground />
        <Inner>
          <Hero />
          <InvoiceJourney />
          <VoiceHighlight />
          <Explainer />
          <Showcase />
          <LandingSections />
        </Inner>
      </Canvas>
    </div>
  );
}
