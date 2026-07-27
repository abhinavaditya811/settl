"use client";

// The tabbed board UI - shared between signed-in (/dashboard) and public demo
// (/demo). Workflow tabs up top; Profile / Settings / Help pinned at the bottom.

import { useEffect, useState } from "react";
import styled, { ThemeProvider, useTheme } from "styled-components";
import { darkTheme, lightTheme, type AppTheme, type ThemeMode } from "@/lib/theme";
import BoardProvider, { useBoard } from "@/lib/BoardContext";
import type { BoardMode } from "@/lib/api";
import { ErrorState, Loading } from "@/components/ui";
import OverviewView from "@/components/overview/OverviewView";
import InboxView from "@/components/overview/InboxView";
import ApprovalsView from "@/components/overview/ApprovalsView";
import InvoicesView from "@/components/overview/InvoicesView";
import PlansMonitorView from "@/components/overview/PlansMonitorView";
import ActivityView from "@/components/overview/ActivityView";
import ProfileView from "@/components/profile/ProfileView";
import OperatorProfileView from "@/components/profile/OperatorProfileView";
import HelpView from "@/components/profile/HelpView";
import Toaster from "@/components/Toaster";
import { needsYou } from "@/components/overview/invoiceNext";

const BOARD_FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap";

type Tab =
  | "overview"
  | "inbox"
  | "approvals"
  | "invoices"
  | "plans"
  | "activity"
  | "account"
  | "settings"
  | "help";

const WORK_TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "inbox", label: "Inbox" },
  { key: "approvals", label: "Approvals" },
  { key: "invoices", label: "Invoices" },
  { key: "plans", label: "Plans" },
  { key: "activity", label: "Activity" },
];

// Admin / identity — pinned under the spacer (Linear / Notion pattern).
const RAIL_TABS: { key: Tab; label: string }[] = [
  { key: "account", label: "Profile" },
  { key: "settings", label: "Settings" },
  { key: "help", label: "Help" },
];

const ALL_TABS = [...WORK_TABS, ...RAIL_TABS];

const Shell = styled.div`
  display: flex;
  min-height: 100vh;
  background: ${({ theme }) => theme.bg};
  color: ${({ theme }) => theme.text};
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
`;
const Side = styled.aside`
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100vh;
  width: 228px;
  flex-shrink: 0;
  padding: 22px 14px;
  border-right: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  display: flex;
  flex-direction: column;
  gap: 3px;
`;
const Brand = styled.a`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 8px 20px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: opacity 0.15s ease;
  &:hover {
    opacity: 0.75;
  }
  .logo {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: ${({ theme }) => theme.accent};
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .name {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .beta {
    margin-left: 1px;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 5px;
    color: ${({ theme }) => theme.accent};
    background: ${({ theme }) => theme.surfaceAlt};
    border: 1px solid ${({ theme }) => theme.border};
  }
`;
const Back = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.textMuted};
  transition: color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  &:hover {
    color: ${({ theme }) => theme.text};
    border-color: ${({ theme }) => theme.textMuted};
    transform: translateY(-1px);
  }
`;
const Nav = styled.button<{ $on: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  text-align: left;
  padding: 10px 12px 10px 14px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: ${({ $on }) => ($on ? 600 : 500)};
  cursor: pointer;
  border: none;
  color: ${({ theme, $on }) => ($on ? theme.text : theme.textMuted)};
  background: ${({ theme, $on }) => ($on ? theme.surfaceAlt : "transparent")};
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
  &::before {
    content: "";
    position: absolute;
    left: 4px;
    top: 10px;
    bottom: 10px;
    width: 2px;
    border-radius: 2px;
    background: ${({ theme }) => theme.accent};
    opacity: ${({ $on }) => ($on ? 1 : 0)};
  }
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
    color: ${({ theme }) => theme.text};
    transform: translateX(1px);
  }
  .badge {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    color: ${({ theme }) => theme.status.awaiting_approval.fg};
    background: ${({ theme }) => theme.status.awaiting_approval.bg};
  }
`;
const RailLabel = styled.div`
  margin: 10px 8px 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.textMuted};
`;
const Main = styled.main`
  flex: 1;
  min-width: 0;
  padding: 22px 28px 60px;
`;
const Top = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  .ws {
    font-size: 13px;
    font-weight: 500;
    color: ${({ theme }) => theme.textMuted};
  }
  .scale {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.textMuted};
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid ${({ theme }) => theme.border};
    background: ${({ theme }) => theme.surface};
  }
`;
const Toggle = styled.button`
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.textMuted};
  transition: color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  &:hover {
    color: ${({ theme }) => theme.text};
    transform: translateY(-1px);
  }
`;
const SideSpacer = styled.div`
  flex: 1;
`;
const SideFooter = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid ${({ theme }) => theme.border};
`;

function normalizeHash(h: string): Tab | null {
  if (h === "profile") return "settings"; // old deep link
  if (ALL_TABS.some((t) => t.key === h)) return h as Tab;
  return null;
}

interface Props {
  mode: BoardMode;
  footer: React.ReactNode;
  workspaceLabel: string;
}

export default function BoardShell({ mode, footer, workspaceLabel }: Props) {
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const theme = themeMode === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <BoardProvider mode={mode}>
        <BoardShellBody
          mode={mode}
          footer={footer}
          workspaceLabel={workspaceLabel}
          themeMode={themeMode}
          onToggleTheme={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}
        />
      </BoardProvider>
    </ThemeProvider>
  );
}

interface BodyProps {
  mode: BoardMode;
  footer: React.ReactNode;
  workspaceLabel: string;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

function BoardShellBody({ mode, footer, workspaceLabel, themeMode, onToggleTheme }: BodyProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const { board, metrics, loading, error } = useBoard();
  const theme = useTheme() as AppTheme;

  useEffect(() => {
    const apply = () => {
      const next = normalizeHash(window.location.hash.replace("#", ""));
      if (next) setTab(next);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const go = (k: Tab) => {
    setTab(k);
    if (typeof window !== "undefined") window.location.hash = k;
  };

  const approvalsBadge = board?.summary.counts.awaiting_approval;
  const inboxBadge = board?.invoices.filter((i) => needsYou(i) || i.can_approve).length;
  const scaleLabel =
    mode === "demo" && board
      ? `${board.summary.total} invoices · ${new Set(board.invoices.map((i) => i.debtor_name)).size} customers`
      : undefined;

  return (
    <Shell>
      <link rel="stylesheet" href={BOARD_FONTS} />
      <Toaster />
      <Side>
        <Brand href="/" title="Back to site">
          <span className="logo" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z" fill={theme.accentText} />
            </svg>
          </span>
          <span className="name">Settl</span>
          <span className="beta">Pre-beta</span>
        </Brand>
        {WORK_TABS.map((t) => (
          <Nav key={t.key} $on={tab === t.key} onClick={() => go(t.key)}>
            {t.label}
            {t.key === "inbox" && Boolean(inboxBadge) && (
              <span className="badge">{inboxBadge}</span>
            )}
            {t.key === "approvals" && Boolean(approvalsBadge) && (
              <span className="badge">{approvalsBadge}</span>
            )}
          </Nav>
        ))}
        <SideSpacer />
        <RailLabel>Workspace</RailLabel>
        {RAIL_TABS.map((t) => (
          <Nav key={t.key} $on={tab === t.key} onClick={() => go(t.key)}>
            {t.label}
          </Nav>
        ))}
        <SideFooter>{footer}</SideFooter>
      </Side>
      <Main>
        <Top>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Back href="/">&larr; Back to site</Back>
            <span className="ws">{workspaceLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {scaleLabel && <span className="scale">{scaleLabel}</span>}
            <Toggle onClick={onToggleTheme}>{themeMode === "dark" ? "Light" : "Dark"}</Toggle>
          </div>
        </Top>
        {error && !loading && !metrics ? (
          <ErrorState message={error} />
        ) : (
          <>
            {tab === "overview" &&
              (loading || !metrics ? (
                <Loading what="your overview" />
              ) : (
                <OverviewView />
              ))}
            {tab === "inbox" && <InboxView />}
            {tab === "approvals" && <ApprovalsView />}
            {tab === "invoices" && <InvoicesView />}
            {tab === "plans" && <PlansMonitorView />}
            {tab === "activity" && <ActivityView />}
            {tab === "account" && <OperatorProfileView demo={mode === "demo"} />}
            {tab === "settings" && <ProfileView demo={mode === "demo"} />}
            {tab === "help" && <HelpView />}
          </>
        )}
      </Main>
    </Shell>
  );
}
