"use client";

import styled, { keyframes } from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { LedgerIcon } from "./LedgerIcons";
import type { VoiceState } from "./useVoiceSample";

const violet = "#7466f2";
const mint = "#76d9aa";
const ease = [0.22, 0.7, 0.2, 1] as const;
const wave = keyframes`0%,100%{transform:scaleY(.18)}50%{transform:scaleY(1)}`;
const orbit = keyframes`to{transform:rotate(360deg)}`;
const pulse = keyframes`0%,100%{opacity:.5}50%{opacity:1}`;

const CallStage = styled.div`
  min-height: 620px;
  display: grid;
  place-items: center;
  position: relative;
  @media (max-width: 700px) {
    min-height: 520px;
    order: -1;
  }
`;
const Ring = styled.div<{ $active: boolean }>`
  position: absolute;
  width: min(560px, 92vw);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  animation: ${orbit} 30s linear infinite;
  animation-play-state: ${({ $active }) => ($active ? "running" : "paused")};
  &::before,
  &::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    border: 1px dashed rgba(118, 217, 170, 0.22);
  }
  &::before {
    inset: 10%;
  }
  &::after {
    inset: 23%;
    animation: ${orbit} 18s linear infinite reverse;
  }
`;
const Dot = styled.span`
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${mint};
  top: 8%;
  left: 50%;
  box-shadow: 0 0 20px ${mint};
  animation: ${pulse} 1.8s ease infinite;
`;
const CallCard = styled(motion.div)`
  width: min(480px, 92vw);
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(32, 28, 46, 0.96), rgba(16, 14, 24, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 48px 120px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  position: relative;
  z-index: 2;
  overflow: hidden;
`;
const CallChrome = styled.div`
  height: 38px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font: 500 8px var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.34);
  .lights {
    display: flex;
    gap: 5px;
  }
  .lights i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
  }
  .lights i:first-child {
    background: ${mint};
    box-shadow: 0 0 10px ${mint};
  }
`;
const CallTop = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 22px 12px;
  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: ${mint};
    background: radial-gradient(circle at 30% 30%, rgba(118, 217, 170, 0.28), rgba(118, 217, 170, 0.08));
    border: 1px solid rgba(118, 217, 170, 0.35);
    box-shadow: 0 0 0 6px rgba(118, 217, 170, 0.08);
  }
  .avatar svg {
    width: 22px;
  }
  .name {
    font: 600 16px var(--font-display);
  }
  .sub {
    font: 500 8px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.38);
    margin-top: 5px;
  }
  .time {
    margin-left: auto;
    font: 600 14px var(--font-mono);
    color: ${mint};
  }
`;
const Bars = styled.div<{ $play: boolean }>`
  height: 128px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  margin: 8px 20px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 50%, rgba(116, 102, 242, 0.28), transparent 66%),
    rgba(255, 255, 255, 0.02);
  span {
    width: 3px;
    height: 48px;
    border-radius: 3px;
    background: linear-gradient(${violet}, ${mint});
    transform-origin: center;
    animation: ${wave} 0.9s ease-in-out infinite;
    animation-play-state: ${({ $play }) => ($play ? "running" : "paused")};
    transform: scaleY(${({ $play }) => ($play ? 0.35 : 0.1)});
    opacity: ${({ $play }) => ($play ? 1 : 0.4)};
  }
`;
const Play = styled.button`
  width: calc(100% - 40px);
  margin: 0 20px;
  padding: 13px 16px;
  border-radius: 99px;
  border: 1px solid rgba(118, 217, 170, 0.35);
  background: linear-gradient(90deg, rgba(118, 217, 170, 0.18), rgba(116, 102, 242, 0.16));
  color: #fff;
  font: 600 13px var(--font-body);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 34px rgba(118, 217, 170, 0.18);
    filter: brightness(1.05);
  }
  svg {
    width: 16px;
  }
`;
const Transcript = styled.div`
  margin: 16px 20px 18px;
  padding: 15px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font: 400 12px / 1.65 var(--font-body);
  color: rgba(255, 255, 255, 0.35);
  .transcript-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 9px;
    font: 500 8px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.32);
  }
  span {
    transition: color 0.2s ease;
  }
  .heard {
    color: #fff;
  }
  .ai {
    color: #aaa0ff;
  }
`;
const Track = styled.div`
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  margin-top: 12px;
  overflow: hidden;
  div {
    height: 100%;
    background: linear-gradient(90deg, ${violet}, ${mint});
    transform-origin: left;
  }
`;
const Sms = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: ${mint};
  font: 500 9px var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;
const CallMeta = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  .meta {
    padding: 13px 10px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }
  .meta:last-child {
    border: 0;
  }
  .k {
    font: 500 7px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
  }
  .v {
    font: 600 9px var(--font-mono);
    color: ${mint};
    margin-top: 4px;
  }
`;

const SCRIPT = [
  ["Hi, this is an ", ""],
  ["AI assistant", "ai"],
  [" calling on behalf of Brightline Studio. ", ""],
  ["This is a friendly reminder that invoice INV-DEMO for $1,200 is 15 days past due. ", ""],
  ["I'll text you a secure link to pay right after this call.", ""],
];
const AT = [0, 0.08, 0.18, 0.38, 0.76];

type Props = {
  active: boolean;
  state: VoiceState;
  toggle: () => void;
};

export default function VoiceCallCard({ active, state, toggle }: Props) {
  const elapsed = `00:${Math.floor(state.elapsed).toString().padStart(2, "0")}`;

  return (
    <CallStage>
      <Ring $active={active}><Dot /></Ring>
      <CallCard initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}>
        <CallChrome>
          <span className="lights"><i /><i /><i /></span>
          <span>voice session · live simulation</span>
          <span>ch · 02</span>
        </CallChrome>
        <CallTop>
          <span className="avatar"><LedgerIcon name="phone" /></span>
          <div>
            <div className="name">Settl voice agent</div>
            <div className="sub">calling for Brightline Studio · AI disclosed</div>
          </div>
          <span className="time">{elapsed}</span>
        </CallTop>
        <Bars $play={state.playing}>
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 7) * 0.08}s` }} />
          ))}
        </Bars>
        <Play onClick={toggle} aria-pressed={state.playing}>
          {state.playing ? "■ Stop sample" : <><LedgerIcon name="phone" /> Hear the agent talk</>}
        </Play>
        <Transcript>
          <div className="transcript-label">
            <span>live transcript</span>
            <span>{state.playing ? "listening" : "ready"}</span>
          </div>
          {SCRIPT.map(([text, kind], i) => (
            <span key={text} className={`${state.progress >= AT[i] && state.progress > 0 ? "heard" : ""} ${kind}`}>
              {text}
            </span>
          ))}
          <Track><motion.div animate={{ scaleX: state.progress }} /></Track>
          <AnimatePresence>
            {state.progress > 0.78 && (
              <Sms initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <LedgerIcon name="send" width={14} />
                payment-link SMS {state.complete ? "delivered" : "queued"}
              </Sms>
            )}
          </AnimatePresence>
        </Transcript>
        <CallMeta>
          <div className="meta"><div className="k">Consent</div><div className="v">VERIFIED</div></div>
          <div className="meta"><div className="k">Gate</div><div className="v">PASSED</div></div>
          <div className="meta"><div className="k">Payment</div><div className="v">SMS ONLY</div></div>
        </CallMeta>
      </CallCard>
    </CallStage>
  );
}
