"use client";

// Explains what Settl does — lifted to the hero bar: bigger type, staggered glass
// pain rows, and a sequential pipeline with the compliance gate emphasized.

import styled from "styled-components";
import { c, glass, tele, kfPulse, screen, spotGlow } from "./palette";
import { Reveal, spotlightMove } from "./anim";
import { LedgerIcon, type LedgerIconName } from "./LedgerIcons";

const Kicker = styled.div`${tele}; color: ${c.accent2};`;
const H2 = styled.h2`font-family: ${c.display}; font-size: clamp(32px, 5vw, 52px); line-height: 1.0; letter-spacing: -0.035em; font-weight: 700; margin: 12px 0 0; max-width: 18ch;`;
const Lead = styled.p`font-size: 16px; line-height: 1.65; color: ${c.muted}; max-width: 58ch; margin: 16px 0 0;`;
const Section = styled.section`${screen};`;

const ProblemGrid = styled.div`
  margin-top: 34px; display: grid; grid-template-columns: 1fr minmax(300px, 400px); gap: 56px; align-items: center;
  @media (max-width: 860px) { grid-template-columns: 1fr; gap: 32px; }
`;
const Pain = styled.div`display: flex; flex-direction: column; border-top: 1px solid ${c.lineStrong};`;
const PRow = styled.div`
  padding: 18px 2px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid ${c.line};
  font-size: 15px; color: ${c.ink}; transition: padding 0.2s ease, color .2s ease;
  &:hover { padding-left: 8px; color: ${c.paper}; }
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
  margin-top: 44px; display: grid; grid-template-columns: repeat(6, minmax(154px,1fr));
  border-top: 1px solid ${c.lineStrong}; border-bottom: 1px solid ${c.lineStrong};
  overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;
const Stage = styled.div<{ $gate?: boolean }>`
  ${spotGlow}; padding: 24px 18px; min-height: 230px; display: flex; flex-direction: column;
  border-right: 1px solid ${c.line}; scroll-snap-align: start;
  transition: background .22s ease;
  &:hover { background: ${({ $gate }) => ($gate ? c.badBg : "rgba(167,156,247,.055)")}; }
  .top { display: flex; align-items: center; gap: 10px; }
  .ico { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${({ $gate }) => ($gate ? c.bad : c.accent2)}; border: 1px solid ${({ $gate }) => ($gate ? "rgba(238,119,119,.35)" : c.lineStrong)}; background: ${c.surface}; transition:transform .25s cubic-bezier(.22,.7,.2,1), background .25s ease; }
  .ico svg { width: 19px; height: 19px; }
  &:hover .ico { transform:translateY(-3px) rotate(-4deg) scale(1.06); background:${({ $gate }) => ($gate ? c.badBg : "rgba(167,156,247,.1)")}; }
  .n { font-family: ${c.mono}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${({ $gate }) => ($gate ? c.bad : c.accent2)}; }
  .t { font-family: ${c.display}; font-size: 19px; font-weight: 600; margin: 20px 0 8px; letter-spacing: -0.015em; }
  .d { font-size: 13px; line-height: 1.55; color: ${c.muted}; }
  .badge { display: inline-flex; align-items: center; gap: 6px; ${tele}; color: ${c.bad}; margin-top: auto; padding-top: 12px; .dot { width: 6px; height: 6px; border-radius: 50%; background: ${c.bad}; animation: ${kfPulse} 1.6s ease-in-out infinite; } }
  .hint { position:absolute; left:10px; right:10px; bottom:10px; padding:8px 10px; border-radius:8px; background:${c.paper}; color:${c.bgDeep}; font:500 10px ${c.mono}; line-height:1.35; opacity:0; transform:translateY(5px); transition:opacity .2s ease, transform .2s ease; pointer-events:none; box-shadow:0 10px 24px rgba(0,0,0,.3); }
  &:hover .hint, &:focus-within .hint { opacity:1; transform:translateY(0); }
`;

const PAINS = [
  "remembering who to follow up with, and exactly when",
  "writing the reminder that's firm but never rude",
  "staying compliant so a message never crosses a legal line",
];
const STAGES = [
  { n: "01 · ingest", icon: "invoice" as LedgerIconName, t: "Read", d: "Pulls each invoice from CSV or Stripe into one clean, canonical shape. Agents never see a raw source.", hint: "why: source data is normalized at the edge" },
  { n: "02 · strategy", icon: "strategy" as LedgerIconName, t: "Decide", d: "Skip, wait, or chase? Picks the timing, tone, and channel for this specific invoice.", hint: "decision: 21 days overdue → firm email" },
  { n: "03 · draft", icon: "draft" as LedgerIconName, t: "Write", d: "Gemini drafts the message in your voice: friendly, firm, or final notice.", hint: "grounded by: the tenant voice profile" },
  { n: "04 · gate", icon: "gate" as LedgerIconName, t: "Check", d: "A deterministic compliance gate inspects every draft. Anything risky is blocked and escalated to you.", hint: "hard rule: risky language never passes", gate: true },
  { n: "05 · send", icon: "send" as LedgerIconName, t: "Send", d: "Goes out from your own mailbox with the real payment link. First contact waits for your one-tap approval.", hint: "approval: required on the first touch" },
  { n: "06 · reconcile", icon: "reconcile" as LedgerIconName, t: "Close", d: "Detects payment, records the success fee (never custodial), and loops back if it's still unpaid.", hint: "event: verified payment closes the loop" },
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
                  <span className="ico"><LedgerIcon name={s.icon} /></span>
                  <span className="n">{s.n}</span>
                </div>
                <div className="t">{s.t}</div>
                <div className="d">{s.d}</div>
                {s.gate && <div className="badge"><span className="dot" />the hard line</div>}
                <div className="hint" role="tooltip">{s.hint}</div>
              </Stage>
            </Reveal>
          ))}
        </Pipe>
      </Section>
    </>
  );
}
