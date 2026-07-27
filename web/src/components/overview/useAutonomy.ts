"use client";

// Operator autonomy preference (UI control surface). Safety gate still always runs.
// Levels only change how loudly we ask for first-touch review in the product copy
// and which Inbox items we surface first — engine compliance is never bypassed.

import { useCallback, useSyncExternalStore } from "react";

export type AutonomyLevel = "pilot" | "trusted" | "handsoff";

const KEY = "settl-autonomy-level";
const listeners = new Set<() => void>();
let value: AutonomyLevel = read();

function read(): AutonomyLevel {
  if (typeof window === "undefined") return "pilot";
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "trusted" || v === "handsoff" || v === "pilot") return v;
  } catch {
    /* private mode */
  }
  return "pilot";
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setAutonomyLevel(next: AutonomyLevel): void {
  value = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export function useAutonomyLevel(): [AutonomyLevel, (n: AutonomyLevel) => void] {
  const level = useSyncExternalStore(subscribe, () => value, () => "pilot" as AutonomyLevel);
  return [level, setAutonomyLevel];
}

export const AUTONOMY_COPY: Record<
  AutonomyLevel,
  { label: string; hint: string }
> = {
  pilot: {
    label: "Pilot",
    hint: "Approve every first contact. Safest while you learn the agent.",
  },
  trusted: {
    label: "Trusted",
    hint: "Focus Inbox on disputes, quarantine, and plans. First contacts still need an OK.",
  },
  handsoff: {
    label: "Hands-off",
    hint: "Prefer working exceptions. Gate still blocks unsafe sends — never skipped.",
  },
};
