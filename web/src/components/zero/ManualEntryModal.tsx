"use client";

// Manual single-invoice entry (Phase 4). Always targets the signed-in operator's
// own tenant, same as UploadCsvModal. is_b2b is a forced choice with no default -
// it's compliance-critical (drives the gate's B2B_ONLY rule), so "never guess"
// applies here exactly as it does in the CSV adapter.

import { useState } from "react";
import styled from "styled-components";
import type { ManualEntryResponse } from "@/lib/types";
import { addManualInvoice } from "@/lib/api";
import ModalShell from "@/components/shell/ModalShell";

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  input,
  select {
    font: inherit;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.bg};
    border: 1px solid ${({ theme }) => theme.border};
    border-radius: 9px;
    padding: 9px 10px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const CheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.text};
  margin-bottom: 14px;
  input {
    width: 16px;
    height: 16px;
  }
`;

const Err = styled.p`
  margin: 0 0 12px;
  font-size: 13px;
  color: ${({ theme }) => theme.status.escalated.fg};
`;

const Note = styled.p`
  margin: 10px 0 0;
  font-size: 12.5px;
  color: ${({ theme }) => theme.status.quarantined.fg};
`;

const Btn = styled.button<{ $primary?: boolean }>`
  width: 100%;
  padding: 11px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.border};
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ theme, $primary }) => ($primary ? theme.accentText : theme.text)};
  background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surface)};
  &:hover:not(:disabled) {
    opacity: 0.92;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export default function ManualEntryModal({ onClose, onAdded }: Props) {
  const [debtorName, setDebtorName] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isB2b, setIsB2b] = useState<"" | "true" | "false">("");
  const [debtorEmail, setDebtorEmail] = useState("");
  const [debtorPhone, setDebtorPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [lateFeeAllowed, setLateFeeAllowed] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualEntryResponse | null>(null);

  const canSubmit = Boolean(
    debtorName.trim() && amountDue.trim() && issueDate && dueDate && isB2b !== "",
  );

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await addManualInvoice({
        debtor_name: debtorName.trim(),
        amount_due: amountDue.trim(),
        issue_date: issueDate,
        due_date: dueDate,
        is_b2b: isB2b === "true",
        debtor_email: debtorEmail.trim() || null,
        debtor_phone: debtorPhone.trim() || null,
        currency: currency.trim() || "USD",
        late_fee_allowed: lateFeeAllowed,
        invoice_number: invoiceNumber.trim() || null,
      });
      setResult(res);
      onAdded();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <ModalShell title="Invoice added" onClose={onClose}>
        <p>
          <strong>{result.invoice_id}</strong> was added.
        </p>
        {result.quarantined ? (
          <Note>Held for review: {result.issues.join("; ")}</Note>
        ) : (
          <p>It&rsquo;s now on your board.</p>
        )}
        <Btn $primary onClick={onClose}>
          Done
        </Btn>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Add an invoice" onClose={onClose}>
      {error && <Err>{error}</Err>}
      <Grid>
        <Field>
          Debtor name
          <input value={debtorName} onChange={(e) => setDebtorName(e.target.value)} placeholder="Acme Corp" />
        </Field>
        <Field>
          Amount due
          <input
            value={amountDue}
            onChange={(e) => setAmountDue(e.target.value)}
            placeholder="1000.00"
            inputMode="decimal"
          />
        </Field>
        <Field>
          Issue date
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </Field>
        <Field>
          Due date
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field>
          Business or consumer?
          <select value={isB2b} onChange={(e) => setIsB2b(e.target.value as "" | "true" | "false")}>
            <option value="" disabled>
              Select…
            </option>
            <option value="true">Business (B2B)</option>
            <option value="false">Consumer</option>
          </select>
        </Field>
        <Field>
          Currency
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </Field>
        <Field>
          Debtor email
          <input value={debtorEmail} onChange={(e) => setDebtorEmail(e.target.value)} placeholder="ap@acme.com" />
        </Field>
        <Field>
          Debtor phone
          <input value={debtorPhone} onChange={(e) => setDebtorPhone(e.target.value)} placeholder="optional" />
        </Field>
        <Field>
          Invoice number
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="optional" />
        </Field>
      </Grid>
      <CheckRow>
        <input
          type="checkbox"
          checked={lateFeeAllowed}
          onChange={(e) => setLateFeeAllowed(e.target.checked)}
        />
        Late fees allowed under the contract
      </CheckRow>
      <Btn $primary onClick={submit} disabled={!canSubmit || busy}>
        {busy ? "Adding…" : "Add invoice"}
      </Btn>
    </ModalShell>
  );
}
