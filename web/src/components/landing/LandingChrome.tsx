"use client";

import { useEffect } from "react";
import styled from "styled-components";
import { useLandingAudio } from "./useLandingAudio";

const SECTIONS = new Set(["voice", "console", "safety", "pricing", "recovery-story"]);
const TABS = new Set(["overview", "inbox", "approvals", "invoices", "plans", "activity"]);
const STAGE_RE = /^stage-([1-6])$/;

const Mute = styled.button`
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 90;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(17, 18, 20, 0.72);
  color: rgba(246, 241, 232, 0.82);
  backdrop-filter: blur(12px);
  font: 600 9px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
  &:hover {
    background: rgba(17, 18, 20, 0.9);
    border-color: rgba(118, 217, 170, 0.45);
    transform: translateY(-1px);
  }
`;

function applyHash(hash: string) {
  const id = hash.replace(/^#/, "");
  if (!id) return;

  const stageMatch = STAGE_RE.exec(id);
  if (stageMatch) {
    const index = Number(stageMatch[1]) - 1;
    window.dispatchEvent(new CustomEvent("settl:stage", { detail: { index } }));
    document.getElementById("recovery-story")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (TABS.has(id)) {
    window.dispatchEvent(new CustomEvent("settl:console-tab", { detail: { tab: id } }));
    document.getElementById("console")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (SECTIONS.has(id)) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function LandingChrome() {
  const { enabled, toggle } = useLandingAudio();

  useEffect(() => {
    const run = () => applyHash(window.location.hash);
    run();
    window.addEventListener("hashchange", run);
    return () => window.removeEventListener("hashchange", run);
  }, []);

  return (
    <Mute type="button" onClick={toggle} aria-pressed={enabled} title="Toggle landing sound">
      {enabled ? "Sound on" : "Sound off"}
    </Mute>
  );
}

export function setLandingHash(id: string) {
  if (typeof window === "undefined") return;
  if (window.location.hash === `#${id}`) return;
  history.replaceState(null, "", `#${id}`);
}
