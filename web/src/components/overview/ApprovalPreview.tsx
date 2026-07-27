"use client";

// Channel-specific draft preview + inline editor for Approvals.

import { useEffect, useRef, useState, type RefObject } from "react";
import styled from "styled-components";
import { formatMoney } from "@/lib/format";

const Frame = styled.div`
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 14px;
  overflow: hidden;
  background: ${({ theme }) => theme.surfaceAlt};
`;

const FrameHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  padding: 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  font-size: 12.5px;
  color: ${({ theme }) => theme.textMuted};
  b {
    font-weight: 600;
    color: ${({ theme }) => theme.text};
  }
`;

const FrameBody = styled.div`
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: ${({ theme }) => theme.text};
`;

const Bubble = styled.div`
  max-width: 88%;
  padding: 12px 14px;
  border-radius: 16px 16px 16px 6px;
  font-size: 14px;
  line-height: 1.55;
  color: ${({ theme }) => theme.status.held.fg};
  background: ${({ theme }) => theme.status.held.bg};
  border: 1px solid ${({ theme }) => `${theme.status.held.fg}33`};
  white-space: pre-wrap;
`;

const VoiceBox = styled.div`
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surfaceAlt};
  .label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.textMuted};
  }
  .script {
    margin-top: 8px;
    font-size: 14px;
    line-height: 1.55;
    white-space: pre-wrap;
    color: ${({ theme }) => theme.text};
  }
`;

const Pay = styled.span`
  display: inline-block;
  margin-top: 12px;
  padding: 8px 14px;
  border-radius: 9px;
  background: ${({ theme }) => theme.accent};
  color: ${({ theme }) => theme.accentText};
  font-size: 12.5px;
  font-weight: 700;
`;

const Editor = styled.textarea`
  width: 100%;
  min-height: 120px;
  resize: vertical;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.accent};
  background: ${({ theme }) => theme.surfaceAlt};
  color: ${({ theme }) => theme.text};
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px ${({ theme }) => `${theme.accent}33`};
  }
`;

const Loading = styled.div`
  padding: 16px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surfaceAlt};
  .bar {
    height: 10px;
    border-radius: 6px;
    background: ${({ theme }) => theme.border};
    margin-bottom: 10px;
    animation: pulse 1.1s ease-in-out infinite;
  }
  .bar:nth-child(2) {
    width: 92%;
  }
  .bar:nth-child(3) {
    width: 78%;
    margin-bottom: 0;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.9;
    }
  }
`;

const Btn = styled.button`
  font-size: 13.5px;
  font-weight: 600;
  padding: 9px 14px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  &:hover {
    filter: brightness(1.04);
  }
`;

export function PlayScript({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const toggle = () => {
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };
  return (
    <Btn onClick={toggle} aria-label={playing ? "Stop preview" : "Play call script"}>
      {playing ? "Stop preview" : "Play script"}
    </Btn>
  );
}

export function ApprovalEditor({
  value,
  onChange,
  onKeyDown,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
}) {
  return (
    <Editor
      ref={inputRef as React.LegacyRef<HTMLTextAreaElement>}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      spellCheck
    />
  );
}

export function ApprovalMessage({
  channel,
  debtorName,
  preview,
  amount,
  currency,
  loading,
}: {
  channel: string;
  debtorName: string;
  preview: string;
  amount: string;
  currency: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Loading aria-label="Loading draft">
        <div className="bar" />
        <div className="bar" />
        <div className="bar" />
      </Loading>
    );
  }
  if (channel === "email") {
    return (
      <Frame>
        <FrameHead>
          <span>
            To <b>{debtorName}</b>
          </span>
          <span>·</span>
          <span>First reminder</span>
        </FrameHead>
        <FrameBody>
          {preview}
          {"\n"}
          <Pay>Pay {formatMoney(amount, currency)} ↗</Pay>
        </FrameBody>
      </Frame>
    );
  }
  if (channel === "voice") {
    return (
      <VoiceBox>
        <div className="label">Call script</div>
        <div className="script">{preview}</div>
      </VoiceBox>
    );
  }
  return <Bubble>{preview}</Bubble>;
}
