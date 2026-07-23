"use client";

// Lifted landing sections — Safety as a live telemetry panel, Outcomes with
// count-up stats, and a closing statement. Glass + motion, hero-bar quality.

import styled from "styled-components";
import { c, glass, tele, kfPulse, kfScan, screen, spotGlow } from "./palette";
import { Reveal, spotlightMove } from "./anim";

const Section = styled.section`${screen};`;
const CloserScreen = styled.section`${screen};`;
const Kicker = styled.div`${tele}; color: ${c.accent2};`;
const H2 = styled.h2`font-family: ${c.display}; font-size: clamp(32px, 5vw, 52px); line-height: 1.0; letter-spacing: -0.035em; font-weight: 700; margin: 12px 0 0; max-width: 18ch;`;
const Lead = styled.p`font-size: 16px; line-height: 1.65; color: ${c.muted}; max-width: 58ch; margin: 16px 0 0;`;

// --- safety telemetry panel ---
const Console = styled.div`${glass}; border-radius: 18px; overflow: hidden; margin-top: 34px; position: relative;`;
const Scan = styled.div`position: absolute; top: 0; left: 0; right: 0; height: 1px; overflow: hidden; div { height: 100%; width: 40%; background: linear-gradient(90deg, transparent, ${c.ok}, transparent); animation: ${kfScan} 4.5s ease-in-out infinite; }`;
const CHead = styled.div`display: flex; align-items: center; justify-content: space-between; padding: 13px 18px; border-bottom: 1px solid ${c.line}; background: rgba(255,255,255,0.02); ${tele}; color: ${c.muted}; .live { width: 8px; height: 8px; border-radius: 50%; background: ${c.ok}; display: inline-block; margin-right: 8px; vertical-align: 1px; animation: ${kfPulse} 1.8s ease-in-out infinite; }`;
const Readout = styled.div`display: grid; grid-template-columns: 1fr 1fr; @media (max-width: 640px) { grid-template-columns: 1fr; }`;
const RItem = styled.div`
  padding: 20px 22px; border-bottom: 1px solid ${c.line};
  &:nth-child(odd) { border-right: 1px solid ${c.line}; }
  @media (max-width: 640px) { &:nth-child(odd) { border-right: none; } }
  .lbl { ${tele}; }
  .val { font-family: ${c.display}; font-size: 26px; font-weight: 700; margin-top: 9px; display: flex; align-items: center; gap: 10px; }
  .sub { font-size: 12.5px; color: ${c.muted}; margin-top: 5px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: ${c.ok}; animation: ${kfPulse} 1.9s ease-in-out infinite; }
`;

const Note = styled.div`${tele}; color: ${c.faint}; margin-top: 22px;`;

// --- pricing ---
const PriceGrid = styled.div`
  margin-top: 38px; display: grid; grid-template-columns: 1fr minmax(280px, 360px); gap: 40px; align-items: stretch;
  @media (max-width: 880px) { grid-template-columns: 1fr; gap: 22px; }
`;
const Prices = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 14px; @media (max-width: 520px) { grid-template-columns: 1fr; }`;
const PriceCard = styled.div<{ $accent?: boolean }>`
  ${glass}; ${spotGlow}; border-radius: 18px; padding: 30px 26px;
  border-color: ${({ $accent }) => ($accent ? "rgba(155,140,255,0.5)" : c.glassBorder)};
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  &:hover { transform: translateY(-5px); border-color: rgba(155,140,255,0.6); box-shadow: 0 20px 50px rgba(0,0,0,0.35); }
  &::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: ${({ $accent }) => ($accent ? 1 : 0)}; background: radial-gradient(420px 160px at 50% 0%, rgba(109,94,246,0.18), transparent 70%); }
`;
// Right-hand panel: what every plan includes, so the pricing block fills the width.
const Included = styled.div`
  ${glass}; ${spotGlow}; border-radius: 18px; padding: 28px 26px; display: flex; flex-direction: column;
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
  &:hover { transform: translateY(-4px); border-color: rgba(155,140,255,0.5); box-shadow: 0 20px 50px rgba(0,0,0,0.35); }
  .h { ${tele}; color: ${c.accent2}; margin-bottom: 18px; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  li { display: flex; align-items: flex-start; gap: 11px; font-size: 14px; line-height: 1.45; color: ${c.ink}; }
  .ck { color: ${c.ok}; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
`;
const PTier = styled.div`${tele}; color: ${c.accent2};`;
const PBig = styled.div`font-family: ${c.display}; font-size: 42px; font-weight: 700; letter-spacing: -0.03em; color: ${c.ink}; margin-top: 12px; line-height: 1; span { font-family: ${c.body}; font-size: 15px; font-weight: 500; color: ${c.muted}; letter-spacing: 0; margin-left: 4px; }`;
const PText = styled.div`font-size: 14px; line-height: 1.6; color: ${c.muted}; margin-top: 14px; max-width: 34ch;`;

// --- closing ---
const Closer = styled.div`${glass}; border-radius: 24px; text-align: center; padding: 66px 28px; position: relative; overflow: hidden; &::before { content: ""; position: absolute; inset: 0; background: radial-gradient(600px 200px at 50% 0%, rgba(109,94,246,0.22), transparent 70%); pointer-events: none; }`;
const CloseH = styled.h2`font-family: ${c.display}; font-size: clamp(34px, 5.4vw, 58px); line-height: 1.0; letter-spacing: -0.04em; font-weight: 700; margin: 0 auto; max-width: 16ch; position: relative;`;
const CtaBtn = styled.button`margin-top: 28px; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 11px; border: none; cursor: pointer; color: #fff; background: ${c.accent}; box-shadow: 0 0 36px rgba(109,94,246,0.6); position: relative; &:hover { filter: brightness(1.08); }`;
// --- footer ---
const Foot = styled.footer`margin-top: 96px; padding-top: 44px; border-top: 1px solid ${c.line};`;
const FootTop = styled.div`
  display: flex; justify-content: space-between; gap: 48px 40px; flex-wrap: wrap;
  .brand { max-width: 320px; }
  .lock { display: flex; align-items: center; gap: 10px; }
  .logo { width: 32px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, ${c.accent2}, ${c.accent}); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(109,94,246,.45), inset 0 1px 0 rgba(255,255,255,.3); }
  .name { font-family: ${c.display}; font-size: 19px; font-weight: 700; letter-spacing: -0.02em; }
  .name .dot { color: ${c.accent2}; }
  .tag { font-size: 13.5px; line-height: 1.65; color: ${c.muted}; margin: 15px 0 0; }
  .cols { display: flex; gap: 56px; flex-wrap: wrap; @media (max-width: 560px) { gap: 36px; } }
`;
const FCol = styled.div`
  display: flex; flex-direction: column; gap: 13px; align-items: flex-start;
  .h { ${tele}; color: ${c.faint}; margin-bottom: 3px; }
  a, button { text-align: left; font-size: 13.5px; color: ${c.muted}; background: none; border: none; padding: 0; cursor: pointer; font-family: ${c.body}; text-decoration: none; transition: color 0.15s ease;
    &:hover { color: ${c.ink}; } }
`;
const FootBottom = styled.div`display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 48px; padding-top: 22px; border-top: 1px solid ${c.line}; ${tele};`;

export default function LandingSections() {
  const go = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <>
      <Section id="safety" style={{ scrollMarginTop: 24 }}>
        <Reveal>
          <Kicker>// safety</Kicker>
          <H2>An agent you can actually trust.</H2>
          <Lead>No legal threats, no consumer debt, B2B only. Every message clears a deterministic compliance gate, and anything risky is escalated to you, never sent.</Lead>
        </Reveal>
        <Reveal delay={0.1}>
          <Console>
            <Scan><div /></Scan>
            <CHead><span><span className="live" />settl · safety status</span><span>all systems nominal</span></CHead>
            <Readout>
              <RItem><div className="lbl">unsafe sends</div><div className="val"><span className="dot" />0</div><div className="sub">caught and escalated by the gate</div></RItem>
              <RItem><div className="lbl">compliance gate</div><div className="val"><span className="dot" />armed</div><div className="sub">runs on every single send</div></RItem>
              <RItem><div className="lbl">funds touched</div><div className="val"><span className="dot" />$0</div><div className="sub">never custodial, paid via your processor</div></RItem>
              <RItem><div className="lbl">audit log</div><div className="val"><span className="dot" />on</div><div className="sub">every decision recorded with its reasoning</div></RItem>
            </Readout>
          </Console>
        </Reveal>
      </Section>

      <Section id="pricing" style={{ scrollMarginTop: 24 }}>
        <Reveal>
          <Kicker>// pricing</Kicker>
          <H2>You only pay when you get paid.</H2>
          <Lead>No seats and no monthly minimum. Settl earns a small success fee on the invoices it actually recovers, so our incentive is exactly yours.</Lead>
        </Reveal>
        <PriceGrid>
          <Prices>
            <Reveal delay={0.05}>
              <PriceCard onMouseMove={spotlightMove}>
                <PTier>Pilot</PTier>
                <PBig>Free</PBig>
                <PText>Onboard your invoices and watch the agent work. No card, no commitment.</PText>
              </PriceCard>
            </Reveal>
            <Reveal delay={0.13}>
              <PriceCard $accent onMouseMove={spotlightMove}>
                <PTier>After the pilot</PTier>
                <PBig>Success fee</PBig>
                <PText>A small fee only on invoices we help you collect. Nothing recovered, nothing owed.</PText>
              </PriceCard>
            </Reveal>
          </Prices>
          <Reveal delay={0.2}>
            <Included onMouseMove={spotlightMove}>
              <div className="h">// every plan includes</div>
              <ul>
                <li><span className="ck">✓</span>The compliance gate on every single send</li>
                <li><span className="ck">✓</span>Reminders drafted in your own voice</li>
                <li><span className="ck">✓</span>Email and voice, from one agent</li>
                <li><span className="ck">✓</span>A full audit log of every decision</li>
                <li><span className="ck">✓</span>Never custodial, paid via your own processor</li>
              </ul>
            </Included>
          </Reveal>
        </PriceGrid>
        <Note>Never custodial: you&apos;re paid through your own processor, and Settl only ever records the fee.</Note>
      </Section>

      <CloserScreen>
        <Reveal>
          <Closer>
            <Kicker style={{ color: c.accent2 }}>// stop chasing</Kicker>
            <CloseH>Get paid for the work you&apos;ve already done.</CloseH>
            <CtaBtn onClick={() => (window.location.href = "/signin")}>Open your dashboard</CtaBtn>
          </Closer>
        </Reveal>
      </CloserScreen>

      <Foot>
        <FootTop>
          <div className="brand">
            <div className="lock">
              <span className="logo" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </span>
              <span className="name">Settl<span className="dot">.</span></span>
            </div>
            <p className="tag">The autonomous agent that gets small businesses paid on their overdue invoices, without the awkward chasing.</p>
          </div>
          <div className="cols">
            <FCol>
              <div className="h">Product</div>
              <button onClick={go("how")}>How it works</button>
              <button onClick={go("voice")}>Voice agent</button>
              <button onClick={go("console")}>Console</button>
              <button onClick={go("safety")}>Safety</button>
            </FCol>
            <FCol>
              <div className="h">Company</div>
              <button onClick={go("problem")}>The problem</button>
              <button onClick={go("outcomes")}>Outcomes</button>
              <button onClick={go("pricing")}>Pricing</button>
            </FCol>
            <FCol>
              <div className="h">Get started</div>
              <a href="/signin">Open dashboard</a>
              <a href="/demo">Watch the demo</a>
              <a href="/signin">Sign in</a>
            </FCol>
          </div>
        </FootTop>
        <FootBottom>
          <span>© 2026 Settl. All rights reserved.</span>
          <span>Built for the people who did the work.</span>
        </FootBottom>
      </Foot>
    </>
  );
}
