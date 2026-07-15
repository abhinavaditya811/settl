"use client";

// One continuous living background for the WHOLE page (fixed, behind everything).
// A drifting canvas mesh for texture + a scroll-reactive dual-gradient whose hue
// shifts per narrative beat (violet hero → green at "recovered" → red at "the gate"
// → back to violet) + a faint masked grid. This is what kills the purple-then-black
// feel: the field is one fixed surface every section sits on. Build-safe (no WebGL).

import styled from "styled-components";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import MeshBackground from "./MeshBackground";

const Fixed = styled.div`
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
`;
const Grid = styled.div`
  position: absolute; inset: 0; opacity: 0.32;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 60px 60px;
  -webkit-mask-image: radial-gradient(ellipse 85% 65% at 50% 38%, #000, transparent 82%);
  mask-image: radial-gradient(ellipse 85% 65% at 50% 38%, #000, transparent 82%);
`;

// Scroll beats: 0 hero · 0.32 pipeline · 0.58 recovered · 0.80 the gate · 1 close.
const STOPS = [0, 0.32, 0.58, 0.8, 1];
const LAYER_A = [
  "rgba(109,94,246,0.34)", "rgba(123,108,255,0.30)", "rgba(70,211,154,0.24)",
  "rgba(255,107,107,0.20)", "rgba(109,94,246,0.30)",
];
const LAYER_B = [
  "rgba(70,110,230,0.22)", "rgba(155,140,255,0.22)", "rgba(46,200,160,0.18)",
  "rgba(232,120,120,0.16)", "rgba(109,94,246,0.20)",
];

export default function LivingBackground() {
  const { scrollYProgress } = useScroll();
  const a = useTransform(scrollYProgress, STOPS, LAYER_A);
  const b = useTransform(scrollYProgress, STOPS, LAYER_B);
  const bg = useMotionTemplate`
    radial-gradient(1100px 820px at 16% 8%, ${a}, transparent 56%),
    radial-gradient(1000px 780px at 84% 84%, ${b}, transparent 56%)`;
  return (
    <Fixed aria-hidden="true">
      <MeshBackground />
      <motion.div style={{ position: "absolute", inset: 0, background: bg }} />
      <Grid />
    </Fixed>
  );
}
