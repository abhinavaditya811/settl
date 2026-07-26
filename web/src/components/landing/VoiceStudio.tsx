"use client";

import { useRef } from "react";
import styled from "styled-components";
import { motion, useInView } from "framer-motion";
import { LedgerIcon } from "./LedgerIcons";
import { useVoiceSample } from "./useVoiceSample";
import VoiceCallCard from "./VoiceCallCard";

const mint = "#76d9aa";
const ease = [0.22, 0.7, 0.2, 1] as const;

const Voice = styled.section`
  min-height: 100svh;
  position: relative;
  overflow: hidden;
  display: grid;
  align-items: center;
  color: #f7f2e8;
  background:
    radial-gradient(900px 660px at 22% 35%, rgba(116, 102, 242, 0.34), transparent 65%),
    #0d0c12;
`;
const VoiceWord = styled.div`
  position: absolute;
  right: -4vw;
  bottom: -8vw;
  font: 600 31vw / 0.7 var(--font-display);
  letter-spacing: -0.09em;
  color: rgba(255, 255, 255, 0.025);
  pointer-events: none;
`;
const VoiceGrid = styled.div`
  width: min(1280px, calc(100% - 52px));
  margin: auto;
  padding: 110px 0;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 64px;
  align-items: center;
  position: relative;
  z-index: 2;
  @media (max-width: 900px) {
    width: calc(100% - 34px);
    grid-template-columns: 1fr;
    padding: 90px 0;
    gap: 48px;
  }
`;
const Eyebrow = styled.div`
  font: 500 10px var(--font-mono);
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: ${mint};
`;
const VoiceH = styled.h2`
  font: 600 clamp(48px, 6.6vw, 92px) / 0.9 var(--font-display);
  letter-spacing: -0.07em;
  margin: 16px 0 0;
  max-width: 10ch;
`;
const VoiceP = styled.p`
  font: 400 15px / 1.65 var(--font-body);
  color: rgba(255, 255, 255, 0.58);
  max-width: 42ch;
  margin: 22px 0 0;
`;
const RuleCards = styled.div`
  margin-top: 28px;
  display: grid;
  gap: 10px;
`;
const RuleCard = styled(motion.div)`
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 14px;
  align-items: start;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease;
  &:hover {
    border-color: rgba(118, 217, 170, 0.35);
    background: rgba(118, 217, 170, 0.06);
    transform: translateX(4px);
  }
  .ico {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: ${mint};
    background: rgba(118, 217, 170, 0.1);
    border: 1px solid rgba(118, 217, 170, 0.22);
  }
  .ico svg {
    width: 18px;
  }
  .n {
    font: 500 9px var(--font-mono);
    letter-spacing: 0.1em;
    color: ${mint};
  }
  .t {
    font: 500 13px / 1.45 var(--font-body);
    color: rgba(255, 255, 255, 0.78);
    margin-top: 4px;
  }
`;

const RULES = [
  { n: "01", icon: "gate" as const, t: "Consent and allowed calling hours are verified before dialing." },
  { n: "02", icon: "draft" as const, t: "Every script clears the same deterministic gate as email." },
  { n: "03", icon: "send" as const, t: "Payment never happens on the call. The link is texted after." },
];

export default function VoiceStudio() {
  const { state, toggle } = useVoiceSample();
  const voiceRef = useRef<HTMLElement>(null);
  const voiceVisible = useInView(voiceRef, { margin: "180px" });

  return (
    <Voice id="voice" ref={voiceRef}>
      <VoiceWord>CALLS</VoiceWord>
      <VoiceGrid>
        <VoiceCallCard active={voiceVisible} state={state} toggle={toggle} />

        <div>
          <Eyebrow>the voice channel · optional, disclosed, compliant</Eyebrow>
          <VoiceH>When email stalls, the agent speaks.</VoiceH>
          <VoiceP>
            The same recovery path can place a natural AI voice call in your business&apos;s name.
            It discloses itself, reads the approved reminder, and texts the secure payment link after the call.
          </VoiceP>
          <RuleCards>
            {RULES.map((rule, i) => (
              <RuleCard key={rule.n} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 * i, duration: 0.45, ease }}>
                <span className="ico"><LedgerIcon name={rule.icon} /></span>
                <div>
                  <div className="n">{rule.n}</div>
                  <div className="t">{rule.t}</div>
                </div>
              </RuleCard>
            ))}
          </RuleCards>
        </div>
      </VoiceGrid>
    </Voice>
  );
}
