"use client";

// Signed-in operator's dashboard: zero-state (add invoices) until they have
// data, then the tabbed board via BoardShell. Demo data lives at /demo instead -
// a public, separate route with no toggle - so there is no path from here back
// to synthetic data.

import { useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import styled from "styled-components";
import { getBoard } from "@/lib/api";
import { Loading } from "@/components/ui";
import BoardShell from "@/components/dashboard/BoardShell";
import ZeroState from "@/components/zero/ZeroState";

const Centered = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ZeroWrap = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Account = styled.div`
  display: flex; align-items: center; padding: 2px 4px;
  button {
    width: 100%; padding: 5px 10px; border-radius: 8px;
    border: 1px solid ${({ theme }) => theme.border};
    background: transparent; color: ${({ theme }) => theme.textMuted};
    font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
    &:hover { background: ${({ theme }) => theme.surfaceAlt}; color: ${({ theme }) => theme.text}; }
  }
`;

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();

  // null = not yet probed, false = confirmed empty (zero-state), true = at
  // least one invoice exists.
  const [hasOwnInvoices, setHasOwnInvoices] = useState<boolean | null>(null);

  // Also what triggers first-time tenant resolution server-side
  // (identity.py's get_or_create_tenant) - the probe itself is a normal
  // "mine" board read.
  const probeOwnInvoices = useCallback(() => {
    setHasOwnInvoices(null);
    getBoard("mine")
      .then((b) => setHasOwnInvoices(b.summary.total > 0))
      .catch(() => setHasOwnInvoices(false));
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    probeOwnInvoices();
  }, [sessionStatus, probeOwnInvoices]);

  if (hasOwnInvoices === null) {
    return (
      <Centered>
        <Loading what="your invoices" />
      </Centered>
    );
  }

  if (!hasOwnInvoices) {
    return (
      <ZeroWrap>
        <ZeroState onOwnDataAdded={probeOwnInvoices} />
      </ZeroWrap>
    );
  }

  return (
    <BoardShell
      mode="mine"
      workspaceLabel="Your invoices"
      footer={
        session?.user && (
          <Account>
            <button onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
          </Account>
        )
      }
    />
  );
}
