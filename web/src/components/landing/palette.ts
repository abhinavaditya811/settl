// "Operational Ledger" art direction: editorial finance typography, precise rules,
// restrained depth, and semantic state colors. Self-contained so the marketing page
// can evolve independently from the dashboard theme.

import { css, keyframes } from "styled-components";

export const kfPulse = keyframes`0%,100%{opacity:1}50%{opacity:.58}`;
export const kfScan = keyframes`0%{transform:translateX(-100%)}100%{transform:translateX(180%)}`;
export const kfRing = keyframes`0%{box-shadow:0 0 0 0 rgba(119,215,170,.38)}70%,100%{box-shadow:0 0 0 7px rgba(119,215,170,0)}`;

export const c = {
  bg: "#0c0d0c",
  bgDeep: "#080908",
  surface: "#121412",
  surfaceRaised: "#171917",
  paper: "#f0ede4",
  ink: "#f2f0e9",
  muted: "#aaa9a2",
  faint: "#74766f",
  accent: "#7769e8",
  accent2: "#a79cf7",
  line: "rgba(240,237,228,0.11)",
  lineStrong: "rgba(240,237,228,0.2)",
  glassBg: "rgba(18,20,18,0.82)",
  glassBorder: "rgba(240,237,228,0.13)",
  ok: "#77d7aa", okBg: "rgba(119,215,170,0.12)",
  warn: "#e6ba68", warnBg: "rgba(230,186,104,0.12)",
  bad: "#ee7777", badBg: "rgba(238,119,119,0.12)",
  display: "var(--font-display), system-ui, sans-serif",
  body: "var(--font-body), system-ui, sans-serif",
  mono: "var(--font-mono), ui-monospace, monospace",
};

// Primary product surface: mostly opaque and precise; blur is supporting detail.
export const glass = css`
  background: ${c.glassBg};
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  border: 1px solid ${c.glassBorder};
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), 0 24px 70px rgba(0,0,0,0.32);
`;

// Ledger notation: reserved for IDs, timestamps, states, and section indices.
export const tele = css`
  font-family: ${c.mono};
  font-size: 10.5px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: ${c.faint};
`;

export const screen = css`
  padding: 124px 0 0;
  @media (max-width: 720px) { padding-top: 88px; }
`;

export const focusRing = css`
  &:focus-visible {
    outline: 2px solid ${c.accent2};
    outline-offset: 3px;
  }
`;

// Used selectively on interactive product artifacts, not every container.
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
    background: radial-gradient(340px circle at var(--mx, 50%) var(--my, 0%), rgba(167,156,247,0.11), transparent 58%);
  }
  &:hover::after { opacity: 1; }
`;
