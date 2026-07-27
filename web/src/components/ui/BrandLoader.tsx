"use client";

// Playful loader shared across the app: full-page on the sign-in page (checking
// a session, opening Google's consent screen, redirecting to /dashboard) and
// the dashboard's own first load, or inline within an already-rendered layout
// (e.g. BoardShell's overview tab, where the sidebar/top bar are already up and
// only the content slot is waiting). Same spirit as the landing page's Preloader
// (components/landing/Preloader.tsx) - a spinning halo, an animated mark, a
// rotating status line - but built on the app's own theme tokens (lib/theme.ts)
// instead of the landing page's fixed dark palette, so it stays correct in both
// light and dark mode.

import styled, { keyframes, useTheme } from "styled-components";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { AppTheme } from "@/lib/theme";

const spin = keyframes`to { transform: rotate(360deg); }`;

const Wrap = styled.div<{ $inline?: boolean }>`
  min-height: ${({ $inline }) => ($inline ? "320px" : "100vh")};
  display: grid;
  place-items: center;
  padding: 24px;
  background: ${({ $inline, theme }) => ($inline ? "transparent" : theme.bg)};
`;

const Stack = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const Halo = styled.div`
  position: absolute;
  top: -80px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  pointer-events: none;
  background: conic-gradient(
    from 0deg,
    transparent,
    ${({ theme }) => theme.accent}33,
    transparent 40%
  );
  filter: blur(30px);
  opacity: 0.8;
  animation: ${spin} 3s linear infinite;
`;

const Badge = styled(motion.div)`
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 26px;
  color: ${({ theme }) => theme.accentText};
  background: ${({ theme }) => theme.accent};
  box-shadow: 0 12px 32px ${({ theme }) => theme.accent}55;
`;

const Word = styled.div`
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.text};
  .dot {
    color: ${({ theme }) => theme.accent};
  }
`;

const Line = styled.div`
  height: 16px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
`;

const Track = styled.div`
  width: 160px;
  height: 3px;
  border-radius: 99px;
  background: ${({ theme }) => theme.border};
  overflow: hidden;
`;

const Fill = styled(motion.div)`
  height: 100%;
  border-radius: 99px;
  background: ${({ theme }) => theme.accent};
`;

const MESSAGES = {
  checking: "Checking your session…",
  opening_google: "Opening Google sign-in…",
  redirecting: "You're in - taking you to your dashboard…",
  loading_invoices: "Loading your invoices…",
  loading_overview: "Loading your overview…",
} as const;

type Phase = keyof typeof MESSAGES;

export default function BrandLoader({
  phase,
  inline = false,
}: {
  phase: Phase;
  /** Fit within an already-rendered layout (e.g. BoardShell's content slot)
   *  instead of taking over the full viewport - no forced 100vh/background. */
  inline?: boolean;
}) {
  const reduce = useReducedMotion();
  const theme = useTheme() as AppTheme;
  const done = phase === "redirecting"; // the one "we're finished, moving on" phase

  return (
    <Wrap $inline={inline}>
      <Stack>
        {!reduce && <Halo aria-hidden />}
        <Badge
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, rotate: reduce ? 0 : 360 }}
          transition={{
            scale: { duration: 0.4, ease: [0.22, 0.7, 0.2, 1] },
            opacity: { duration: 0.4 },
            rotate: { duration: 1.6, repeat: reduce ? 0 : Infinity, ease: "linear" },
          }}
        >
          ⬢
        </Badge>
        <Word>
          Settl<span className="dot">.</span>
        </Word>
        <Line>
          <AnimatePresence mode="wait">
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              style={{ color: done ? theme.status.sent.fg : theme.textMuted }}
            >
              {MESSAGES[phase]}
            </motion.span>
          </AnimatePresence>
        </Line>
        <Track>
          <Fill
            initial={{ width: "20%" }}
            animate={{ width: done ? "100%" : "70%" }}
            transition={{ duration: done ? 0.3 : 1.1, ease: [0.4, 0, 0.2, 1] }}
          />
        </Track>
      </Stack>
    </Wrap>
  );
}
