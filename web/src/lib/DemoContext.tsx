"use client";

// Tracks whether the operator has opted into the synthetic demo board.
//
// Right after login a real user has no data, so the dashboard shows the
// zero-state/onboarding. Choosing "Explore the demo" flips this flag and the
// synthetic board appears. The choice is persisted in localStorage so a reload
// keeps it.
//
// This is a deliberately client-only stand-in: there is no per-user store yet
// (Neon + CSV upload are later branches). When real per-user invoices exist,
// "has data" replaces this flag as the gate.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const KEY = "settl:demo";

interface DemoCtx {
  demoEnabled: boolean;
  ready: boolean; // true once localStorage has been read (avoids a zero-state flash)
  enableDemo: () => void;
  exitDemo: () => void;
}

const Ctx = createContext<DemoCtx | null>(null);

export function useDemo(): DemoCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}

export default function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDemoEnabled(window.localStorage.getItem(KEY) === "1");
    } catch {
      // localStorage unavailable (private mode etc.) - default to off.
    }
    setReady(true);
  }, []);

  const enableDemo = useCallback(() => {
    setDemoEnabled(true);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const exitDemo = useCallback(() => {
    setDemoEnabled(false);
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <Ctx.Provider value={{ demoEnabled, ready, enableDemo, exitDemo }}>
      {children}
    </Ctx.Provider>
  );
}
