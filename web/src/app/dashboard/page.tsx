"use client";

// Main authenticated dashboard — tabbed view with Overview, Approvals, Invoices,
// and Activity. Previously at /preview, now the real /dashboard page.

import { useEffect, useState } from "react";
import styled, { ThemeProvider } from "styled-components";
import { signOut, useSession } from "next-auth/react";
import { darkTheme, lightTheme, type ThemeMode } from "@/lib/theme";
import { hero } from "@/components/overview/previewData";
import { useDemo } from "@/lib/DemoContext";
import HeroPanel from "@/components/overview/HeroPanel";
import OverviewPanels from "@/components/overview/OverviewPanels";
import ApprovalsView from "@/components/overview/ApprovalsView";
import InvoicesView from "@/components/overview/InvoicesView";
import ActivityView from "@/components/overview/ActivityView";

type Tab = "overview" | "approvals" | "invoices" | "activity";
const TABS: { key: Tab; label: string; badge?: number }[] = [
  { key: "overview", label: "Overview" },
  { key: "approvals", label: "Approvals", badge: 3 },
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
const DemoTag = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 7px 11px; border-radius: 9px; font-size: 12px; font-weight: 700;
  color: ${({ theme }) => theme.status.awaiting_approval.fg};
  background: ${({ theme }) => theme.status.awaiting_approval.bg};
  button {
    border: none; background: transparent; color: inherit; font: inherit;
    font-size: 12px; text-decoration: underline; cursor: pointer; padding: 0;
  }
`;
const Account = styled.div`
  display: flex; align-items: center; gap: 8px; padding: 2px 4px;
  .who {
    flex: 1; min-width: 0; font-size: 12px; font-weight: 600;
    color: ${({ theme }) => theme.textMuted};
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  button {
    flex-shrink: 0; padding: 5px 10px; border-radius: 8px;
    border: 1px solid ${({ theme }) => theme.border};
    background: transparent; color: ${({ theme }) => theme.textMuted};
    font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
    &:hover { background: ${({ theme }) => theme.surfaceAlt}; color: ${({ theme }) => theme.text}; }
  }
`;

export default function DashboardPage() {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [tab, setTab] = useState<Tab>("overview");
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const { demoEnabled, exitDemo } = useDemo();
  const { data: session } = useSession();

  // Deep-linkable tabs: /dashboard#invoices opens straight to Invoices (handy for
  // sharing a specific view).
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

  return (
    <ThemeProvider theme={theme}>
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
              {t.badge && <span className="badge">{t.badge}</span>}
            </Nav>
          ))}
          <SideSpacer />
          <SideFooter>
            {demoEnabled && (
              <DemoTag>
                <span>Demo data</span>
                <button onClick={exitDemo}>Exit</button>
              </DemoTag>
            )}
            {session?.user && (
              <Account>
                <span className="who" title={session.user.email ?? undefined}>
                  {session.user.email}
                </span>
                <button onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
              </Account>
            )}
          </SideFooter>
        </Side>
        <Main>
          <Top>
            <span className="ws">{hero.workspace}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="scale">{hero.invoices} invoices · {hero.customers} customers</span>
              <Toggle onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}>
                {mode === "dark" ? "Light" : "Dark"}
              </Toggle>
            </div>
          </Top>
          {tab === "overview" && (<><HeroPanel /><OverviewPanels /></>)}
          {tab === "approvals" && <ApprovalsView />}
          {tab === "invoices" && <InvoicesView />}
          {tab === "activity" && <ActivityView />}
        </Main>
      </Shell>
    </ThemeProvider>
  );
}
