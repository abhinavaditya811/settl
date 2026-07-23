"use client";

// Explains what Settl does — lifted to the hero bar: bigger type, staggered glass
// pain rows, and a sequential pipeline with the compliance gate emphasized.

import styled from "styled-components";
import { c, glass, tele, kfPulse, screen, spotGlow } from "./palette";
import { Reveal, spotlightMove } from "./anim";

const Kicker = styled.div`${tele}; color: ${c.accent2};`;
const H2 = styled.h2`font-family: ${c.display}; font-size: clamp(32px, 5vw, 52px); line-height: 1.0; letter-spacing: -0.035em; font-weight: 700; margin: 12px 0 0; max-width: 18ch;`;
const Lead = styled.p`font-size: 16px; line-height: 1.65; color: ${c.muted}; max-width: 58ch; margin: 16px 0 0;`;
const Section = styled.section`${screen};`;

const ProblemGrid = styled.div`
  margin-top: 34px; display: grid; grid-template-columns: 1fr minmax(300px, 400px); gap: 56px; align-items: center;
  @media (max-width: 860px) { grid-template-columns: 1fr; gap: 32px; }
`;
const Pain = styled.div`display: flex; flex-direction: column; gap: 14px;`;
const PRow = styled.div`
  ${glass}; ${spotGlow}; border-radius: 13px; padding: 16px 18px; display: flex; align-items: center; gap: 14px;
  font-size: 15px; color: ${c.ink}; transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  &:hover { transform: translateX(6px); border-color: rgba(255,107,107,0.5); box-shadow: 0 12px 30px rgba(0,0,0,0.28); }
  .m { font-family: ${c.mono}; color: ${c.bad}; font-size: 14px; flex-shrink: 0; }
`;
// The right-side visual: one invoice quietly rotting, to make the pain concrete.
const Overdue = styled.div`
  ${glass}; ${spotGlow}; border-radius: 18px; padding: 24px 26px;
  border-color: rgba(255,107,107,0.35); box-shadow: 0 22px 54px rgba(0,0,0,0.4), 0 0 42px rgba(255,107,107,0.12);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  &:hover { transform: translateY(-5px); box-shadow: 0 28px 64px rgba(0,0,0,0.46), 0 0 54px rgba(255,107,107,0.18); }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .id { font-family: ${c.mono}; font-size: 12.5px; color: ${c.muted}; }
  .badge { font-family: ${c.mono}; font-size: 10.5px; letter-spacing: 0.06em; padding: 4px 10px; border-radius: 7px; color: ${c.bad}; background: ${c.badBg}; }
  .amt { font-family: ${c.display}; font-size: 46px; font-weight: 700; letter-spacing: -0.03em; margin-top: 16px; color: ${c.ink}; }
  .meta { font-size: 13.5px; color: ${c.faint}; margin-top: 6px; }
  .bar { height: 7px; border-radius: 99px; background: rgba(255,255,255,0.07); margin-top: 20px; overflow: hidden; }
  .bar div { height: 100%; width: 84%; background: ${c.bad}; border-radius: 99px; }
  .cap { ${tele}; color: ${c.faint}; margin-top: 12px; }
`;

const Pipe = styled.div`
  margin-top: 40px; display: grid; gap: 16px;
  grid-template-columns: repeat(3, 1fr);
  @media (max-width: 860px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;
const Stage = styled.div<{ $gate?: boolean }>`
  ${glass}; ${spotGlow}; border-radius: 16px; padding: 22px 20px;
  height: 100%; display: flex; flex-direction: column;
  border-color: ${({ $gate }) => ($gate ? "rgba(255,107,107,0.5)" : c.glassBorder)};
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  &:hover { transform: translateY(-5px); border-color: ${({ $gate }) => ($gate ? "rgba(255,107,107,0.7)" : "rgba(155,140,255,0.55)")}; box-shadow: 0 18px 44px rgba(0,0,0,0.32); }
  &::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: ${({ $gate }) => ($gate ? c.bad : c.accent)}; opacity: ${({ $gate }) => ($gate ? 1 : 0.6)}; }
  .top { display: flex; align-items: center; gap: 10px; }
  .ico { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; background: ${({ $gate }) => ($gate ? c.badBg : "rgba(155,140,255,0.14)")}; }
  .n { font-family: ${c.mono}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${({ $gate }) => ($gate ? c.bad : c.accent2)}; }
  .t { font-family: ${c.display}; font-size: 19px; font-weight: 700; margin: 14px 0 8px; letter-spacing: -0.01em; }
  .d { font-size: 13px; line-height: 1.55; color: ${c.muted}; }
  .badge { display: inline-flex; align-items: center; gap: 6px; ${tele}; color: ${c.bad}; margin-top: auto; padding-top: 12px; .dot { width: 6px; height: 6px; border-radius: 50%; background: ${c.bad}; animation: ${kfPulse} 1.6s ease-in-out infinite; } }
`;

const PAINS = [
  "remembering who to follow up with, and exactly when",
  "writing the reminder that's firm but never rude",
  "staying compliant so a message never crosses a legal line",
];
const STAGES = [
  { n: "01 · ingest", icon: "📥", t: "Read", d: "Pulls each invoice from CSV or Stripe into one clean, canonical shape. Agents never see a raw source." },
  { n: "02 · strategy", icon: "🧭", t: "Decide", d: "Skip, wait, or chase? Picks the timing, tone, and channel for this specific invoice." },
  { n: "03 · draft", icon: "✍️", t: "Write", d: "Gemini drafts the message in your voice: friendly, firm, or final notice." },
  { n: "04 · gate", icon: "🛡️", t: "Check", d: "A deterministic compliance gate inspects every draft. Anything risky is blocked and escalated to you.", gate: true },
  { n: "05 · send", icon: "📤", t: "Send", d: "Goes out from your own mailbox with the real payment link. First contact waits for your one-tap approval." },
  { n: "06 · reconcile", icon: "✅", t: "Close", d: "Detects payment, records the success fee (never custodial), and loops back if it's still unpaid." },
];

export default function Explainer() {
  return (
    <>
      <Section id="problem" style={{ scrollMarginTop: 24 }}>
        <Reveal>
          <Kicker>// the problem</Kicker>
          <H2>You did the work. Chasing the money shouldn&apos;t be your job.</H2>
          <Lead>Every overdue invoice is the same grind, and the cash you&apos;ve already earned sits uncollected for weeks while you deal with it.</Lead>
        </Reveal>
        <ProblemGrid>
          <Pain>
            {PAINS.map((p, i) => (
              <Reveal key={i} delay={i * 0.08}><PRow onMouseMove={spotlightMove}><span className="m">0{i + 1}</span>{p}</PRow></Reveal>
            ))}
          </Pain>
          <Reveal delay={0.18}>
            <Overdue onMouseMove={spotlightMove}>
              <div className="top">
                <span className="id">INV-024 · Cedar &amp; Co</span>
                <span className="badge">45 DAYS OVERDUE</span>
              </div>
              <div className="amt">$3,400</div>
              <div className="meta">Sent. Ignored. Sent again. Still nothing.</div>
              <div className="bar"><div /></div>
              <div className="cap">every day it sits, it&apos;s your cash flow, not theirs</div>
            </Overdue>
          </Reveal>
        </ProblemGrid>
      </Section>

      <Section id="how" style={{ scrollMarginTop: 24 }}>
        <Reveal>
          <Kicker>// what settl does</Kicker>
          <H2>Every invoice runs the same disciplined pipeline.</H2>
          <Lead>No guesswork and no missed follow-ups. Each invoice flows through six stages, and the compliance gate is the hard line that nothing unsafe ever crosses.</Lead>
        </Reveal>
        <Pipe>
          {STAGES.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.07} style={{ height: "100%" }}>
              <Stage $gate={s.gate} onMouseMove={spotlightMove}>
                <div className="top">
                  <span className="ico" aria-hidden="true">{s.icon}</span>
                  <span className="n">{s.n}</span>
                </div>
                <div className="t">{s.t}</div>
                <div className="d">{s.d}</div>
                {s.gate && <div className="badge"><span className="dot" />the hard line</div>}
              </Stage>
            </Reveal>
          ))}
        </Pipe>
      </Section>
    </>
  );
}
