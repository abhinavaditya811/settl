"use client";

// The voice-agent USP moment — the part nobody else has. When a written reminder
// isn't enough, the agent CALLS in a natural AI voice, in the business's name, reads
// a compliant reminder, and texts the pay link. A live-feeling "call" card with an
// animated waveform carries it. Same living background flows behind. Build-safe (CSS).

import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { c, glass, tele, screen, spotGlow } from "./palette";
import { Reveal, spotlightMove } from "./anim";

// Plays the REAL agent voice from /agent-voice.mp3 (drop the actual recording there,
// see the note in the page). Until that file exists it falls back to the browser's
// built-in voice so the button still works — but the browser voice is only a stand-in
// and does NOT match the real call.
// Tries these in order (Retell recordings are .wav; ElevenLabs exports .mp3), then
// falls back to the browser voice if neither file exists yet.
const VOICE_CLIPS = ["/agent-voice.wav", "/agent-voice.mp3"];
const SAMPLE = "Hi, this is an AI assistant calling on behalf of Brightline Studio. This is a friendly reminder that invoice for twelve hundred dollars is fifteen days past due. Please settle it at your earliest convenience. I'll text you a secure link to pay right after this call.";

const wave = keyframes`0%,100%{transform:scaleY(0.35)}50%{transform:scaleY(1)}`;
const ring = keyframes`0%{box-shadow:0 0 0 0 rgba(70,211,154,.45)}70%,100%{box-shadow:0 0 0 14px rgba(70,211,154,0)}`;

const Section = styled.section`${screen};`;
const Kicker = styled.div`${tele}; color: ${c.ok};`;
const H2 = styled.h2`font-family: ${c.display}; font-size: clamp(32px, 5vw, 54px); line-height: 1.0; letter-spacing: -0.038em; font-weight: 700; margin: 12px 0 0; max-width: 20ch;`;
const Lead = styled.p`font-size: 16px; line-height: 1.65; color: ${c.muted}; max-width: 56ch; margin: 16px 0 0; b { color: ${c.ink}; font-weight: 600; }`;

const Grid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; margin-top: 44px;
  @media (max-width: 820px) { grid-template-columns: 1fr; gap: 30px; }
`;
const Points = styled.div`display: flex; flex-direction: column; gap: 14px;`;
const Point = styled.div`
  ${glass}; ${spotGlow}; border-radius: 13px; padding: 16px 18px; display: flex; gap: 13px; align-items: flex-start;
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
  &:hover { transform: translateY(-4px); border-color: rgba(70,211,154,0.45); box-shadow: 0 16px 38px rgba(0,0,0,0.3); }
  .ic { color: ${c.ok}; font-family: ${c.mono}; font-size: 13px; margin-top: 1px; }
  .t { font-size: 14.5px; color: ${c.ink}; line-height: 1.5; b { font-weight: 600; } }
`;

const Call = styled.div`${glass}; ${spotGlow}; border-radius: 20px; padding: 26px;`;
const CHead = styled.div`
  display: flex; align-items: center; gap: 13px; padding-bottom: 18px; border-bottom: 1px solid ${c.line};
  .av { width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; background: linear-gradient(135deg, ${c.accent2}, ${c.accent}); animation: ${ring} 2.2s ease-out infinite; }
  .who { font-family: ${c.display}; font-weight: 600; font-size: 15.5px; }
  .sub { ${tele}; color: ${c.faint}; margin-top: 3px; }
  .timer { margin-left: auto; font-family: ${c.mono}; font-size: 12px; color: ${c.ok}; }
`;
const Wave = styled.div`
  display: flex; align-items: center; justify-content: center; gap: 4px; height: 54px; margin: 20px 0;
  span { width: 4px; height: 30px; border-radius: 3px; background: linear-gradient(${c.accent2}, ${c.ok}); transform-origin: center; animation: ${wave} 1s ease-in-out infinite; }
`;
const Said = styled.div`font-size: 14px; line-height: 1.6; color: ${c.ink}; background: rgba(255,255,255,0.03); border-radius: 11px; padding: 13px 15px; b { color: ${c.accent2}; }`;
const Texted = styled.div`display: flex; align-items: center; gap: 9px; margin-top: 16px; font-size: 13px; color: ${c.muted}; .chip { font-family: ${c.mono}; font-size: 10.5px; letter-spacing: 0.05em; padding: 3px 9px; border-radius: 6px; color: ${c.ok}; background: ${c.okBg}; }`;
const HearRow = styled.div`display: flex; justify-content: center; margin: 2px 0 16px;`;
const HearBtn = styled.button`
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font-family: ${c.body}; font-size: 13px; font-weight: 600; color: ${c.ink};
  background: rgba(255,255,255,0.05); border: 1px solid ${c.glassBorder}; border-radius: 999px; padding: 9px 18px;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  &:hover { background: rgba(255,255,255,0.09); border-color: ${c.ok}; box-shadow: 0 0 20px rgba(70,211,154,0.2); }
`;

const BARS = [0, 0.22, 0.45, 0.15, 0.6, 0.3, 0.5, 0.1, 0.4, 0.25, 0.55, 0.18];

// Plays the REAL agent recording; falls back to the browser voice if it's missing.
function HearButton() {
  const [on, setOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audioRef.current?.pause(); window.speechSynthesis?.cancel(); }, []);
  const fallbackSpeak = () => {
    if (!window.speechSynthesis) { setOn(false); return; }
    const u = new SpeechSynthesisUtterance(SAMPLE);
    u.onend = () => setOn(false); u.onerror = () => setOn(false);
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  };
  const tryPlay = (i: number) => {
    if (i >= VOICE_CLIPS.length) { fallbackSpeak(); return; }
    const a = new Audio(VOICE_CLIPS[i]);
    a.onended = () => setOn(false);
    a.play().then(() => { audioRef.current = a; }).catch(() => tryPlay(i + 1));
  };
  const stop = () => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; window.speechSynthesis?.cancel(); setOn(false); };
  const toggle = () => {
    if (typeof window === "undefined") return;
    if (on) { stop(); return; }
    setOn(true); tryPlay(0);
  };
  return <HearBtn onClick={toggle} aria-label={on ? "Stop the sample" : "Hear the agent"}>{on ? "◼ Stop" : "▶ Hear the agent talk"}</HearBtn>;
}

export default function VoiceHighlight() {
  return (
    <Section id="voice">
      <Reveal>
        <Kicker>// the part nobody else has</Kicker>
        <H2>When a reminder isn&apos;t enough, it picks up the phone.</H2>
        <Lead>Settl can call your overdue customer in a natural AI voice, in your business&apos;s name, read a compliant reminder out loud, and text the secure payment link. It uses a polished default voice out of the box, or a clone of <b>your own voice</b> if you opt in, so the reminder sounds like it came straight from you.</Lead>
      </Reveal>
      <Grid>
        <Reveal delay={0.05}>
          <Points>
            <Point onMouseMove={spotlightMove}><span className="ic">01</span><span className="t"><b>Discloses it&apos;s AI</b> the moment the call opens. Always. For every voice.</span></Point>
            <Point onMouseMove={spotlightMove}><span className="ic">02</span><span className="t"><b>Only calls with consent</b>, inside allowed hours, B2B only. Says &quot;stop&quot; once and it never calls again.</span></Point>
            <Point onMouseMove={spotlightMove}><span className="ic">03</span><span className="t"><b>Never takes payment on the call.</b> It texts your link. Money only ever moves through your processor.</span></Point>
            <Point onMouseMove={spotlightMove}><span className="ic">04</span><span className="t"><b>The same hard gate</b> clears every call before it dials, exactly like an email.</span></Point>
          </Points>
        </Reveal>
        <Reveal delay={0.12}>
          <Call onMouseMove={spotlightMove}>
            <CHead>
              <span className="av" aria-hidden="true">📞</span>
              <div>
                <div className="who">Settl voice agent</div>
                <div className="sub">calling on behalf of Brightline Studio · live</div>
              </div>
              <span className="timer">00:14</span>
            </CHead>
            <Wave aria-hidden="true">
              {BARS.map((d, i) => (<span key={i} style={{ animationDelay: `${d}s` }} />))}
            </Wave>
            <HearRow><HearButton /></HearRow>
            <Said>&quot;Hi, this is an <b>AI assistant</b> calling on behalf of Brightline Studio. This is a friendly reminder that invoice INV-DEMO for $1,200 is 15 days past due. Please settle it at your earliest convenience. I&apos;ll text you a secure link to pay right after this call.&quot;</Said>
            <Texted><span className="chip">SMS SENT</span> Secure payment link texted to the customer.</Texted>
          </Call>
        </Reveal>
      </Grid>
    </Section>
  );
}
