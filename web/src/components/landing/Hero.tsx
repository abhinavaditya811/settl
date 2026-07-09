"use client";

// "Mission Control" hero — rebuilt for clarity: says exactly what Settl is, leads
// with outcome metrics, and shows the live product console (telemetry, money
// counting up, a self-cycling feed, cursor parallax). Upgraded nav + more motion.

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { c, glass, tele } from "./palette";

const money = (n: number) => "$" + Math.round(n).toLocaleString();
const pulse = keyframes`0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(70,211,154,.5)}50%{opacity:.5;box-shadow:0 0 0 5px rgba(70,211,154,0)}`;
const shine = keyframes`to{background-position:200% center}`;
const scan = keyframes`0%{transform:translateX(-100%)}100%{transform:translateX(100%)}`;

const Nav = styled(motion.nav)`
  display: flex; align-items: center; justify-content: space-between;
  ${glass}; border-radius: 14px; padding: 10px 14px 10px 16px; margin-top: 20px;
  .brand { display: flex; align-items: center; gap: 9px; }
  .logo { width: 26px; height: 26px; border-radius: 7px; background: ${c.accent}; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-family: ${c.display}; box-shadow: 0 0 18px rgba(109,94,246,.55); }
  .name { font-size: 15.5px; font-weight: 700; font-family: ${c.display}; }
  .links { display: flex; align-items: center; gap: 22px; @media (max-width: 720px) { display: none; } }
  .lk { font-size: 13px; color: ${c.muted}; cursor: pointer; &:hover { color: ${c.ink}; } }
  .actions { display: flex; align-items: center; gap: 8px; }
`;
const Cta = styled.button<{ $primary?: boolean }>`
  font-size: 13.5px; padding: 9px 16px; border-radius: 9px; cursor: pointer; font-weight: 600; font-family: ${c.body};
  border: 1px solid ${({ $primary }) => ($primary ? "transparent" : c.glassBorder)};
  background: ${({ $primary }) => ($primary ? c.accent : "rgba(255,255,255,0.04)")};
  color: ${c.ink}; box-shadow: ${({ $primary }) => ($primary ? "0 0 26px rgba(109,94,246,.5)" : "none")};
  &:hover { filter: brightness(1.08); }
`;
const Hero = styled.section`text-align: center; padding: 70px 0 8px;`;
const Eyebrow = styled.div`${tele}; color: ${c.accent2}; margin-bottom: 20px;`;
const H1 = styled.h1`
  font-family: ${c.display}; font-size: clamp(46px, 8vw, 84px); line-height: 0.96;
  letter-spacing: -0.045em; font-weight: 700; margin: 0 auto; max-width: 16ch;
  .shine { background: linear-gradient(90deg, ${c.accent2}, ${c.accent}, ${c.accent2}); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: ${shine} 6s linear infinite; }
`;
const Sub = styled.p`font-size: 17px; line-height: 1.6; color: ${c.muted}; max-width: 58ch; margin: 24px auto 0;`;
const Metrics = styled.div`display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 24px;`;
const Chip = styled.div`${glass}; border-radius: 999px; padding: 7px 15px; font-size: 13px; display: flex; align-items: center; gap: 8px; b { font-family: ${c.display}; color: ${c.ink}; font-weight: 600; } span { color: ${c.muted}; }`;
const Row = styled.div`display: flex; gap: 12px; justify-content: center; margin-top: 28px; flex-wrap: wrap;`;
const Trust = styled.div`${tele}; margin-top: 22px; color: ${c.faint};`;

const Console = styled.div`${glass}; border-radius: 18px; overflow: hidden; text-align: left; position: relative;`;
const Scan = styled.div`position: absolute; top: 0; left: 0; right: 0; height: 1px; overflow: hidden; div { height: 100%; width: 40%; background: linear-gradient(90deg, transparent, ${c.accent2}, transparent); animation: ${scan} 4.5s ease-in-out infinite; }`;
const TBar = styled.div`display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid ${c.line}; background: rgba(255,255,255,0.02); .l { display: flex; align-items: center; gap: 9px; ${tele}; color: ${c.muted}; } .live { width: 8px; height: 8px; border-radius: 50%; background: ${c.ok}; animation: ${pulse} 1.8s ease-in-out infinite; } .r { ${tele}; }`;
const Cgrid = styled.div`display: grid; grid-template-columns: 0.85fr 1.15fr; @media (max-width: 720px) { grid-template-columns: 1fr; }`;
const Stats = styled.div`padding: 24px; border-right: 1px solid ${c.line}; @media (max-width: 720px) { border-right: none; border-bottom: 1px solid ${c.line}; }`;
const MV = styled.div`font-family: ${c.display}; font-size: 44px; font-weight: 700; letter-spacing: -0.03em; color: ${c.ink}; margin-top: 4px;`;
const Bars = styled.div`margin-top: 22px; display: flex; flex-direction: column; gap: 9px;`;
const Bar = styled.div`height: 7px; border-radius: 99px; background: rgba(255,255,255,0.06); overflow: hidden; div { height: 100%; border-radius: 99px; }`;
const FeedWrap = styled.div`padding: 18px 20px;`;
const FRow = styled(motion.div)`display: flex; align-items: center; gap: 11px; padding: 10px 0; font-size: 13.5px; color: ${c.ink};`;
const Av = styled.span<{ $fg: string; $bg: string }>`width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 700; flex-shrink: 0; color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};`;
const Tag = styled.span<{ $fg: string; $bg: string }>`margin-left: auto; font-family: ${c.mono}; font-size: 10.5px; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 6px; color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};`;
const Lbl = styled.div`${tele};`;

const POOL = [
  { id: 1, in: "SR", fg: c.ok, bg: c.okBg, text: "Firm reminder sent — Summit Roofing", tag: "SENT" },
  { id: 2, in: "BS", fg: c.warn, bg: c.warnBg, text: "Held for approval — Brightline Studio", tag: "NEEDS YOU" },
  { id: 3, in: "CC", fg: c.bad, bg: c.badBg, text: "Paused — Cedar & Co disputed", tag: "ESCALATED" },
  { id: 4, in: "NL", fg: c.ok, bg: c.okBg, text: "Reminder delivered — Northwind", tag: "SENT" },
  { id: 5, in: "HF", fg: c.ok, bg: c.okBg, text: "Marked paid — Harbor Freight", tag: "RECOVERED" },
  { id: 6, in: "AM", fg: c.ok, bg: c.okBg, text: "Final notice sent — Atlas Mechanical", tag: "SENT" },
];
const cont = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 0.7, 0.2, 1] } } };

function Tilt({ children }: { children: React.ReactNode }) {
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [3.5, -3.5]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-4.5, 4.5]), { stiffness: 120, damping: 18 });
  return (
    <motion.div
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1300, marginTop: 52 }}
      initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 0.7, 0.2, 1] }}
    >{children}</motion.div>
  );
}

export default function HeroSection() {
  const [val, setVal] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf = 0, t0 = 0;
    const step = (t: number) => { if (!t0) t0 = t; const p = Math.min((t - t0) / 1300, 1); setVal(Math.round(45970 * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    const id = setInterval(() => setTick((x) => x + 1), 2600);
    return () => { cancelAnimationFrame(raf); clearInterval(id); };
  }, []);
  const visible = [0, 1, 2, 3].map((i) => POOL[(tick + i) % POOL.length]);
  const bars = [{ w: "62%", col: c.accent }, { w: "100%", col: c.warn }, { w: "48%", col: c.bad }];

  return (
    <>
      <Nav initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 0.7, 0.2, 1] }}>
        <div className="brand"><span className="logo" aria-hidden="true">S</span><span className="name">Settl</span></div>
        <div className="links"><span className="lk">How it works</span><span className="lk">Console</span><span className="lk">Safety</span><span className="lk">Pricing</span></div>
        <div className="actions"><Cta onClick={() => (window.location.href = "/preview")}>Watch demo</Cta><Cta $primary onClick={() => (window.location.href = "/preview")}>Open dashboard</Cta></div>
      </Nav>

      <Hero>
        <motion.div variants={cont} initial="hidden" animate="show">
          <motion.div variants={item}><Eyebrow>// autonomous AR engine · AI invoice collections</Eyebrow></motion.div>
          <motion.div variants={item}><H1>Get your overdue invoices paid — <span className="shine">automatically.</span></H1></motion.div>
          <motion.div variants={item}><Sub>Settl is an autonomous agent for B2B receivables. It decides when and how to chase every overdue invoice, drafts the message in your voice, and clears a hard compliance gate before sending — you only approve the first one.</Sub></motion.div>
          <motion.div variants={item}>
            <Metrics>
              <Chip><b>31 → 19</b><span>days to pay</span></Chip>
              <Chip><b>~14 hrs</b><span>saved / week</span></Chip>
              <Chip><b>0</b><span>unsafe messages, ever</span></Chip>
            </Metrics>
          </motion.div>
          <motion.div variants={item}><Row><Cta $primary onClick={() => (window.location.href = "/preview")}>Open your dashboard</Cta><Cta onClick={() => (window.location.href = "/preview")}>See it work →</Cta></Row></motion.div>
          <motion.div variants={item}><Trust>B2B only · never custodial · paid through your own processor</Trust></motion.div>
        </motion.div>

        <Tilt>
          <Console>
            <Scan><div /></Scan>
            <TBar>
              <div className="l"><span className="live" />settl engine · live</div>
              <div className="r">agent: active · gate: armed</div>
            </TBar>
            <Cgrid>
              <Stats>
                <Lbl>money in motion</Lbl>
                <MV>{money(val)}</MV>
                <div style={{ fontSize: 12.5, color: c.ok, marginTop: 4 }}>+$1,410 recovered today</div>
                <Lbl style={{ marginTop: 22 }}>overdue by age</Lbl>
                <Bars>{bars.map((b, i) => (<Bar key={i}><motion.div initial={{ width: 0 }} animate={{ width: b.w }} transition={{ duration: 1, delay: 0.8 + i * 0.12 }} style={{ background: b.col }} /></Bar>))}</Bars>
              </Stats>
              <FeedWrap>
                <Lbl style={{ marginBottom: 4 }}>live activity</Lbl>
                <AnimatePresence initial={false} mode="popLayout">
                  {visible.map((e) => (
                    <FRow key={e.id} layout initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.4 }}>
                      <Av $fg={e.fg} $bg={e.bg}>{e.in}</Av>{e.text}<Tag $fg={e.fg} $bg={e.bg}>{e.tag}</Tag>
                    </FRow>
                  ))}
                </AnimatePresence>
              </FeedWrap>
            </Cgrid>
          </Console>
        </Tilt>
      </Hero>
    </>
  );
}
