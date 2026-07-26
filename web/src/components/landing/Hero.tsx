"use client";

// Product-first hero for the Operational Ledger direction. The recovery path is the
// brand device; the real interface remains the visual proof.

import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  motion, AnimatePresence, useMotionValue, useSpring, useTransform,
  useInView, useMotionTemplate, useMotionValueEvent, useScroll, type Variants,
} from "framer-motion";
import { c, focusRing, glass, tele } from "./palette";

const money = (n: number) => "$" + Math.round(n).toLocaleString();
const pulse = keyframes`0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(70,211,154,.5)}50%{opacity:.5;box-shadow:0 0 0 5px rgba(70,211,154,0)}`;
const scan = keyframes`0%{transform:translateX(-100%)}100%{transform:translateX(100%)}`;

const Nav = styled(motion.nav)<{ $compact: boolean }>`
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(12,13,12,.84); backdrop-filter: blur(18px); border: 1px solid ${c.line};
  border-radius: 999px; padding: ${({ $compact }) => ($compact ? "6px 8px 6px 11px" : "8px 10px 8px 13px")};
  position: sticky; top: 14px; z-index: 50; margin: 14px auto 0;
  box-shadow: 0 14px 42px rgba(0,0,0,.26);
  width: ${({ $compact }) => ($compact ? "min(100%, 820px)" : "100%")}; min-width: 0; max-width: 100%; overflow: hidden;
  transition: width .35s cubic-bezier(.22,.7,.2,1), padding .35s ease, border-color .35s ease;
  border-color: ${({ $compact }) => ($compact ? c.lineStrong : c.line)};
  .brand { display: flex; align-items: center; gap: 11px; flex-shrink: 0; }
  .logo { width: 34px; height: 34px; border-radius: 50%; background: ${c.surfaceRaised}; border: 1px solid ${c.lineStrong}; color: ${c.accent2}; display: flex; align-items: center; justify-content: center; }
  .name { font-size: 20px; font-weight: 700; font-family: ${c.display}; letter-spacing: -0.03em; }
  .name .dot { color: ${c.accent2}; }
  .links { display: flex; align-items: center; gap: ${({ $compact }) => ($compact ? "18px" : "24px")}; transition: gap .35s ease; @media (max-width: 860px) { display: none; } }
  .lk { position: relative; font-size: 13px; color: ${c.muted}; cursor: pointer; background: none; border: none; font-family: ${c.body}; padding: 2px 0;
    &:hover { color: ${c.ink}; }
    ${focusRing};
    &::after { content: ""; position: absolute; left: 0; right: 0; bottom: -3px; height: 1.5px; background: ${c.accent2}; transform: scaleX(0); transform-origin: left; transition: transform 0.25s ease; }
    &:hover::after { transform: scaleX(1); } }
  .actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  ${({ $compact }) => $compact && `.actions > span:first-child { display: none !important; }`}
  @media (max-width: 520px) {
    .actions > span:first-child { display: none !important; }
    .name { display: none; }
    .actions button { padding: 9px 13px; }
  }
`;
const Cta = styled.button<{ $primary?: boolean; $big?: boolean }>`
  ${focusRing};
  font-size: ${({ $big }) => ($big ? "15px" : "13px")}; padding: ${({ $big }) => ($big ? "14px 24px" : "9px 15px")}; border-radius: 999px; cursor: pointer; font-weight: 600; font-family: ${c.body};
  border: 1px solid ${({ $primary }) => ($primary ? "transparent" : c.glassBorder)};
  background: ${({ $primary }) => ($primary ? c.paper : "rgba(255,255,255,0.025)")};
  color: ${({ $primary }) => ($primary ? c.bgDeep : c.ink)};
  transition: filter 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
  &:hover { filter: brightness(1.05); transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,.26); }
  &:active { transform: translateY(0); }
  &:disabled { cursor:wait; opacity:.65; transform:none; }
`;
const Hero = styled.section`position: relative; width: 100%; min-width: 0; max-width: 100%; padding: 104px 0 20px; z-index: 1; @media (max-width: 760px) { padding-top: 76px; }`;
const Aurora = styled.div`
  position: absolute; inset: -100px 5% auto; height: 520px; z-index: 0; pointer-events: none;
  filter: blur(72px); opacity: 0.58;
  background: radial-gradient(ellipse at 32% 25%, rgba(119,105,232,.3), transparent 62%);
`;
const Spotlight = styled(motion.div)`position: absolute; inset: 0; z-index: 0; pointer-events: none;`;
const Content = styled.div`position: relative; z-index: 1; width: 100%; min-width: 0; max-width: 100%;`;
const HeroGrid = styled.div`
  width: 100%; min-width: 0; max-width: 100%; display: grid; grid-template-columns: minmax(0,.9fr) minmax(480px,1.1fr); gap: 54px; align-items: center;
  > * { min-width: 0; }
  @media (max-width: 980px) { grid-template-columns: minmax(0,1fr); gap: 46px; }
`;
const H1 = styled.h1`
  font-family: ${c.display}; font-size: clamp(48px, 6.2vw, 76px); line-height: .96;
  letter-spacing: -0.052em; font-weight: 600; margin: 0; max-width: 11ch;
  .shine { color: ${c.accent2}; }
  overflow-wrap: anywhere;
  @media (max-width: 520px) { font-size: clamp(42px, 12.5vw, 50px); }
`;
const Sub = styled.p`font-size: 17px; line-height: 1.65; color: ${c.muted}; width: 100%; max-width: 54ch; margin: 24px 0 0; overflow-wrap: anywhere;`;
const Metrics = styled.div`display: flex; gap: 0; flex-wrap: wrap; margin-top: 28px; border-top: 1px solid ${c.line}; border-bottom: 1px solid ${c.line};`;
const Chip = styled.div`
  padding: 13px 18px 13px 0; margin-right: 18px; font-size: 12.5px; display: flex; align-items: baseline; gap: 7px;
  b { font-family: ${c.display}; color: ${c.ink}; font-size: 18px; font-weight: 600; } span { color: ${c.muted}; }
`;
const Row = styled.div`display: flex; gap: 12px; margin-top: 28px; flex-wrap: wrap;`;
const RecoveryStrip = styled.div`
  display: grid; grid-template-columns: repeat(6,1fr); margin-bottom: 16px; position: relative;
  &::before { content:""; position:absolute; left: 4%; right: 4%; top: 8px; height:1px; background: linear-gradient(90deg,${c.accent2},${c.ok}); opacity:.55; }
  span { ${tele}; position: relative; padding-top: 20px; text-align: center; color: ${c.faint}; }
  span::before { content:""; position:absolute; top:4px; left:50%; width:8px; height:8px; border-radius:50%; background:${c.surface}; border:1px solid ${c.accent2}; transform:translateX(-50%); }
  span:last-child::before { border-color:${c.ok}; background:${c.ok}; }
  @media (max-width: 520px) { span { font-size: 8px; letter-spacing:.04em; } }
`;

const Console = styled.div`${glass}; border-radius: 20px; overflow: hidden; text-align: left; position: relative;`;
const Scan = styled.div`position: absolute; top: 0; left: 0; right: 0; height: 1px; overflow: hidden; div { height: 100%; width: 40%; background: linear-gradient(90deg, transparent, ${c.accent2}, transparent); animation: ${scan} 4.5s ease-in-out infinite; }`;
const TBar = styled.div`display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid ${c.line}; background: rgba(255,255,255,0.02); .l { display: flex; align-items: center; gap: 9px; ${tele}; color: ${c.muted}; } .live { width: 8px; height: 8px; border-radius: 50%; background: ${c.ok}; animation: ${pulse} 1.8s ease-in-out infinite; } .r { ${tele}; }`;
const Cgrid = styled.div`display: grid; grid-template-columns: 0.8fr 1.2fr; @media (max-width: 620px) { grid-template-columns: 1fr; }`;
const Stats = styled.div`padding: 24px; border-right: 1px solid ${c.line}; @media (max-width: 720px) { border-right: none; border-bottom: 1px solid ${c.line}; }`;
const MV = styled.div`font-family: ${c.display}; font-size: 44px; font-weight: 700; letter-spacing: -0.03em; color: ${c.ink}; margin-top: 4px;`;
const Bars = styled.div`margin-top: 22px; display: flex; flex-direction: column; gap: 9px;`;
const Bar = styled.div`height: 7px; border-radius: 99px; background: rgba(255,255,255,0.06); overflow: hidden; div { height: 100%; border-radius: 99px; }`;
const FeedWrap = styled.div`padding: 18px 20px;`;
const FRow = styled(motion.div)`
  display: grid; grid-template-columns: 28px minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 10px 0; font-size: 12.5px; color: ${c.ink};
  .copy { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
const Av = styled.span<{ $fg: string; $bg: string }>`width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 700; flex-shrink: 0; color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};`;
const Tag = styled.span<{ $fg: string; $bg: string }>`font-family: ${c.mono}; font-size: 9.5px; letter-spacing: 0.04em; padding: 3px 7px; border-radius: 99px; color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};`;
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
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1300, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.3, ease: [0.22, 0.7, 0.2, 1] }}
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
  const [compactNav, setCompactNav] = useState(false);
  const [navTarget, setNavTarget] = useState<"dashboard" | "demo" | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroVisible = useInView(heroRef, { margin: "180px" });
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => setCompactNav(latest > 80));
  const px = useMotionValue(-500), py = useMotionValue(-500);
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${px}px ${py}px, rgba(109,94,246,0.16), transparent 62%)`;
  useEffect(() => {
    let raf = 0, t0 = 0;
    const step = (t: number) => { if (!t0) t0 = t; const p = Math.min((t - t0) / 1300, 1); setVal(Math.round(45970 * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if (!heroVisible) return;
    const id = setInterval(() => setTick((x) => x + 1), 2600);
    return () => clearInterval(id);
  }, [heroVisible]);
  const visible = [0, 1, 2, 3].map((i) => POOL[(tick + i) % POOL.length]);
  const bars = [{ w: "62%", col: c.accent }, { w: "100%", col: c.warn }, { w: "48%", col: c.bad }];
  const go = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const navigate = (target: "dashboard" | "demo") => {
    setNavTarget(target);
    window.setTimeout(() => window.location.assign(target === "dashboard" ? "/signin" : "/demo"), 120);
  };
  const open = () => navigate("dashboard");
  const demo = () => navigate("demo");

  return (
    <>
      <Nav $compact={compactNav} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 0.7, 0.2, 1] }}>
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
          <Magnetic><Cta onClick={demo} disabled={navTarget !== null} aria-busy={navTarget === "demo"}>{navTarget === "demo" ? "Opening…" : "Watch demo"}</Cta></Magnetic>
          <Magnetic><Cta $primary onClick={open} disabled={navTarget !== null} aria-busy={navTarget === "dashboard"}>{navTarget === "dashboard" ? "Opening…" : "Open dashboard"}</Cta></Magnetic>
        </div>
      </Nav>

      <Hero
        ref={heroRef}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); px.set(e.clientX - r.left); py.set(e.clientY - r.top); }}
        onMouseLeave={() => { px.set(-500); py.set(-500); }}
      >
        <Aurora aria-hidden="true" />
        <Spotlight style={{ background: spotlight }} aria-hidden="true" />
        <Content>
          <HeroGrid>
            <motion.div variants={cont} initial="hidden" animate="show">
              <motion.div variants={item}><H1>Get your overdue invoices paid, <span className="shine">automatically.</span></H1></motion.div>
              <motion.div variants={item}><Sub>Settl chases your overdue invoices for you. It writes each reminder in your voice, clears a strict compliance gate, and only asks you to approve the first one.</Sub></motion.div>
              <motion.div variants={item}>
                <Metrics>
                  <Chip><b>31 → 19</b><span>days to pay</span></Chip>
                  <Chip><b>~14 hrs</b><span>saved / week</span></Chip>
                  <Chip><b>0</b><span>unsafe messages</span></Chip>
                </Metrics>
              </motion.div>
              <motion.div variants={item}><Row>
                <Magnetic><Cta $big $primary onClick={open} disabled={navTarget !== null} aria-busy={navTarget === "dashboard"}>{navTarget === "dashboard" ? "Opening dashboard…" : "Open your dashboard"}</Cta></Magnetic>
                <Magnetic><Cta $big onClick={demo} disabled={navTarget !== null} aria-busy={navTarget === "demo"}>{navTarget === "demo" ? "Loading demo…" : "See it work →"}</Cta></Magnetic>
              </Row></motion.div>
            </motion.div>

            <Tilt>
              <RecoveryStrip aria-label="Invoice recovery stages">
                {["Ingest", "Decide", "Draft", "Gate", "Send", "Paid"].map((label) => <span key={label}>{label}</span>)}
              </RecoveryStrip>
              <Console>
                <Scan><div /></Scan>
                <TBar>
                  <div className="l"><span className="live" />recovery ledger</div>
                  <div className="r">INV-012 · active</div>
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
                        <FRow key={e.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                          <Av $fg={e.fg} $bg={e.bg}>{e.in}</Av><span className="copy">{e.text}</span><Tag $fg={e.fg} $bg={e.bg}>{e.tag}</Tag>
                        </FRow>
                      ))}
                    </AnimatePresence>
                  </FeedWrap>
                </Cgrid>
              </Console>
            </Tilt>
          </HeroGrid>
        </Content>
      </Hero>
    </>
  );
}
