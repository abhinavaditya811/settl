"use client";

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { motion } from "framer-motion";
import { LedgerIcon } from "./LedgerIcons";
import { playLandingTone } from "./useLandingAudio";

const dark = "#111214";
const ease = [0.22, 0.7, 0.2, 1] as const;
const spin = keyframes`to{transform:translate(-50%,-50%) rotate(360deg)}`;

const Safety = styled.section`
  min-height: 100svh;
  position: relative;
  overflow: hidden;
  display: grid;
  align-items: center;
  color: ${dark};
  background: #eba09a;
`;
const Warning = styled.div`
  position: absolute;
  inset: -10%;
  font: 600 25vw / 0.8 var(--font-display);
  letter-spacing: -0.08em;
  color: rgba(97, 29, 29, 0.05);
  transform: rotate(-8deg);
  white-space: nowrap;
`;
const SafetyGrid = styled.div`
  width: min(1240px, calc(100% - 52px));
  margin: auto;
  padding: 110px 0;
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 56px;
  align-items: center;
  position: relative;
  z-index: 2;
  @media (max-width: 1100px) {
    width: calc(100% - 34px);
    grid-template-columns: 1fr;
    gap: 38px;
    padding: 90px 0;
    .copy {
      max-width: 720px;
    }
  }
`;
const Eye = styled.div`
  font: 500 10px var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7f3232;
`;
const SafetyH = styled.h2`
  font: 600 clamp(54px, 7.4vw, 104px) / 0.84 var(--font-display);
  letter-spacing: -0.075em;
  margin: 18px 0 0;
  max-width: 9ch;
`;
const SafetyP = styled.p`
  font: 400 15px / 1.65 var(--font-body);
  color: rgba(34, 25, 25, 0.7);
  max-width: 44ch;
  margin: 22px 0 0;
`;
const HardRules = styled.div`
  margin-top: 28px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;
const HardRule = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 13px;
  border-radius: 14px;
  border: 1px solid rgba(17, 18, 20, 0.14);
  background: rgba(255, 255, 255, 0.22);
  .mark {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    background: ${dark};
    color: #eba09a;
    font: 700 10px var(--font-mono);
  }
  .t {
    font: 500 12px / 1.4 var(--font-body);
    color: rgba(17, 18, 20, 0.78);
  }
`;
const GateDemo = styled.div`
  width: min(720px, 100%);
  min-height: 540px;
  position: relative;
  display: grid;
  place-items: center;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid rgba(17, 18, 20, 0.12);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  @media (max-width: 600px) {
    min-height: 480px;
  }
`;
const Gate = styled.div`
  position: absolute;
  left: 50%;
  top: 8%;
  bottom: 18%;
  width: 2px;
  transform: translateX(-50%);
  background: linear-gradient(transparent, ${dark} 20%, ${dark} 80%, transparent);
  &::before {
    content: "COMPLIANCE GATE";
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%) rotate(90deg);
    transform-origin: left;
    font: 600 9px var(--font-mono);
    letter-spacing: 0.14em;
    white-space: nowrap;
  }
`;
const GateRoutes = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;
const GateCore = styled(motion.div)`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 90px;
  height: 90px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: ${dark};
  color: #eba09a;
  z-index: 3;
  box-shadow: 0 0 0 12px rgba(17, 18, 20, 0.08), 0 20px 50px rgba(74, 28, 28, 0.24);
  svg {
    width: 29px;
  }
  &::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 122px;
    height: 122px;
    border-radius: 50%;
    border: 1px dashed rgba(17, 18, 20, 0.42);
    animation: ${spin} 12s linear infinite;
  }
`;
const GateRules = styled.div`
  position: absolute;
  left: 50%;
  bottom: 58px;
  transform: translateX(-50%);
  width: min(540px, 84%);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  .rule {
    padding: 7px 8px;
    border: 1px solid rgba(17, 18, 20, 0.18);
    border-radius: 99px;
    text-align: center;
    font: 600 7px var(--font-mono);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba(17, 18, 20, 0.55);
    background: rgba(255, 255, 255, 0.22);
  }
  .rule span {
    color: #27704e;
    margin-right: 3px;
  }
  @media (max-width: 600px) {
    bottom: 54px;
    width: 92%;
    .rule {
      font-size: 6px;
      padding-inline: 4px;
    }
  }
`;
const Message = styled(motion.div)<{ $safe?: boolean }>`
  position: absolute;
  width: min(250px, 42%);
  padding: 15px 16px;
  border-radius: 12px;
  border: 1px solid rgba(17, 18, 20, 0.2);
  background: ${({ $safe }) => ($safe ? "#f1ecdf" : "#f8cbc5")};
  box-shadow: 0 18px 36px rgba(65, 27, 27, 0.14);
  .tag {
    font: 600 8px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${({ $safe }) => ($safe ? "#38765a" : "#a13f3f")};
  }
  .copy {
    font: 500 12px / 1.45 var(--font-body);
    margin-top: 8px;
  }
  @media (max-width: 600px) {
    padding: 11px 10px;
    .copy {
      font-size: 10px;
    }
    .tag {
      font-size: 7px;
    }
  }
`;
const Human = styled(motion.div)`
  position: absolute;
  right: 14px;
  top: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border-radius: 99px;
  background: ${dark};
  color: #fff;
  font: 500 8px var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  svg {
    width: 14px;
    color: #eba09a;
  }
`;
const GateStatus = styled.div`
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: flex;
  gap: 18px;
  font: 600 8px var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
  .ok {
    color: #2f7755;
  }
  .bad {
    color: #9b3d3d;
  }
`;
const Replay = styled.button`
  position: absolute;
  left: 14px;
  top: 14px;
  border: 1px solid rgba(17, 18, 20, 0.25);
  background: rgba(255, 255, 255, 0.28);
  padding: 9px 13px;
  border-radius: 99px;
  font: 600 9px var(--font-mono);
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
  &:hover {
    background: rgba(255, 255, 255, 0.45);
    transform: translateY(-1px);
  }
`;

const HARD_RULES = [
  "No legal threats",
  "B2B only",
  "Disputes escalate",
  "No fabricated links",
  "Frequency limits",
  "First touch needs you",
];

export default function SafetyGate() {
  const [run, setRun] = useState(0);

  useEffect(() => {
    playLandingTone("scan");
    const block = window.setTimeout(() => playLandingTone("block"), 700);
    const pass = window.setTimeout(() => playLandingTone("pass"), 1500);
    return () => {
      window.clearTimeout(block);
      window.clearTimeout(pass);
    };
  }, [run]);

  return (
    <Safety id="safety">
      <Warning>STOP · REVIEW · STOP</Warning>
      <SafetyGrid>
        <div className="copy">
          <Eye>the hard line · deterministic, every time</Eye>
          <SafetyH>Nothing unsafe gets through.</SafetyH>
          <SafetyP>
            The AI can write. It cannot overrule the gate. Risky language, consumer debt, disputes,
            frequency violations, and invented links are blocked and escalated before a sender ever sees them.
          </SafetyP>
          <HardRules>
            {HARD_RULES.map((rule) => (
              <HardRule key={rule}>
                <span className="mark">×</span>
                <span className="t">{rule}</span>
              </HardRule>
            ))}
          </HardRules>
        </div>
        <GateDemo key={run}>
          <Gate />
          <GateRoutes viewBox="0 0 720 520" preserveAspectRatio="none" fill="none" aria-hidden="true">
            <motion.path d="M0 345C190 345 265 300 360 260C462 218 535 345 720 345" stroke="#2f7755" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.7, delay: 0.4, ease }} />
            <motion.path d="M0 150C190 150 260 215 360 260C465 210 535 75 720 62" stroke="#9b3d3d" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.55, delay: 0.25, ease }} />
          </GateRoutes>
          <GateCore initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
            <LedgerIcon name="gate" />
          </GateCore>
          <Message
            initial={{ left: "0%", top: "20%" }}
            animate={{ left: ["0%", "32%", "32%"], top: ["20%", "20%", "10%"] }}
            transition={{ duration: 2, delay: 0.25, times: [0, 0.55, 1], ease }}
          >
            <div className="tag">blocked · legal threat</div>
            <div className="copy">&ldquo;Pay today or we&apos;ll report this…&rdquo;</div>
          </Message>
          <Human initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.65 }}>
            <LedgerIcon name="gate" />
            routed to human review
          </Human>
          <Message $safe initial={{ left: "0%", top: "62%" }} animate={{ left: "54%" }} transition={{ duration: 1.8, delay: 0.45, ease }}>
            <div className="tag">passed · approved reminder</div>
            <div className="copy">&ldquo;Could you confirm when we should expect payment?&rdquo;</div>
          </Message>
          <GateRules>
            {["B2B verified", "No dispute", "Frequency clear", "Tone in bounds", "URL placeholder", "No legal threat"].map((rule) => (
              <div className="rule" key={rule}><span>✓</span>{rule}</div>
            ))}
          </GateRules>
          <GateStatus>
            <span className="bad">01 blocked</span>
            <span className="ok">06 checks passed</span>
          </GateStatus>
          <Replay
            onClick={() => {
              playLandingTone("click");
              setRun((x) => x + 1);
            }}
          >
            Run gate again ↻
          </Replay>
        </GateDemo>
      </SafetyGrid>
    </Safety>
  );
}
