"use client";

// A short first-visit ledger stamp. It never delays repeat visits and respects reduced
// motion; the page itself remains the experience rather than a long boot sequence.

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { c, tele } from "./palette";

const LINES = ["loading recovery ledger", "recovery path ready"];
const MAX_HOLD = 900;
const MIN_HOLD = 240;

const spin = keyframes`to { transform: rotate(360deg); }`;

const Overlay = styled(motion.div)`
  position: fixed; inset: 0; z-index: 9999;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  background: ${c.bgDeep};
  overflow: hidden;
`;
// A faint sweeping halo behind the mark, for depth.
const Halo = styled.div`
  position: absolute; width: 360px; height: 360px; border-radius: 50%; pointer-events: none;
  background: conic-gradient(from 0deg, transparent, rgba(167,156,247,0.16), transparent 40%);
  filter: blur(42px); opacity: 0.65; animation: ${spin} 3.4s linear infinite;
`;
const Badge = styled(motion.div)`
  position: relative; width: 84px; height: 84px; border-radius: 23px;
  background: ${c.surfaceRaised}; border: 1px solid ${c.lineStrong};
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 22px 64px rgba(109,94,246,0.55), inset 0 1px 0 rgba(255,255,255,0.35);
`;
const Word = styled(motion.div)`
  font-family: ${c.display}; font-size: 30px; font-weight: 700; letter-spacing: -0.03em; color: ${c.ink};
  .dot { color: ${c.accent2}; }
`;
const Line = styled.div`${tele}; height: 16px; display: flex; align-items: center;`;
const Track = styled.div`width: 190px; height: 3px; border-radius: 99px; background: rgba(255,255,255,0.09); overflow: hidden;`;
const Fill = styled(motion.div)`height: 100%; border-radius: 99px; background: linear-gradient(90deg, ${c.accent2}, ${c.accent});`;

export default function Preloader() {
  const [show, setShow] = useState(true);
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    // Play once per browser session: after the first boot, later visits (e.g. coming
    // back to home from /demo) skip straight to the page instead of replaying.
    if (typeof window !== "undefined" && window.sessionStorage.getItem("settl_booted")) {
      setShow(false);
      return;
    }
    if (reduce) {
      setShow(false);
      return;
    }
    window.sessionStorage?.setItem("settl_booted", "1");
    let cancelled = false;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();
    const maximum = new Promise<void>((resolve) => setTimeout(resolve, MAX_HOLD));
    const fonts = document.fonts?.ready ?? Promise.resolve();
    Promise.race([fonts, maximum]).then(() => {
      const remaining = Math.max(0, MIN_HOLD - (performance.now() - started));
      finishTimer = setTimeout(() => {
        if (cancelled) return;
        setStep(1);
        exitTimer = setTimeout(() => setShow(false), 180);
      }, remaining);
    });
    return () => {
      cancelled = true;
      if (finishTimer) clearTimeout(finishTimer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [reduce]);

  const last = step === LINES.length - 1;

  return (
    <AnimatePresence>
      {show && (
        <Overlay
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
        >
          <Halo aria-hidden="true" />
          <Badge initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: [0.22, 0.7, 0.2, 1] }}>
            <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <motion.polyline points="1 4 1 10 7 10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: "easeInOut" }} />
              <motion.path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, delay: 0.4, ease: "easeInOut" }} />
            </svg>
          </Badge>

          <Word initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
            Settl<span className="dot">.</span>
          </Word>

          <Line>
            <AnimatePresence mode="wait">
              <motion.span
                key={step}
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.28 }}
                style={{ color: last ? c.ok : c.muted }}
              >
                {LINES[step]}
              </motion.span>
            </AnimatePresence>
          </Line>

          <Track>
            <Fill initial={{ width: 0 }} animate={{ width: step ? "100%" : "72%" }} transition={{ duration: step ? .16 : .65, ease: [0.4, 0, 0.2, 1] }} />
          </Track>
        </Overlay>
      )}
    </AnimatePresence>
  );
}
