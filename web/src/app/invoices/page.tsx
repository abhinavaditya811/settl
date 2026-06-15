"use client";

import { useMemo, useState } from "react";
import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";
import { STATE_META, STATE_ORDER, type TerminalState } from "@/lib/types";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/ui";
import Chips, { type ChipOption } from "@/components/Chips";
import InvoiceTable from "@/components/InvoiceTable";
import InvoiceDrawer from "@/components/InvoiceDrawer";

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
`;

const Search = styled.input`
  width: 100%;
  max-width: 340px;
  padding: 9px 13px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  font: inherit;
  font-size: 13.5px;
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.accent};
  }
  &::placeholder {
    color: ${({ theme }) => theme.textMuted};
  }
`;

export default function InvoicesPage() {
  const { board, loading, error, approvingId, approve } = useBoard();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleApprove = async (id: string, message?: string) => {
    await approve(id, message);
    setRefreshKey((k) => k + 1);
  };

  const chips: ChipOption[] = useMemo(() => {
    if (!board) return [];
    const counts = board.summary.counts;
    const present = STATE_ORDER.filter((s) => (counts[s] ?? 0) > 0);
    return [
      { key: "all", label: "All", count: board.summary.total },
      ...present.map((s) => ({
        key: s,
        label: STATE_META[s].label,
        count: counts[s] ?? 0,
      })),
    ];
  }, [board]);

  const rows = useMemo(() => {
    if (!board) return [];
    const q = query.trim().toLowerCase();
    return board.invoices.filter((c) => {
      if (filter !== "all" && c.terminal_state !== (filter as TerminalState))
        return false;
      if (!q) return true;
      return (
        c.invoice_id.toLowerCase().includes(q) ||
        c.debtor_name.toLowerCase().includes(q)
      );
    });
  }, [board, query, filter]);

  if (error) return <ErrorState message={error} />;
  if (loading || !board) return <Loading what="invoices" />;

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Every invoice and how the agent handled it — click a row for the full trace"
      />
      <Controls>
        <Search
          placeholder="Search by invoice ID or debtor…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Chips options={chips} active={filter} onPick={setFilter} />
      </Controls>

      {rows.length === 0 ? (
        <EmptyState text="No invoices match your filters." />
      ) : (
        <InvoiceTable cards={rows} onSelect={setSelectedId} />
      )}

      {selectedId && (
        <InvoiceDrawer
          invoiceId={selectedId}
          approvingId={approvingId}
          onApprove={handleApprove}
          onClose={() => setSelectedId(null)}
          refreshKey={refreshKey}
        />
      )}
    </>
  );
}
