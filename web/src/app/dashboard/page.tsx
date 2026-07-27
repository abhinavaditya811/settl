"use client";

// Signed-in operator's dashboard: zero-state (add invoices) until they have
// data, then the tabbed board via BoardShell. Demo data lives at /demo instead -
// a public, separate route with no toggle - so there is no path from here back
// to synthetic data.

import { useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import styled from "styled-components";
import { getBoard } from "@/lib/api";
import BrandLoader from "@/components/ui/BrandLoader";
import BoardShell from "@/components/dashboard/BoardShell";
import ZeroState from "@/components/zero/ZeroState";

const ZeroWrap = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const SlowWrap = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
  h2 {
    margin: 0;
    font-size: 18px;
    color: ${({ theme }) => theme.text};
  }
  p {
    margin: 0;
    max-width: 380px;
    font-size: 14px;
    line-height: 1.5;
    color: ${({ theme }) => theme.textMuted};
  }
  button {
    margin-top: 6px;
    padding: 9px 16px;
    border-radius: 10px;
    border: 1px solid ${({ theme }) => theme.border};
    background: ${({ theme }) => theme.surfaceAlt};
    color: ${({ theme }) => theme.text};
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    &:hover {
      background: ${({ theme }) => theme.surface};
    }
  }
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

  // "checking" while polling, "slow" if board_ready never flipped within the
  // budget below, "empty"/"hasInvoices" once board_ready confirms the real
  // answer. Never inferred from a timeout - "empty" must come from the backend
  // actually saying board_ready=true with zero invoices, not from us giving up.
  const [status, setStatus] = useState<"checking" | "slow" | "empty" | "hasInvoices">("checking");

  // Also what triggers first-time tenant resolution server-side
  // (identity.py's get_or_create_tenant) - the probe itself is a normal
  // "mine" board read.
  //
  // Right after a cold start, board_ready can stay false for a long time: the
  // background refresh() runs via asyncio.create_task from main.py's lifespan,
  // and Cloud Run's default billing throttles CPU to near-zero between actual
  // HTTP requests - so a background task that keeps running past the container
  // reporting "ready" gets starved rather than crashing (observed live: no
  // exception anywhere, board_ready just never flips). 90 attempts * 2s = 3
  // minutes, generous enough to usually cover a cold-start refresh even under
  // throttled CPU, without paying for --no-cpu-throttling's always-on cost.
  const MAX_READY_ATTEMPTS = 90;
  const POLL_INTERVAL_MS = 2000;
  const probeOwnInvoices = useCallback((attempt = 0) => {
    if (attempt === 0) setStatus("checking");
    getBoard("mine")
      .then((b) => {
        if (!b.board_ready) {
          if (attempt < MAX_READY_ATTEMPTS) {
            setTimeout(() => probeOwnInvoices(attempt + 1), POLL_INTERVAL_MS);
          } else {
            setStatus("slow"); // don't guess - we genuinely don't know yet
          }
          return;
        }
        setStatus(b.summary.total > 0 ? "hasInvoices" : "empty");
      })
      .catch(() => setStatus("empty"));
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    probeOwnInvoices();
  }, [sessionStatus, probeOwnInvoices]);

  if (status === "checking") {
    return <BrandLoader phase="loading_invoices" />;
  }

  if (status === "slow") {
    return (
      <SlowWrap>
        <h2>Still preparing your board</h2>
        <p>
          This is taking longer than usual - your invoices aren&apos;t lost,
          the board is just still loading. Try again in a moment.
        </p>
        <button type="button" onClick={() => probeOwnInvoices()}>
          Try again
        </button>
      </SlowWrap>
    );
  }

  if (status === "empty") {
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
