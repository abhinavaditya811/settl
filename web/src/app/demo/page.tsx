"use client";

// Public demo board - no sign-in required. Not under middleware.ts's matcher
// (only /dashboard and /admin are gated), and BoardShell's mode="demo" read path
// needs no identity headers either, so this works for an anonymous visitor with
// no special-casing. Mirrors the landing page's "Watch demo" CTA.

import Link from "next/link";
import styled from "styled-components";
import BoardShell from "@/components/dashboard/BoardShell";

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 11px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.status.awaiting_approval.fg};
  background: ${({ theme }) => theme.status.awaiting_approval.bg};
  a {
    color: inherit;
    font-weight: 700;
  }
`;

export default function DemoPage() {
  return (
    <BoardShell
      mode="demo"
      workspaceLabel="Demo workspace"
      footer={
        <Footer>
          <span>You&rsquo;re viewing synthetic demo data.</span>
          <Link href="/signin">Sign in to add your own invoices &rarr;</Link>
        </Footer>
      }
    />
  );
}
