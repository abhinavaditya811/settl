"use client";

// Interactive product showcase: one glass console with a tab rail. Each tab reveals
// what that surface does + a representative mini-view. Not a card grid.

import { useState } from "react";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { c, glass, tele, kfPulse, kfScan } from "./palette";

const reveal = {
  initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-90px" }, transition: { duration: 0.7, ease: [0.22, 0.7, 0.2, 1] },
} as const;
const Section = styled(motion.section)`padding: 92px 0 0;`;
const Kicker = styled.div`${tele}; color: ${c.accent2};`;
const H2 = styled.h2`font-family: ${c.display}; font-size: clamp(32px, 5vw, 52px); line-height: 1.0; letter-spacing: -0.035em; font-weight: 700; margin: 12px 0 0; max-width: 20ch;`;
const Lead = styled.p`font-size: 16px; line-height: 1.65; color: ${c.muted}; max-width: 58ch; margin: 16px 0 0;`;

const Panel = styled.div`${glass}; border-radius: 18px; margin-top: 36px; overflow: hidden; position: relative;`;
const Scan = styled.div`position: absolute; top: 0; left: 0; right: 0; height: 1px; overflow: hidden; div { height: 100%; width: 40%; background: linear-gradient(90deg, transparent, ${c.accent2}, transparent); animation: ${kfScan} 4.5s ease-in-out infinite; }`;
const TopBar = styled.div`display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid ${c.line}; background: rgba(255,255,255,0.02); ${tele}; color: ${c.muted}; .live { width: 8px; height: 8px; border-radius: 50%; background: ${c.ok}; display: inline-block; margin-right: 8px; vertical-align: 1px; animation: ${kfPulse} 1.8s ease-in-out infinite; }`;
const Grid = styled.div`display: grid; grid-template-columns: 232px 1fr; @media (max-width: 760px) { grid-template-columns: 1fr; }`;
const Rail = styled.div`border-right: 1px solid ${c.line}; padding: 12px; display: flex; flex-direction: column; gap: 4px; @media (max-width: 760px) { flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid ${c.line}; }`;
const Tab = styled.button<{ $on: boolean }>`
  text-align: left; padding: 12px 14px; border-radius: 11px; cursor: pointer; border: none; white-space: nowrap;
  background: ${({ $on }) => ($on ? "rgba(155,140,255,0.12)" : "transparent")};
  color: ${({ $on }) => ($on ? c.ink : c.muted)};
  .l { font-family: ${c.display}; font-size: 14.5px; font-weight: 600; }
  .s { font-size: 12px; color: ${c.faint}; margin-top: 2px; }
  &:hover { background: rgba(255,255,255,0.05); }
`;
const View = styled.div`padding: 22px 24px; min-height: 270px;`;
const VTitle = styled.div`font-family: ${c.display}; font-size: 20px; font-weight: 600;`;
const VDesc = styled.div`font-size: 14px; color: ${c.muted}; line-height: 1.6; margin: 8px 0 18px; max-width: 48ch;`;
const Mini = styled.div`${glass}; border-radius: 12px; padding: 14px 16px;`;
const Row = styled.div`display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 7px 0;`;
const Av = styled.span<{ $fg: string; $bg: string }>`width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};`;
const Pill = styled.span<{ $fg: string; $bg: string }>`margin-left: auto; font-family: ${c.mono}; font-size: 10px; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 6px; color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};`;
const Big = styled.div`font-family: ${c.display}; font-size: 30px; font-weight: 700; color: ${c.accent2}; letter-spacing: -0.02em;`;

const TABS = [
  {
    key: "overview", label: "Overview", sub: "Where your money is",
    title: "See your cash, live.", desc: "Money recovered, in flight, and what needs you, plus a plain-English feed of everything the agent just did.",
    view: (
      <Mini>
        <div style={{ fontFamily: c.mono, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: c.faint }}>money in motion</div>
        <Big>$45,970</Big>
        <Row><Av $fg={c.ok} $bg={c.okBg}>SR</Av>Sent a firm reminder to Summit Roofing<Pill $fg={c.ok} $bg={c.okBg}>SENT</Pill></Row>
        <Row><Av $fg={c.warn} $bg={c.warnBg}>BS</Av>Held for approval: Brightline<Pill $fg={c.warn} $bg={c.warnBg}>NEEDS YOU</Pill></Row>
      </Mini>
    ),
  },
  {
    key: "approvals", label: "Approvals", sub: "One-tap sign-off",
    title: "Approve the first message in a tap.", desc: "Each first-contact draft is shown as the real email or SMS it'll become. Review, edit inline, send.",
    view: (
      <Mini>
        <Row><Av $fg={c.warn} $bg={c.warnBg}>BS</Av><span style={{ fontWeight: 600 }}>Brightline Studio</span><Pill $fg={c.warn} $bg={c.warnBg}>$1,000 · 7d</Pill></Row>
        <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.6, marginTop: 8, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>Hi Brightline Studio, a friendly reminder that invoice INV-031 for $1,000 is now 7 days past due…</div>
      </Mini>
    ),
  },
  {
    key: "invoices", label: "Invoices", sub: "The whole portfolio",
    title: "Every invoice, and what's next.", desc: "A dense, searchable table with each invoice's status and the agent's next planned move. Click any row for the full decision trace.",
    view: (
      <Mini>
        <Row><Av $fg={c.ok} $bg={c.okBg}>SR</Av>Summit Roofing · $2,750<Pill $fg={c.faint} $bg="rgba(255,255,255,0.05)">final notice in 14d</Pill></Row>
        <Row><Av $fg={c.warn} $bg={c.warnBg}>BS</Av>Brightline · $1,000<Pill $fg={c.faint} $bg="rgba(255,255,255,0.05)">waiting on you</Pill></Row>
        <Row><Av $fg={c.accent} $bg="rgba(109,94,246,0.15)">PI</Av>Pinewood · $2,300<Pill $fg={c.faint} $bg="rgba(255,255,255,0.05)">resumes in 2d</Pill></Row>
      </Mini>
    ),
  },
  {
    key: "activity", label: "Activity", sub: "The audit trail",
    title: "Every decision, logged.", desc: "The full audit timeline: filter by agent, prove safety, export the log. Zero unsafe messages, ever.",
    view: (
      <Mini>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0" }}><span style={{ width: 9, height: 9, borderRadius: 9, background: c.ok }} /><span style={{ fontWeight: 600, fontSize: 13 }}>0 unsafe messages ever sent</span></div>
        <Row><span style={{ width: 8, height: 8, borderRadius: 8, background: c.bad }} />Blocked a disputed draft: Cedar &amp; Co<Pill $fg={c.faint} $bg="rgba(255,255,255,0.05)">18m</Pill></Row>
        <Row><span style={{ width: 8, height: 8, borderRadius: 8, background: c.ok }} />Sent reminder to Northwind<Pill $fg={c.faint} $bg="rgba(255,255,255,0.05)">11m</Pill></Row>
      </Mini>
    ),
  },
];

export default function Showcase() {
  const [active, setActive] = useState("overview");
  const tab = TABS.find((t) => t.key === active) ?? TABS[0];
  return (
    <Section id="console" style={{ scrollMarginTop: 24 }} {...reveal}>
      <Kicker>// the console</Kicker>
      <H2>One command center for your receivables.</H2>
      <Lead>The dashboard is just a window onto the engine: four views over the same autonomous agent.</Lead>
      <Panel>
        <Scan><div /></Scan>
        <TopBar><span><span className="live" />settl console · live</span><span>4 views · one engine</span></TopBar>
        <Grid>
          <Rail>
            {TABS.map((t) => (
              <Tab key={t.key} $on={t.key === active} onClick={() => setActive(t.key)}>
                <div className="l">{t.label}</div><div className="s">{t.sub}</div>
              </Tab>
            ))}
          </Rail>
          <View>
            <AnimatePresence mode="wait">
              <motion.div key={tab.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
                <VTitle>{tab.title}</VTitle>
                <VDesc>{tab.desc}</VDesc>
                {tab.view}
              </motion.div>
            </AnimatePresence>
          </View>
        </Grid>
      </Panel>
    </Section>
  );
}
