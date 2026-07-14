"use client";

// The tabbed board UI (Overview/Approvals/Invoices/Activity) - shared between the
// signed-in operator's own board (/dashboard, mode="mine") and the public demo
// (/demo, mode="mine"|"demo"). Owns theme toggling, tab state, and hash-routing;
// the caller only supplies what differs between the two: sidebar footer content
// and the workspace label shown at the top.

import { useEffect, useState } from "react";
import styled, { ThemeProvider, useTheme } from "styled-components";
import { darkTheme, lightTheme, type AppTheme, type ThemeMode } from "@/lib/theme";
import BoardProvider, { useBoard } from "@/lib/BoardContext";
import type { BoardMode } from "@/lib/api";
import { Loading } from "@/components/ui";
import KpiCards from "@/components/overview/KpiCards";
import OverviewPanels from "@/components/overview/OverviewPanels";
import ApprovalsView from "@/components/overview/ApprovalsView";
import InvoicesView from "@/components/overview/InvoicesView";
import ActivityView from "@/components/overview/ActivityView";

type Tab = "overview" | "approvals" | "invoices" | "activity";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "approvals", label: "Approvals" },
  { key: "invoices", label: "Invoices" },
  { key: "activity", label: "Activity" },
];

const Shell = styled.div`
  display: flex; min-height: 100vh;
  background: ${({ theme }) => theme.bg}; color: ${({ theme }) => theme.text};
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
`;
const Side = styled.aside`
  position: sticky; top: 0; align-self: flex-start; height: 100vh;
  width: 212px; flex-shrink: 0; padding: 20px 14px;
  border-right: 1px solid ${({ theme }) => theme.border};
  display: flex; flex-direction: column; gap: 4px;
`;
const Brand = styled.div`
  display: flex; align-items: center; gap: 9px; padding: 0 8px 18px;
  .logo { width: 26px; height: 26px; border-radius: 7px; background: ${({ theme }) => theme.accent}; display: flex; align-items: center; justify-content: center; }
  .name { font-size: 15px; font-weight: 700; }
`;
const Nav = styled.button<{ $on: boolean }>`
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; text-align: left; padding: 9px 12px; border-radius: 9px;
  font-size: 13.5px; font-weight: ${({ $on }) => ($on ? 700 : 400)}; cursor: pointer; border: none;
  color: ${({ theme, $on }) => ($on ? theme.accent : theme.textMuted)};
  background: ${({ theme, $on }) => ($on ? theme.surfaceAlt : "transparent")};
  &:hover { background: ${({ theme }) => theme.surfaceAlt}; }
  .badge { font-size: 11px; padding: 1px 7px; border-radius: 999px; color: ${({ theme }) => theme.status.awaiting_approval.fg}; background: ${({ theme }) => theme.status.awaiting_approval.bg}; }
`;
const Main = styled.main`flex: 1; min-width: 0; padding: 22px 28px 60px;`;
const Top = styled.div`
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;
  .ws { font-size: 13.5px; color: ${({ theme }) => theme.textMuted}; }
  .scale { font-size: 12.5px; color: ${({ theme }) => theme.textMuted}; }
`;
const Toggle = styled.button`
  font-size: 12.5px; padding: 5px 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface}; color: ${({ theme }) => theme.textMuted};
`;
const SideSpacer = styled.div`flex: 1;`;
const SideFooter = styled.div`
  display: flex; flex-direction: column; gap: 10px;
  padding-top: 14px; border-top: 1px solid ${({ theme }) => theme.border};
`;

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
      {/* BoardProvider wraps the whole shell (not just <Main>) so the sidebar's
          approvals badge and the demo workspace label can read real data too -
          previously it only wrapped the tab content, leaving the nav badge
          stuck on a hardcoded "3". */}
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
  const { board, metrics, loading } = useBoard();
  const theme = useTheme() as AppTheme;

  // Deep-linkable tabs: #invoices opens straight to Invoices (handy for sharing a
  // specific view).
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "");
      if (TABS.some((t) => t.key === h)) setTab(h as Tab);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const go = (k: Tab) => { setTab(k); if (typeof window !== "undefined") window.location.hash = k; };

  const approvalsBadge = board?.summary.counts.awaiting_approval;
  // The demo workspace's "N invoices · M customers" scale label is computed from
  // the real board, not a hardcoded fixture - "mine" mode has no equivalent (an
  // operator's own invoice count is already visible in the board itself).
  const scaleLabel =
    mode === "demo" && board
      ? `${board.summary.total} invoices · ${new Set(board.invoices.map((i) => i.debtor_name)).size} customers`
      : undefined;

  return (
    <Shell>
      <Side>
        <Brand>
          <span className="logo" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24"><path d="M13 2L4.5 13.5H11L10 22L19.5 10H13L13 2Z" fill={theme.accentText} /></svg>
          </span>
          <span className="name">Settl</span>
        </Brand>
        {TABS.map((t) => (
          <Nav key={t.key} $on={tab === t.key} onClick={() => go(t.key)}>
            {t.label}
            {t.key === "approvals" && Boolean(approvalsBadge) && (
              <span className="badge">{approvalsBadge}</span>
            )}
          </Nav>
        ))}
        <SideSpacer />
        <SideFooter>{footer}</SideFooter>
      </Side>
      <Main>
        <Top>
          <span className="ws">{workspaceLabel}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {scaleLabel && <span className="scale">{scaleLabel}</span>}
            <Toggle onClick={onToggleTheme}>{themeMode === "dark" ? "Light" : "Dark"}</Toggle>
          </div>
        </Top>
        {tab === "overview" &&
          (loading || !metrics ? (
            <Loading what="your overview" />
          ) : (
            <>
              <KpiCards metrics={metrics} />
              <OverviewPanels />
            </>
          ))}
        {tab === "approvals" && <ApprovalsView />}
        {tab === "invoices" && <InvoicesView />}
        {tab === "activity" && <ActivityView />}
      </Main>
    </Shell>
  );
}
