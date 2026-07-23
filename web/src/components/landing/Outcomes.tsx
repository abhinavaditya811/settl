"use client";

// Outcomes — the payoff, shown high on the page (right under the hero). Not three
// flat numbers: each stat is a small animated instrument that draws itself as it
// scrolls in (a before/after bar race, hours "freed" popping in, a compliance ring
// filling to 100%). Minimal motion that carries meaning — the 2026 pattern.

import styled from "styled-components";
import { motion } from "framer-motion";
import { c, glass, tele, screen, spotGlow } from "./palette";
import { Reveal, Counter, spotlightMove } from "./anim";

const Section = styled.section`${screen};`;
const Kicker = styled.div`${tele}; color: ${c.accent2};`;
const H2 = styled.h2`font-family: ${c.display}; font-size: clamp(32px, 5vw, 52px); line-height: 1.0; letter-spacing: -0.035em; font-weight: 700; margin: 12px 0 0; max-width: 18ch;`;
const Lead = styled.p`font-size: 16px; line-height: 1.65; color: ${c.muted}; max-width: 56ch; margin: 16px 0 0;`;

const Stats = styled.div`display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 40px; align-items: stretch; @media (max-width: 820px) { grid-template-columns: 1fr; }`;
const Card = styled.div`
  ${glass}; border-radius: 18px; padding: 26px 24px; position: relative; overflow: hidden;
  display: flex; flex-direction: column;
  ${spotGlow};
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  &:hover { transform: translateY(-6px); border-color: rgba(155,140,255,0.55); box-shadow: 0 24px 60px rgba(0,0,0,0.4); }
  .cap { ${tele}; color: ${c.accent2}; position: relative; }
  .big { font-family: ${c.display}; font-size: 52px; font-weight: 700; letter-spacing: -0.035em; color: ${c.ink}; line-height: 1; margin-top: 12px; position: relative; span { color: ${c.accent2}; } }
  .lbl { font-size: 14.5px; color: ${c.ink}; margin-top: 12px; font-weight: 500; position: relative; }
  .sub { ${tele}; color: ${c.faint}; margin-top: 5px; position: relative; }
  .viz { margin-top: auto; padding-top: 22px; position: relative; }
`;

// Before/after "bar race": the old 31-day bar fills fully, the Settl bar races to 61%.
const Bars = styled.div`
  display: flex; flex-direction: column; gap: 10px;
  .row { display: flex; align-items: center; gap: 10px; }
  .k { ${tele}; width: 46px; flex-shrink: 0; }
  .track { flex: 1; height: 9px; border-radius: 99px; background: rgba(255,255,255,0.06); overflow: hidden; }
  .fill { height: 100%; border-radius: 99px; }
`;

// Hours "freed" — 14 blocks that pop in one by one, each an hour handed back.
const Blocks = styled.div`display: flex; flex-wrap: wrap; gap: 5px; max-width: 210px;
  span { width: 13px; height: 13px; border-radius: 4px; background: linear-gradient(135deg, ${c.accent2}, ${c.accent}); }
`;
const Freed = styled.div`${tele}; color: ${c.faint}; margin-top: 11px;`;
const Note = styled.div`${tele}; color: ${c.faint}; margin-top: 22px;`;

// Compliance ring that draws itself to a full circle.
function Ring() {
  const r = 30, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <motion.circle
          cx="38" cy="38" r={r} fill="none" stroke={c.ok} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }} whileInView={{ strokeDashoffset: 0 }}
          viewport={{ once: true }} transition={{ duration: 1.3, ease: [0.22, 0.7, 0.2, 1] }}
          style={{ transformOrigin: "center", rotate: -90 }}
        />
      </svg>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: c.muted }}>
        every draft cleared<br />the compliance gate
      </div>
    </div>
  );
}

const barVp = { once: true, margin: "-60px" } as const;

export default function Outcomes() {
  return (
    <Section id="outcomes" style={{ scrollMarginTop: 24 }}>
      <Reveal>
        <Kicker>// outcomes</Kicker>
        <H2>Get paid faster, with less work.</H2>
        <Lead>What Settl does for your cash flow, from day one.</Lead>
      </Reveal>
      <Stats>
        <Reveal delay={0.05}>
          <Card onMouseMove={spotlightMove}>
            <div className="cap">// days to get paid</div>
            <div className="big"><Counter to={19} /> <span>days</span></div>
            <div className="lbl">down from 31</div>
            <div className="sub">a 12-day head start on your cash</div>
            <div className="viz">
              <Bars>
                <div className="row">
                  <span className="k" style={{ color: c.faint }}>before</span>
                  <div className="track"><motion.div className="fill" style={{ background: "rgba(255,255,255,0.22)" }} initial={{ width: 0 }} whileInView={{ width: "100%" }} viewport={barVp} transition={{ duration: 1, ease: [0.22, 0.7, 0.2, 1] }} /></div>
                </div>
                <div className="row">
                  <span className="k" style={{ color: c.accent2 }}>settl</span>
                  <div className="track"><motion.div className="fill" style={{ background: `linear-gradient(90deg, ${c.accent2}, ${c.accent})` }} initial={{ width: 0 }} whileInView={{ width: "61%" }} viewport={barVp} transition={{ duration: 1, delay: 0.25, ease: [0.22, 0.7, 0.2, 1] }} /></div>
                </div>
              </Bars>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.13}>
          <Card onMouseMove={spotlightMove}>
            <div className="cap">// hours saved a week</div>
            <div className="big">~<Counter to={14} /></div>
            <div className="lbl">no more manual chasing</div>
            <div className="sub">the follow-ups run themselves</div>
            <div className="viz">
              <Blocks aria-hidden="true">
                {Array.from({ length: 14 }).map((_, i) => (
                  <motion.span key={i} initial={{ opacity: 0, scale: 0.3 }} whileInView={{ opacity: 1, scale: 1 }} viewport={barVp} transition={{ duration: 0.3, delay: i * 0.045, ease: "easeOut" }} />
                ))}
              </Blocks>
              <Freed>≈ two full workdays, handed back</Freed>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.21}>
          <Card onMouseMove={spotlightMove}>
            <div className="cap">// messages compliant</div>
            <div className="big"><Counter to={100} /><span>%</span></div>
            <div className="lbl">the gate clears every send</div>
            <div className="sub">zero unsafe messages, ever</div>
            <div className="viz"><Ring /></div>
          </Card>
        </Reveal>
      </Stats>
      <Note>illustrative: the demo runs on synthetic invoices, with no real money figures</Note>
    </Section>
  );
}
