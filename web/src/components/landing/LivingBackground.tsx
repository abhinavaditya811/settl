"use client";

// One restrained ledger field behind the whole page. Scroll-reactive color marks the
// invoice's state while fixed rules give every section the same visual coordinate system.

import styled from "styled-components";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";

const Fixed = styled.div`
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
`;
const Grid = styled.div`
  position: absolute; inset: 0; opacity: 0.42;
  background-image:
    linear-gradient(rgba(240,237,228,0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(240,237,228,0.028) 1px, transparent 1px);
  background-size: 72px 72px;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.45) 75%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.45) 75%, transparent 100%);
`;
const LedgerRule = styled.div`
  position: absolute; top: 0; bottom: 0; left: max(24px, calc(50% - 560px));
  width: 1px; background: rgba(240,237,228,0.055);
  @media (max-width: 720px) { left: 18px; }
`;

// Scroll beats: 0 hero · 0.32 pipeline · 0.58 recovered · 0.80 the gate · 1 close.
const STOPS = [0, 0.32, 0.58, 0.8, 1];
const LAYER_A = [
  "rgba(119,105,232,0.20)", "rgba(119,105,232,0.17)", "rgba(119,215,170,0.15)",
  "rgba(238,119,119,0.12)", "rgba(119,105,232,0.14)",
];
const LAYER_B = [
  "rgba(63,74,114,0.13)", "rgba(167,156,247,0.12)", "rgba(83,159,126,0.10)",
  "rgba(136,74,74,0.09)", "rgba(119,105,232,0.10)",
];

export default function LivingBackground() {
  const { scrollYProgress } = useScroll();
  const a = useTransform(scrollYProgress, STOPS, LAYER_A);
  const b = useTransform(scrollYProgress, STOPS, LAYER_B);
  const bg = useMotionTemplate`
    radial-gradient(900px 680px at 12% 5%, ${a}, transparent 62%),
    radial-gradient(900px 760px at 88% 82%, ${b}, transparent 64%)`;
  return (
    <Fixed aria-hidden="true">
      <motion.div style={{ position: "absolute", inset: 0, background: bg }} />
      <Grid />
      <LedgerRule />
    </Fixed>
  );
}
