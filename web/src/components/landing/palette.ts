// Bespoke art direction for the landing ("Mission Control" — dark, cinematic,
// glassmorphism). Self-contained so the marketing page isn't tied to the dashboard
// theme tokens. Colors are literal on purpose — this is a crafted surface.

import { css, keyframes } from "styled-components";

export const kfPulse = keyframes`0%,100%{opacity:1}50%{opacity:.4}`;
export const kfScan = keyframes`0%{transform:translateX(-100%)}100%{transform:translateX(180%)}`;
export const kfRing = keyframes`0%{box-shadow:0 0 0 0 rgba(70,211,154,.5)}70%,100%{box-shadow:0 0 0 6px rgba(70,211,154,0)}`;

export const c = {
  bg: "#0a0b10",
  bgDeep: "#070709",
  ink: "#f4f5fa",
  muted: "#9aa0ae",
  faint: "#6b7080",
  accent: "#6d5ef6",
  accent2: "#9b8cff",
  line: "rgba(255,255,255,0.08)",
  glassBg: "rgba(255,255,255,0.045)",
  glassBorder: "rgba(255,255,255,0.10)",
  ok: "#46d39a", okBg: "rgba(70,211,154,0.13)",
  warn: "#e8b84b", warnBg: "rgba(232,184,75,0.13)",
  bad: "#ff6b6b", badBg: "rgba(255,107,107,0.13)",
  display: "var(--font-display), system-ui, sans-serif",
  body: "var(--font-body), system-ui, sans-serif",
  mono: "var(--font-mono), ui-monospace, monospace",
};

// Frosted-glass panel. Needs the ambient glow behind it to blur against.
export const glass = css`
  background: ${c.glassBg};
  backdrop-filter: blur(22px) saturate(1.4);
  -webkit-backdrop-filter: blur(22px) saturate(1.4);
  border: 1px solid ${c.glassBorder};
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 30px 70px rgba(0, 0, 0, 0.45);
`;

// Small uppercase mono "telemetry" label — the mission-control signature.
export const tele = css`
  font-family: ${c.mono};
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${c.faint};
`;

// Standard vertical rhythm between major landing sections. Sections are sized to
// their content (never stretched to the viewport) — dense and intentional beats big
// empty screens. Tune the single value here to re-pace the whole page at once.
export const screen = css`
  padding: 104px 0 0;
`;

// Card cursor-glow: a soft radial highlight that follows the pointer across the card
// (pair with spotlightMove() from anim as onMouseMove). Uses ::after so it composes
// with a card's own ::before; --mx/--my default to the top-center before first move.
export const spotGlow = css`
  position: relative;
  overflow: hidden;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.35s ease;
    background: radial-gradient(360px circle at var(--mx, 50%) var(--my, 0%), rgba(155, 140, 255, 0.16), transparent 55%);
  }
  &:hover::after { opacity: 1; }
`;
