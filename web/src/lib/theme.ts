// Light & dark design tokens. One shape, two palettes - components read only the
// semantic names, never raw hex, so theming stays consistent.

import type { TerminalState } from "./types";

export type ThemeMode = "light" | "dark";

interface StatusColor {
  fg: string;
  bg: string;
}

export interface AppTheme {
  mode: ThemeMode;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  shadow: string;
  status: Record<TerminalState, StatusColor>;
}

export const lightTheme: AppTheme = {
  mode: "light",
  bg: "#f5f6f8",
  surface: "#ffffff",
  surfaceAlt: "#f0f2f5",
  border: "#e4e7eb",
  text: "#16191d",
  textMuted: "#616b78",
  accent: "#5b5bd6",
  accentText: "#ffffff",
  shadow: "0 1px 2px rgba(16,24,40,0.04)",
  status: {
    sent: { fg: "#0f7b3f", bg: "#e6f4ea" },
    awaiting_approval: { fg: "#9a6700", bg: "#fff4d6" },
    escalated: { fg: "#b42318", bg: "#fde8e6" },
    skipped: { fg: "#4b5563", bg: "#eef0f3" },
    held: { fg: "#1d4ed8", bg: "#e4ecff" },
    quarantined: { fg: "#b54708", bg: "#fdecd8" },
  },
};

export const darkTheme: AppTheme = {
  mode: "dark",
  bg: "#0d1117",
  surface: "#161b22",
  surfaceAlt: "#1c232c",
  border: "#2a323d",
  text: "#e6edf3",
  textMuted: "#8b949e",
  accent: "#7c83ff",
  accentText: "#0d1117",
  shadow: "0 1px 2px rgba(0,0,0,0.25)",
  status: {
    sent: { fg: "#3fb950", bg: "#132a1c" },
    awaiting_approval: { fg: "#e3b341", bg: "#332810" },
    escalated: { fg: "#f85149", bg: "#3a1614" },
    skipped: { fg: "#9aa4b2", bg: "#21262d" },
    held: { fg: "#6ea8fe", bg: "#152238" },
    quarantined: { fg: "#e8923c", bg: "#33230f" },
  },
};

export const themes: Record<ThemeMode, AppTheme> = {
  light: lightTheme,
  dark: darkTheme,
};
