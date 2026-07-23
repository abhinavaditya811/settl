"use client";

// Shared "technical trace" preference: when on, the timeline and activity feed
// show raw agent/decision/reasoning instead of the plain-English milestone view.
// A developer escape hatch - off by default, persisted, and synced across every
// surface that reads it (the per-invoice drawer and the Activity tab) so toggling
// in one place updates the other. useSyncExternalStore keeps React in step with
// the module-level store.

import { useSyncExternalStore } from "react";

const KEY = "settl-technical-trace";
const listeners = new Set<() => void>();
let value = read();

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setTechnicalTrace(on: boolean): void {
  value = on;
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore write failures (private mode etc.) */
  }
  listeners.forEach((fn) => fn());
}

export function useTechnicalTrace(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => value, () => false);
  return [on, setTechnicalTrace];
}
