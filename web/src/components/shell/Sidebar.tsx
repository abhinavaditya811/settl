"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { href: "/", label: "Overview", icon: "◫" },
  { href: "/approvals", label: "Approvals", icon: "✓" },
  { href: "/invoices", label: "Invoices", icon: "❏" },
  { href: "/activity", label: "Activity", icon: "≡" },
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

export default function Sidebar() {
  const pathname = usePathname();
  const { board, liveSend } = useBoard();
  const awaiting = board?.summary.counts.awaiting_approval ?? 0;

  return (
    <Aside>
      <Brand>
        <div className="mark">⬢</div>
        <div className="name">Settl</div>
      </Brand>
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
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
        <Live $live={liveSend} title={
          liveSend ? "Approvals send real email" : "Mock mode — approvals are simulated"
        }>
          <span className="dot" />
          {liveSend ? "Live email armed" : "Mock mode"}
        </Live>
        <ThemeToggle />
      </Footer>
    </Aside>
  );
}
