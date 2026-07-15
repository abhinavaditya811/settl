"use client";

// The signature scrollytelling scene: follow ONE overdue invoice through the whole
// agent. A tall section with a pinned (sticky) viewport; as you scroll, the stage
// advances (ingest → strategy → draft → gate → sent → paid), the rail fills, the
// headline swaps, and the invoice card morphs its status + accent. Scroll-driven,
// build-safe (framer-motion useScroll + a sticky panel; no WebGL).

import { useRef, useState } from "react";
import styled from "styled-components";
import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { c, glass, tele } from "./palette";

type Stage = {
  key: string; n: string; label: string; head: string; desc: string;
  pill: string; fg: string; bg: string;
};
const V = c.accent2, VB = "rgba(155,140,255,0.15)";
const G = c.ok, GB = c.okBg;
const STAGES: Stage[] = [
  { key: "ingest", n: "01", label: "Ingest", fg: V, bg: VB, pill: "NORMALIZED",
    head: "It reads the invoice.", desc: "Pulled from Stripe or a CSV into one clean, canonical shape. The agent never touches a raw source file." },
  { key: "strategy", n: "02", label: "Strategy", fg: V, bg: VB, pill: "CHASE · FIRM",
    head: "It decides the move.", desc: "How overdue, what tone, which channel. This one is 21 days out, so the call is a firm reminder by email." },
  { key: "draft", n: "03", label: "Draft", fg: V, bg: VB, pill: "DRAFTED",
    head: "It writes in your voice.", desc: "Gemini drafts the reminder in your business's tone. Warm, clear, and never robotic." },
  { key: "gate", n: "04", label: "Compliance gate", fg: G, bg: GB, pill: "GATE · PASSED",
    head: "It clears the hard line.", desc: "Every draft hits a deterministic gate: no legal threats, no consumer debt, no disputes. This one is clean." },
  { key: "send", n: "05", label: "Send", fg: G, bg: GB, pill: "SENT",
    head: "It sends. You approved the first.", desc: "Out from your own mailbox with the real payment link. First contact waited for your one tap." },
  { key: "paid", n: "06", label: "Recovered", fg: G, bg: GB, pill: "PAID",
    head: "You get paid.", desc: "Payment detected and reconciled automatically. Days-to-pay dropped from 31 to 19, and you did nothing." },
];

const Tall = styled.div`position: relative; height: ${STAGES.length * 55}vh;`;
const Pin = styled.div`position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; overflow: hidden;`;
const Ghost = styled.div`
  position: absolute; right: 1%; top: 50%; transform: translateY(-50%); z-index: 0; pointer-events: none; user-select: none;
  font-family: ${c.display}; font-weight: 700; line-height: 1; font-size: clamp(220px, 36vw, 500px);
  color: rgba(255, 255, 255, 0.035);
  @media (max-width: 760px) { display: none; }
`;
const Kicker = styled.div`${tele}; color: ${c.accent2}; text-align: center; margin-bottom: 30px;`;
const Grid = styled.div`
  position: relative; z-index: 1;
  display: grid; grid-template-columns: 250px 1fr; gap: 56px; align-items: center; max-width: 1000px; margin: 0 auto; width: 100%;
  @media (max-width: 760px) { grid-template-columns: 1fr; gap: 30px; }
`;

const Rail = styled.div`position: relative; padding-left: 26px; @media (max-width: 760px) { display: none; }`;
const RailLine = styled.div`position: absolute; left: 5px; top: 6px; bottom: 6px; width: 2px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;`;
const RailFill = styled(motion.div)`position: absolute; left: 0; top: 0; width: 100%; background: linear-gradient(${c.accent2}, ${c.ok}); border-radius: 2px;`;
const RailItem = styled.div<{ $on: boolean }>`
  position: relative; display: flex; align-items: center; gap: 12px; padding: 11px 0;
  color: ${({ $on }) => ($on ? c.ink : c.faint)}; transition: color 0.3s ease;
  .dot { position: absolute; left: -26px; width: 12px; height: 12px; border-radius: 50%; background: ${({ $on }) => ($on ? c.accent2 : "rgba(255,255,255,0.14)")}; box-shadow: ${({ $on }) => ($on ? `0 0 0 4px rgba(109,94,246,0.18)` : "none")}; transition: all 0.3s ease; }
  .n { font-family: ${c.mono}; font-size: 11px; color: ${c.faint}; }
  .l { font-family: ${c.display}; font-size: 14px; font-weight: 600; }
`;

const Right = styled.div``;
const Head = styled.div`font-family: ${c.display}; font-size: clamp(34px, 5.2vw, 60px); font-weight: 700; letter-spacing: -0.04em; line-height: 1.0; color: ${c.ink};`;
const Desc = styled.div`font-size: 17px; line-height: 1.6; color: ${c.muted}; margin-top: 16px; max-width: 48ch; min-height: 82px;`;

const Card = styled(motion.div)<{ $fg: string }>`
  ${glass}; border-radius: 18px; padding: 26px 28px; margin-top: 30px; max-width: 470px;
  border-color: ${({ $fg }) => $fg}55; box-shadow: 0 24px 60px rgba(0,0,0,0.45), 0 0 46px ${({ $fg }) => $fg}22;
  transition: border-color 0.5s ease, box-shadow 0.5s ease;
  .row { display: flex; align-items: center; justify-content: space-between; }
  .id { font-family: ${c.mono}; font-size: 12.5px; color: ${c.muted}; letter-spacing: 0.06em; }
  .amt { font-family: ${c.display}; font-size: 48px; font-weight: 700; letter-spacing: -0.03em; margin-top: 14px; color: ${c.ink}; }
  .meta { font-size: 13.5px; color: ${c.faint}; margin-top: 6px; }
  .track { height: 7px; border-radius: 99px; background: rgba(255,255,255,0.07); margin-top: 20px; overflow: hidden; }
`;
const Pill = styled.span<{ $fg: string; $bg: string }>`font-family: ${c.mono}; font-size: 11px; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 7px; color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg}; white-space: nowrap;`;

export default function InvoiceJourney() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [stage, setStage] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setStage(Math.max(0, Math.min(STAGES.length - 1, Math.floor(v * STAGES.length))));
  });
  const fillH = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const s = STAGES[stage];

  return (
    <Tall ref={ref}>
      <Pin>
        <Ghost aria-hidden="true">{s.n}</Ghost>
        <Kicker>// watch the agent work · one invoice, start to paid</Kicker>
        <Grid>
          <Rail>
            <RailLine><RailFill style={{ height: fillH }} /></RailLine>
            {STAGES.map((st, i) => (
              <RailItem key={st.key} $on={i <= stage}>
                <span className="dot" />
                <span className="n">{st.n}</span><span className="l">{st.label}</span>
              </RailItem>
            ))}
          </Rail>

          <Right>
            <AnimatePresence mode="wait">
              <motion.div key={s.key}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.22, 0.7, 0.2, 1] }}>
                <Head>{s.head}</Head>
                <Desc>{s.desc}</Desc>
              </motion.div>
            </AnimatePresence>

            <Card $fg={s.fg}>
              <div className="row">
                <span className="id">INV-012 · Atlas Mechanical</span>
                <AnimatePresence mode="wait">
                  <motion.span key={s.pill}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}>
                    <Pill $fg={s.fg} $bg={s.bg}>{s.pill}</Pill>
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="amt">$6,800</div>
              <div className="meta">B2B · 21 days overdue</div>
              <div className="track">
                <motion.div
                  animate={{ width: `${((stage + 1) / STAGES.length) * 100}%`, background: s.fg }}
                  transition={{ duration: 0.5, ease: [0.22, 0.7, 0.2, 1] }}
                  style={{ height: "100%", borderRadius: 99 }}
                />
              </div>
            </Card>
          </Right>
        </Grid>
      </Pin>
    </Tall>
  );
}
