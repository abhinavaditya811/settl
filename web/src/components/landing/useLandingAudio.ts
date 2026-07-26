"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "settl_landing_sfx";

export type LandingTone = "click" | "scan" | "block" | "pass" | "stage";

let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function tone(kind: LandingTone) {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.connect(gain);
  gain.connect(audio.destination);

  const table: Record<LandingTone, { f: number; d: number; type: OscillatorType; peak: number }> = {
    click: { f: 620, d: 0.045, type: "triangle", peak: 0.04 },
    stage: { f: 480, d: 0.07, type: "sine", peak: 0.035 },
    scan: { f: 880, d: 0.22, type: "sawtooth", peak: 0.018 },
    block: { f: 190, d: 0.16, type: "square", peak: 0.03 },
    pass: { f: 720, d: 0.12, type: "sine", peak: 0.03 },
  };
  const t = table[kind];
  osc.type = t.type;
  osc.frequency.setValueAtTime(t.f, now);
  if (kind === "scan") osc.frequency.exponentialRampToValueAtTime(240, now + t.d);
  if (kind === "pass") osc.frequency.exponentialRampToValueAtTime(980, now + t.d);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(t.peak, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + t.d);
  osc.start(now);
  osc.stop(now + t.d + 0.02);
}

export function playLandingTone(kind: LandingTone) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (localStorage.getItem(KEY) === "0") return;
  try {
    tone(kind);
  } catch {
    /* ignore autoplay / AudioContext failures */
  }
}

export function useLandingAudio() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored === "0") setEnabled(false);
    else if (stored === "1") setEnabled(true);
    else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setEnabled(false);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "1" : "0");
      if (next) playLandingTone("click");
      return next;
    });
  }, []);

  return { enabled, toggle, play: playLandingTone };
}
