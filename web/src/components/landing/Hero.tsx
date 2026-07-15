"use client";

// "Mission Control" hero — says exactly what Settl is, leads with outcome metrics,
// and shows the live product console. Elevated interaction layer: a cursor-following
// spotlight, a drifting aurora, magnetic CTAs, and a 3D console that tilts with a
// glare tracking the mouse. All framer-motion + CSS 3D — no heavy WebGL dependency.

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  motion, AnimatePresence, useMotionValue, useSpring, useTransform,
  useMotionTemplate, type Variants,
} from "framer-motion";
import { c, glass, tele } from "./palette";

const money = (n: number) => "$" + Math.round(n).toLocaleString();
const pulse = keyframes`0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(70,211,154,.5)}50%{opacity:.5;box-shadow:0 0 0 5px rgba(70,211,154,0)}`;
const shine = keyframes`to{background-position:200% center}`;
const scan = keyframes`0%{transform:translateX(-100%)}100%{transform:translateX(100%)}`;
const aurora = keyframes`0%{transform:translate(-5%,-3%) rotate(0deg)}50%{transform:translate(5%,3%) rotate(7deg)}100%{transform:translate(-5%,-3%) rotate(0deg)}`;

const Nav = styled(motion.nav)`
  display: flex; align-items: center; justify-content: space-between;
  ${glass}; border-radius: 14px; padding: 10px 14px 10px 16px; margin-top: 20px;
  position: relative; z-index: 3;
  .brand { display: flex; align-items: center; gap: 11px; }
  .logo { width: 36px; height: 36px; border-radius: 11px; background: linear-gradient(135deg, ${c.accent2}, ${c.accent}); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 22px rgba(109,94,246,.55), inset 0 1px 0 rgba(255,255,255,.35); }
  .name { font-size: 20px; font-weight: 700; font-family: ${c.display}; letter-spacing: -0.03em; }
  .name .dot { color: ${c.accent2}; }
  .links { display: flex; align-items: center; gap: 26px; @media (max-width: 720px) { display: none; } }
  .lk { position: relative; font-size: 13px; color: ${c.muted}; cursor: pointer; background: none; border: none; font-family: ${c.body}; padding: 2px 0;
    &:hover { color: ${c.ink}; }
    &::after { content: ""; position: absolute; left: 0; right: 0; bottom: -3px; height: 1.5px; background: ${c.accent2}; transform: scaleX(0); transform-origin: left; transition: transform 0.25s ease; }
    &:hover::after { transform: scaleX(1); } }
  .actions { display: flex; align-items: center; gap: 8px; }
`;
const Cta = styled.button<{ $primary?: boolean }>`
  font-size: 13.5px; padding: 9px 16px; border-radius: 9px; cursor: pointer; font-weight: 600; font-family: ${c.body};
  border: 1px solid ${({ $primary }) => ($primary ? "transparent" : c.glassBorder)};
  background: ${({ $primary }) => ($primary ? c.accent : "rgba(255,255,255,0.04)")};
  color: ${c.ink}; box-shadow: ${({ $primary }) => ($primary ? "0 0 26px rgba(109,94,246,.5)" : "none")};
  transition: filter 0.2s ease, box-shadow 0.2s ease;
  &:hover { filter: brightness(1.08); box-shadow: ${({ $primary }) => ($primary ? "0 0 40px rgba(109,94,246,.7)" : "0 0 22px rgba(155,140,255,.25)")}; }
`;
const Hero = styled.section`position: relative; text-align: center; padding: 70px 0 8px; z-index: 1;`;
const Aurora = styled.div`
  position: absolute; inset: -140px -10% auto; height: 680px; z-index: 0; pointer-events: none;
  filter: blur(64px); opacity: 0.55;
  background:
    radial-gradient(380px 260px at 28% 30%, rgba(109,94,246,0.55), transparent 60%),
    radial-gradient(340px 240px at 72% 38%, rgba(155,140,255,0.4), transparent 60%),
    radial-gradient(300px 220px at 52% 72%, rgba(70,211,154,0.16), transparent 60%);
  animation: ${aurora} 15s ease-in-out infinite;
`;
const Spotlight = styled(motion.div)`position: absolute; inset: 0; z-index: 0; pointer-events: none;`;
const Content = styled.div`position: relative; z-index: 1;`;
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
  { id: 1, in: "SR", fg: c.ok, bg: c.okBg, text: "Firm reminder sent to Summit Roofing", tag: "SENT" },
  { id: 2, in: "BS", fg: c.warn, bg: c.warnBg, text: "Held for approval: Brightline Studio", tag: "NEEDS YOU" },
  { id: 3, in: "CC", fg: c.bad, bg: c.badBg, text: "Paused: Cedar & Co disputed", tag: "ESCALATED" },
  { id: 4, in: "NL", fg: c.ok, bg: c.okBg, text: "Reminder delivered to Northwind", tag: "SENT" },
  { id: 5, in: "HF", fg: c.ok, bg: c.okBg, text: "Marked paid: Harbor Freight", tag: "RECOVERED" },
  { id: 6, in: "AM", fg: c.ok, bg: c.okBg, text: "Final notice sent to Atlas Mechanical", tag: "SENT" },
];
const cont: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const item: Variants = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 0.7, 0.2, 1] } } };

// A button/element that gently pulls toward the cursor, then springs back.
function Magnetic({ children, strength = 0.4 }: { children: React.ReactNode; strength?: number }) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 15 });
  const sy = useSpring(y, { stiffness: 220, damping: 15 });
  return (
    <motion.span
      style={{ x: sx, y: sy, display: "inline-block" }}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * strength); y.set((e.clientY - r.top - r.height / 2) * strength); }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >{children}</motion.span>
  );
}

// The product console, tilting in 3D toward the cursor with a glare that tracks it.
function Tilt({ children }: { children: React.ReactNode }) {
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [5.5, -5.5]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-6.5, 6.5]), { stiffness: 120, damping: 18 });
  const gx = useTransform(mx, [-0.5, 0.5], ["12%", "88%"]);
  const gy = useTransform(my, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(380px circle at ${gx} ${gy}, rgba(255,255,255,0.14), transparent 45%)`;
  return (
    <motion.div
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1300, transformStyle: "preserve-3d", marginTop: 52 }}
      initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 0.7, 0.2, 1] }}
    >
      <div style={{ position: "relative" }}>
        {children}
        <motion.div style={{ position: "absolute", inset: 0, borderRadius: 18, background: glare, pointerEvents: "none", mixBlendMode: "soft-light" }} />
      </div>
    </motion.div>
  );
}

export default function HeroSection() {
  const [val, setVal] = useState(0);
  const [tick, setTick] = useState(0);
  const px = useMotionValue(-500), py = useMotionValue(-500);
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${px}px ${py}px, rgba(109,94,246,0.16), transparent 62%)`;
  useEffect(() => {
    let raf = 0, t0 = 0;
    const step = (t: number) => { if (!t0) t0 = t; const p = Math.min((t - t0) / 1300, 1); setVal(Math.round(45970 * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    const id = setInterval(() => setTick((x) => x + 1), 2600);
    return () => { cancelAnimationFrame(raf); clearInterval(id); };
  }, []);
  const visible = [0, 1, 2, 3].map((i) => POOL[(tick + i) % POOL.length]);
  const bars = [{ w: "62%", col: c.accent }, { w: "100%", col: c.warn }, { w: "48%", col: c.bad }];
  const go = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const open = () => (window.location.href = "/signin");
  const demo = () => (window.location.href = "/demo");

  return (
    <>
      <Nav initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 0.7, 0.2, 1] }}>
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </span>
          <span className="name">Settl<span className="dot">.</span></span>
        </div>
        <div className="links">
          <button className="lk" onClick={go("how")}>How it works</button>
          <button className="lk" onClick={go("voice")}>Voice</button>
          <button className="lk" onClick={go("console")}>Console</button>
          <button className="lk" onClick={go("safety")}>Safety</button>
          <button className="lk" onClick={go("pricing")}>Pricing</button>
        </div>
        <div className="actions">
          <Magnetic><Cta onClick={demo}>Watch demo</Cta></Magnetic>
          <Magnetic><Cta $primary onClick={open}>Open dashboard</Cta></Magnetic>
        </div>
      </Nav>

      <Hero
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); px.set(e.clientX - r.left); py.set(e.clientY - r.top); }}
        onMouseLeave={() => { px.set(-500); py.set(-500); }}
      >
        <Aurora aria-hidden="true" />
        <Spotlight style={{ background: spotlight }} aria-hidden="true" />
        <Content>
          <motion.div variants={cont} initial="hidden" animate="show">
            <motion.div variants={item}><Eyebrow>// autonomous AR engine · AI invoice collections</Eyebrow></motion.div>
            <motion.div variants={item}><H1>Get your overdue invoices paid, <span className="shine">automatically.</span></H1></motion.div>
            <motion.div variants={item}><Sub>Settl is an autonomous agent for B2B receivables. It decides when and how to chase every overdue invoice, drafts the message in your voice, and clears a hard compliance gate before anything goes out. You only approve the first one.</Sub></motion.div>
            <motion.div variants={item}>
              <Metrics>
                <Chip><b>31 → 19</b><span>days to pay</span></Chip>
                <Chip><b>~14 hrs</b><span>saved / week</span></Chip>
                <Chip><b>0</b><span>unsafe messages, ever</span></Chip>
              </Metrics>
            </motion.div>
            <motion.div variants={item}><Row>
              <Magnetic><Cta $primary onClick={open}>Open your dashboard</Cta></Magnetic>
              <Magnetic><Cta onClick={demo}>See it work →</Cta></Magnetic>
            </Row></motion.div>
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
        </Content>
      </Hero>
    </>
  );
}
