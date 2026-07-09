"use client";

// Explains what Settl does — lifted to the hero bar: bigger type, staggered glass
// pain rows, and a sequential pipeline with the compliance gate emphasized.

import styled from "styled-components";
import { c, glass, tele, kfPulse } from "./palette";
import { Reveal } from "./anim";

const Kicker = styled.div`${tele}; color: ${c.accent2};`;
const H2 = styled.h2`font-family: ${c.display}; font-size: clamp(32px, 5vw, 52px); line-height: 1.0; letter-spacing: -0.035em; font-weight: 700; margin: 12px 0 0; max-width: 18ch;`;
const Lead = styled.p`font-size: 16px; line-height: 1.65; color: ${c.muted}; max-width: 58ch; margin: 16px 0 0;`;
const Section = styled.section`padding: 100px 0 0;`;

const Pain = styled.div`margin-top: 30px; display: flex; flex-direction: column; gap: 12px; max-width: 620px;`;
const PRow = styled.div`
  ${glass}; border-radius: 13px; padding: 15px 18px; display: flex; align-items: center; gap: 14px;
  font-size: 15px; color: ${c.ink}; transition: transform 0.2s ease, border-color 0.2s ease;
  &:hover { transform: translateX(4px); border-color: rgba(255,107,107,0.35); }
  .m { font-family: ${c.mono}; color: ${c.bad}; font-size: 14px; flex-shrink: 0; }
`;

const Pipe = styled.div`
  margin-top: 38px; display: grid; gap: 14px;
  grid-template-columns: repeat(3, 1fr);
  @media (max-width: 860px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;
const Stage = styled.div<{ $gate?: boolean }>`
  ${glass}; border-radius: 15px; padding: 20px 19px; position: relative; overflow: hidden;
  border-color: ${({ $gate }) => ($gate ? "rgba(255,107,107,0.5)" : c.glassBorder)};
  transition: transform 0.2s ease, border-color 0.2s ease;
  &:hover { transform: translateY(-4px); border-color: ${({ $gate }) => ($gate ? "rgba(255,107,107,0.7)" : "rgba(155,140,255,0.5)")}; }
  &::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: ${({ $gate }) => ($gate ? c.bad : c.accent)}; opacity: ${({ $gate }) => ($gate ? 1 : 0.5)}; }
  .n { font-family: ${c.mono}; font-size: 12px; letter-spacing: 0.1em; color: ${({ $gate }) => ($gate ? c.bad : c.accent2)}; }
  .t { font-family: ${c.display}; font-size: 17px; font-weight: 600; margin: 11px 0 7px; }
  .d { font-size: 13px; line-height: 1.55; color: ${c.muted}; }
  .badge { display: inline-flex; align-items: center; gap: 6px; ${tele}; color: ${c.bad}; margin-top: 11px; .dot { width: 6px; height: 6px; border-radius: 50%; background: ${c.bad}; animation: ${kfPulse} 1.6s ease-in-out infinite; } }
`;

const PAINS = [
  "remembering who to follow up with, and exactly when",
  "writing the reminder that's firm but never rude",
  "staying compliant so a message never crosses a legal line",
];
const STAGES = [
  { n: "01 · ingest", t: "Read", d: "Pulls each invoice from CSV or Stripe into one clean, canonical shape — agents never see a raw source." },
  { n: "02 · strategy", t: "Decide", d: "Skip, wait, or chase? Picks the timing, tone, and channel for this specific invoice." },
  { n: "03 · draft", t: "Write", d: "Gemini drafts the message in your voice — friendly, firm, or final notice." },
  { n: "04 · gate", t: "Check", d: "A deterministic compliance gate inspects every draft. Anything risky is blocked and escalated to you.", gate: true },
  { n: "05 · send", t: "Send", d: "Goes out from your own mailbox with the real payment link. First contact waits for your one-tap approval." },
  { n: "06 · reconcile", t: "Close", d: "Detects payment, records the success fee (never custodial), and loops back if it's still unpaid." },
];

export default function Explainer() {
  return (
    <>
      <Section>
        <Reveal>
          <Kicker>// the problem</Kicker>
          <H2>You did the work. Chasing the money shouldn&apos;t be your job.</H2>
          <Lead>Every overdue invoice is the same grind — and the cash you&apos;ve already earned sits uncollected for weeks while you deal with it.</Lead>
        </Reveal>
        <Pain>
          {PAINS.map((p, i) => (
            <Reveal key={i} delay={i * 0.08}><PRow><span className="m">0{i + 1}</span>{p}</PRow></Reveal>
          ))}
        </Pain>
      </Section>

      <Section>
        <Reveal>
          <Kicker>// what settl does</Kicker>
          <H2>Every invoice runs the same disciplined pipeline.</H2>
          <Lead>No guesswork and no missed follow-ups. Each invoice flows through six stages — and the compliance gate is the hard line that nothing unsafe ever crosses.</Lead>
        </Reveal>
        <Pipe>
          {STAGES.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.07}>
              <Stage $gate={s.gate}>
                <div className="n">{s.n}</div>
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
