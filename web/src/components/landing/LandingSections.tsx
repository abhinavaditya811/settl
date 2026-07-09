"use client";

// Lifted landing sections — Safety as a live telemetry panel, Outcomes with
// count-up stats, and a closing statement. Glass + motion, hero-bar quality.

import styled from "styled-components";
import { c, glass, tele, kfPulse, kfScan } from "./palette";
import { Reveal, Counter } from "./anim";

const Section = styled.section`padding: 100px 0 0;`;
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

// --- outcomes ---
const Stats = styled.div`display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 38px; @media (max-width: 720px) { grid-template-columns: 1fr; }`;
const StatCard = styled.div`${glass}; border-radius: 16px; padding: 28px 24px; transition: transform 0.2s ease, border-color 0.2s ease; &:hover { transform: translateY(-4px); border-color: rgba(155,140,255,0.45); }`;
const Big = styled.div`font-family: ${c.display}; font-size: 52px; font-weight: 700; letter-spacing: -0.035em; color: ${c.ink}; line-height: 1; span { color: ${c.accent2}; }`;
const StatLbl = styled.div`font-size: 14px; color: ${c.ink}; margin-top: 12px; font-weight: 500;`;
const StatSub = styled.div`${tele}; color: ${c.faint}; margin-top: 6px;`;
const Note = styled.div`${tele}; color: ${c.faint}; margin-top: 22px;`;

// --- closing ---
const Closer = styled.div`${glass}; border-radius: 24px; text-align: center; padding: 66px 28px; margin-top: 100px; position: relative; overflow: hidden; &::before { content: ""; position: absolute; inset: 0; background: radial-gradient(600px 200px at 50% 0%, rgba(109,94,246,0.22), transparent 70%); pointer-events: none; }`;
const CloseH = styled.h2`font-family: ${c.display}; font-size: clamp(34px, 5.4vw, 58px); line-height: 1.0; letter-spacing: -0.04em; font-weight: 700; margin: 0 auto; max-width: 16ch; position: relative;`;
const CtaBtn = styled.button`margin-top: 28px; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 11px; border: none; cursor: pointer; color: #fff; background: ${c.accent}; box-shadow: 0 0 36px rgba(109,94,246,0.6); position: relative; &:hover { filter: brightness(1.08); }`;
const Foot = styled.footer`display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 44px; padding-top: 22px; border-top: 1px solid ${c.line}; ${tele};`;

export default function LandingSections() {
  return (
    <>
      <Section>
        <Reveal>
          <Kicker>// safety</Kicker>
          <H2>An agent you can actually trust.</H2>
          <Lead>No legal threats, no consumer debt, B2B only. Every message clears a deterministic compliance gate — anything risky is escalated to you, never sent.</Lead>
        </Reveal>
        <Reveal delay={0.1}>
          <Console>
            <Scan><div /></Scan>
            <CHead><span><span className="live" />settl · safety status</span><span>all systems nominal</span></CHead>
            <Readout>
              <RItem><div className="lbl">unsafe sends</div><div className="val"><span className="dot" />0</div><div className="sub">caught and escalated by the gate</div></RItem>
              <RItem><div className="lbl">compliance gate</div><div className="val"><span className="dot" />armed</div><div className="sub">runs on every single send</div></RItem>
              <RItem><div className="lbl">funds touched</div><div className="val"><span className="dot" />$0</div><div className="sub">never custodial — paid via your processor</div></RItem>
              <RItem><div className="lbl">audit log</div><div className="val"><span className="dot" />on</div><div className="sub">every decision recorded with its reasoning</div></RItem>
            </Readout>
          </Console>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <Kicker>// outcomes</Kicker>
          <H2>Get paid faster, with less work.</H2>
        </Reveal>
        <Stats>
          <Reveal delay={0.05}><StatCard><Big><Counter to={19} /> <span>days</span></Big><StatLbl>to get paid</StatLbl><StatSub>down from 31</StatSub></StatCard></Reveal>
          <Reveal delay={0.13}><StatCard><Big>~<Counter to={14} /></Big><StatLbl>hours saved a week</StatLbl><StatSub>no more manual chasing</StatSub></StatCard></Reveal>
          <Reveal delay={0.21}><StatCard><Big><Counter to={100} /><span>%</span></Big><StatLbl>messages compliant</StatLbl><StatSub>the gate clears every send</StatSub></StatCard></Reveal>
        </Stats>
        <Note>illustrative — the demo runs on synthetic invoices, no real money figures</Note>
      </Section>

      <Reveal>
        <Closer>
          <Kicker style={{ color: c.accent2 }}>// stop chasing</Kicker>
          <CloseH>Get paid for the work you&apos;ve already done.</CloseH>
          <CtaBtn onClick={() => (window.location.href = "/preview")}>Open your dashboard</CtaBtn>
        </Closer>
      </Reveal>

      <Foot>
        <span>settl — autonomous AR</span>
        <span>demo runs on synthetic data · no real money figures</span>
      </Foot>
    </>
  );
}
