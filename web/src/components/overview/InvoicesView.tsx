"use client";

// Invoices tab: AR worklist (pulse, attention filters, sorted rows, case drawer).

import { useMemo, useState } from "react";
import type { InvoiceCard, TerminalState } from "@/lib/types";
import { STATE_META } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import UploadCsvModal from "@/components/zero/UploadCsvModal";
import ManualEntryModal from "@/components/zero/ManualEntryModal";
import InvoiceDrawer from "./InvoiceDrawer";
import InvoicePulse from "./InvoicePulse";
import InvoiceRow from "./InvoiceRow";
import {
  AddBtn,
  Empty,
  Filter,
  Filters,
  Head,
  HeadBtns,
  Keys,
  Page,
  Search,
  SortGroup,
  Stack,
  Toolbar,
} from "./invoicesChrome";
import { Rise } from "./overviewChrome";
import {
  type AttentionFilter,
  useInvoicesBoard,
} from "./useInvoicesBoard";
import styled from "styled-components";

const GroupHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 6px 4px 2px;
  font-size: 12.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.textMuted};
  .name {
    font-family: var(--font-display, inherit);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: ${({ theme }) => theme.text};
  }
`;

function groupByDebtor(rows: InvoiceCard[]) {
  const map = new Map<string, InvoiceCard[]>();
  for (const inv of rows) {
    const list = map.get(inv.debtor_name) ?? [];
    list.push(inv);
    map.set(inv.debtor_name, list);
  }
  return Array.from(map.entries()).sort((a, b) => {
    const sum = (xs: InvoiceCard[]) =>
      xs.reduce((s, i) => s + (Number(i.amount_due) || 0), 0);
    return sum(b[1]) - sum(a[1]);
  });
}

const PRIMARY: { key: AttentionFilter; label: string }[] = [
  { key: "needs_you", label: "Needs you" },
  { key: "in_flight", label: "In flight" },
  { key: "recovered", label: "Recovered" },
  { key: "all", label: "All" },
];

const SECONDARY: AttentionFilter[] = ["held", "skipped", "quarantined"];

export default function InvoicesView() {
  const b = useInvoicesBoard();
  const [modal, setModal] = useState<"csv" | "manual" | null>(null);
  const [byCustomer, setByCustomer] = useState(false);
  const groups = useMemo(
    () => (byCustomer ? groupByDebtor(b.rows) : []),
    [byCustomer, b.rows],
  );

  const addButtons = (
    <HeadBtns>
      <AddBtn type="button" onClick={() => setModal("csv")}>
        Upload CSV
      </AddBtn>
      <AddBtn $primary type="button" onClick={() => setModal("manual")}>
        Add invoice
      </AddBtn>
    </HeadBtns>
  );

  const addModals = (
    <>
      {modal === "csv" && (
        <UploadCsvModal
          onClose={() => setModal(null)}
          onImported={() => {
            setModal(null);
            b.refresh();
          }}
        />
      )}
      {modal === "manual" && (
        <ManualEntryModal
          onClose={() => setModal(null)}
          onAdded={() => {
            setModal(null);
            b.refresh();
          }}
        />
      )}
    </>
  );

  if (b.invoices.length === 0) {
    return (
      <Rise>
        <Page>
          <Head>
            <div>
              <h1>Invoices</h1>
              <p>Every invoice, how the agent handled it, and what it will do next.</p>
            </div>
            {addButtons}
          </Head>
          <EmptyState text="No invoices yet." />
          {addModals}
        </Page>
      </Rise>
    );
  }

  const stateKeys = (Object.keys(b.stateCounts) as TerminalState[]).filter(
    (k) => (b.stateCounts[k] ?? 0) > 0,
  );

  return (
    <Rise>
      <Page>
        <Head>
          <div>
            <h1>Invoices</h1>
            <p>
              Work the book by attention. Open a row for the full case and decision
              trace.
            </p>
          </div>
          {addButtons}
        </Head>

        <InvoicePulse
          openBook={b.openBookAmount}
          needsYou={b.needsYouCount}
          inFlight={b.inFlightCount}
          recovered={b.recoveredCount}
          currency={b.ccy}
        />

        <Search
          placeholder="Search by invoice ID, debtor, or note…"
          value={b.q}
          onChange={(e) => b.setQ(e.target.value)}
        />

        <Toolbar>
          <Filters>
            {PRIMARY.map(({ key, label }) => (
              <Filter
                key={key}
                type="button"
                $on={b.filter === key}
                onClick={() => b.setFilter(key)}
              >
                {label}
                {b.attentionCounts[key] > 0
                  ? ` · ${b.attentionCounts[key]}`
                  : ""}
              </Filter>
            ))}
            {SECONDARY.map((key) =>
              b.attentionCounts[key] > 0 ? (
                <Filter
                  key={key}
                  type="button"
                  $on={b.filter === key}
                  onClick={() => b.setFilter(key)}
                >
                  {b.filterLabel(key)} · {b.attentionCounts[key]}
                </Filter>
              ) : null,
            )}
          </Filters>
          <SortGroup>
            <span className="label">Sort</span>
            <Filter
              type="button"
              $on={b.sortMode === "risk"}
              onClick={() => b.setSortMode("risk")}
            >
              Highest risk
            </Filter>
            <Filter
              type="button"
              $on={b.sortMode === "amount"}
              onClick={() => b.setSortMode("amount")}
            >
              Largest $
            </Filter>
            <Filter
              type="button"
              $on={b.sortMode === "overdue"}
              onClick={() => b.setSortMode("overdue")}
            >
              Most overdue
            </Filter>
            <Filter
              type="button"
              $on={byCustomer}
              onClick={() => setByCustomer((v) => !v)}
            >
              By customer
            </Filter>
          </SortGroup>
        </Toolbar>

        {stateKeys.length > 1 && (
          <Filters>
            <Filter
              type="button"
              $on={b.stateFilter === "all"}
              onClick={() => b.setStateFilter("all")}
            >
              Any status
            </Filter>
            {stateKeys.map((k) => (
              <Filter
                key={k}
                type="button"
                $on={b.stateFilter === k}
                onClick={() => b.setStateFilter(k)}
              >
                {STATE_META[k].label} · {b.stateCounts[k]}
              </Filter>
            ))}
          </Filters>
        )}

        {b.rows.length === 0 ? (
          <Empty>
            <div className="t">Nothing in this view</div>
            <div className="s">
              {b.q.trim()
                ? "No invoices match that search. Clear it or try another filter."
                : `No invoices in “${b.filterLabel(b.filter)}”. Try All.`}
            </div>
          </Empty>
        ) : byCustomer ? (
          <Stack>
            {groups.map(([name, invs]) => {
              const total = invs.reduce((s, i) => s + (Number(i.amount_due) || 0), 0);
              const ccy = invs[0]?.currency ?? "USD";
              return (
                <div key={name}>
                  <GroupHead>
                    <span className="name">
                      {name} · {invs.length}
                    </span>
                    <span>{formatMoney(String(total), ccy)}</span>
                  </GroupHead>
                  <Stack>
                    {invs.map((inv) => (
                      <InvoiceRow
                        key={inv.invoice_id}
                        invoice={inv}
                        focused={inv.invoice_id === b.focusId}
                        pausing={b.flaggingId === inv.invoice_id}
                        onOpen={() => {
                          b.setFocusId(inv.invoice_id);
                          b.setOpenId(inv.invoice_id);
                        }}
                        onPause={() => void b.handlePause(inv.invoice_id)}
                      />
                    ))}
                  </Stack>
                </div>
              );
            })}
          </Stack>
        ) : (
          <Stack>
            {b.rows.map((inv, idx) => (
              <Rise key={inv.invoice_id} $delay={Math.min(idx, 8) * 30}>
                <InvoiceRow
                  invoice={inv}
                  focused={inv.invoice_id === b.focusId}
                  pausing={b.flaggingId === inv.invoice_id}
                  onOpen={() => {
                    b.setFocusId(inv.invoice_id);
                    b.setOpenId(inv.invoice_id);
                  }}
                  onPause={() => void b.handlePause(inv.invoice_id)}
                />
              </Rise>
            ))}
          </Stack>
        )}

        {b.rows.length > 0 && (
          <Keys>
            <span>
              <kbd>J</kbd>/<kbd>K</kbd> next / prev
            </span>
            <span>
              <kbd>Enter</kbd> open
            </span>
            <span>
              <kbd>Esc</kbd> close
            </span>
          </Keys>
        )}

        {b.open && (
          <InvoiceDrawer
            invoice={b.open}
            detail={b.detail}
            trace={b.trace}
            approving={b.approvingId === b.open.invoice_id}
            flagging={b.flaggingId === b.open.invoice_id}
            onClose={() => b.setOpenId(null)}
            onApprove={() => void b.handleApprove(b.open!.invoice_id)}
            onPause={() => void b.handlePause(b.open!.invoice_id)}
            onSoften={() => void b.handleSoften(b.open!.invoice_id)}
          />
        )}

        {addModals}
      </Page>
    </Rise>
  );
}
