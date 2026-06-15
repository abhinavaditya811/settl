"use client";

// App-wide theme state: holds light/dark mode, persists the choice, and wires the
// styled-components ThemeProvider + a small global style. Exposes useThemeMode()
// so the toggle button can flip it from anywhere.

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider, createGlobalStyle } from "styled-components";
import { themes, type ThemeMode } from "./theme";

const STORAGE_KEY = "settl-theme";

const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }
  html, body { padding: 0; margin: 0; }
  body {
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    transition: background 0.2s ease, color 0.2s ease;
  }
  a { color: inherit; }
`;

interface ThemeCtx {
  mode: ThemeMode;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ mode: "light", toggle: () => {} });

export function useThemeMode(): ThemeCtx {
  return useContext(Ctx);
}

export default function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  // After mount, adopt the stored choice (or the OS preference).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "light" || stored === "dark") {
      setMode(stored);
    } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setMode("dark");
    }
  }, []);

  const value = useMemo<ThemeCtx>(
    () => ({
      mode,
      toggle: () =>
        setMode((m) => {
          const next = m === "light" ? "dark" : "light";
          window.localStorage.setItem(STORAGE_KEY, next);
          return next;
        }),
    }),
    [mode],
  );

  return (
    <Ctx.Provider value={value}>
      <ThemeProvider theme={themes[mode]}>
        <GlobalStyle />
        {children}
      </ThemeProvider>
    </Ctx.Provider>
  );
}
