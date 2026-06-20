"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";
import { getDetail } from "@/lib/api";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/ui";
import ApprovalItem from "@/components/approvals/ApprovalItem";

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export default function ApprovalsPage() {
  const { board, loading, error, approvingId, approve } = useBoard();
  const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});

  const awaiting = board ? board.invoices.filter((c) => c.can_approve) : [];
  const ids = awaiting.map((c) => c.invoice_id).join(",");

  // Pull each held invoice's drafted message so it can be reviewed/edited.
  useEffect(() => {
    if (!ids) return;
    let active = true;
    Promise.all(
      ids.split(",").map((id) => getDetail(id).catch(() => null)),
    ).then((details) => {
      if (!active) return;
      const map: Record<string, string | undefined> = {};
      details.forEach((d) => {
        if (d) map[d.invoice_id] = d.message ?? "";
      });
      setDrafts(map);
    });
    return () => {
      active = false;
    };
  }, [ids]);

  if (error) return <ErrorState message={error} />;
  if (loading || !board) return <Loading what="the approval queue" />;

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="First-contact drafts held for your one-tap sign-off - review, edit, then send"
      />
      {awaiting.length === 0 ? (
        <EmptyState text="You’re all caught up - nothing is waiting for approval." />
      ) : (
        <Stack>
          {awaiting.map((c) => (
            <ApprovalItem
              key={c.invoice_id}
              card={c}
              message={drafts[c.invoice_id]}
              approvingId={approvingId}
              onApprove={approve}
            />
          ))}
        </Stack>
      )}
    </>
  );
}
