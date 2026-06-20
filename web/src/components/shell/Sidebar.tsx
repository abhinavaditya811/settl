"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";
import { useDemo } from "@/lib/DemoContext";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "◫" },
  { href: "/dashboard/approvals", label: "Approvals", icon: "✓" },
  { href: "/dashboard/invoices", label: "Invoices", icon: "❏" },
  { href: "/dashboard/activity", label: "Activity", icon: "≡" },
];

const Aside = styled.aside`
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 22px 16px;
  border-right: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 18px;
  .mark {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-size: 15px;
    color: ${({ theme }) => theme.accentText};
    background: ${({ theme }) => theme.accent};
  }
  .name {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
`;

const Item = styled(Link)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 11px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  color: ${({ theme, $active }) => ($active ? theme.text : theme.textMuted)};
  background: ${({ theme, $active }) => ($active ? theme.surfaceAlt : "transparent")};
  transition: background 0.12s ease, color 0.12s ease;
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
    color: ${({ theme }) => theme.text};
  }
  .icon {
    width: 18px;
    text-align: center;
    opacity: 0.85;
  }
  .count {
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: 999px;
    color: ${({ theme }) => theme.status.awaiting_approval.fg};
    background: ${({ theme }) => theme.status.awaiting_approval.bg};
  }
`;

const Spacer = styled.div`
  flex: 1;
`;

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid ${({ theme }) => theme.border};
`;

const Live = styled.div<{ $live: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ theme, $live }) => ($live ? theme.status.sent.fg : theme.textMuted)};
  background: ${({ theme }) => theme.surfaceAlt};
  span.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ theme, $live }) => ($live ? theme.status.sent.fg : theme.textMuted)};
  }
`;

const DemoTag = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 11px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.status.awaiting_approval.fg};
  background: ${({ theme }) => theme.status.awaiting_approval.bg};
  button {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
  }
`;

const Account = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 4px;
  .who {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.textMuted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button {
    flex-shrink: 0;
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid ${({ theme }) => theme.border};
    background: transparent;
    color: ${({ theme }) => theme.textMuted};
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    &:hover {
      background: ${({ theme }) => theme.surfaceAlt};
      color: ${({ theme }) => theme.text};
    }
  }
`;

export default function Sidebar() {
  const pathname = usePathname();
  const { board, liveSend } = useBoard();
  const { demoEnabled, exitDemo } = useDemo();
  const { data: session } = useSession();
  const awaiting = board?.summary.counts.awaiting_approval ?? 0;

  return (
    <Aside>
      <Brand>
        <div className="mark">⬢</div>
        <div className="name">Settl</div>
      </Brand>
      {NAV.map((n) => {
        const active =
          n.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(n.href);
        return (
          <Item key={n.href} href={n.href} $active={active}>
            <span className="icon">{n.icon}</span>
            {n.label}
            {n.href === "/approvals" && awaiting > 0 && (
              <span className="count">{awaiting}</span>
            )}
          </Item>
        );
      })}
      <Spacer />
      <Footer>
        {demoEnabled && (
          <DemoTag>
            <span>Demo data</span>
            <button onClick={exitDemo}>Exit</button>
          </DemoTag>
        )}
        <Live $live={liveSend} title={
          liveSend ? "Approvals send real email" : "Mock mode - approvals are simulated"
        }>
          <span className="dot" />
          {liveSend ? "Live email armed" : "Mock mode"}
        </Live>
        {session?.user && (
          <Account>
            <span className="who" title={session.user.email ?? undefined}>
              {session.user.email}
            </span>
            <button onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
          </Account>
        )}
      </Footer>
    </Aside>
  );
}
