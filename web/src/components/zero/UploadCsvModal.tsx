"use client";

// CSV upload (Phase 4). Reads the file client-side (File.text()) and POSTs raw
// text as JSON - no multipart anywhere in this stack (see lib/proxy.ts). Always
// targets the signed-in operator's own tenant - api.uploadCsv hits
// /api/invoices/import, which never accepts a "demo" view.

import { useState } from "react";
import styled from "styled-components";
import type { CsvImportResponse } from "@/lib/types";
import { uploadCsv } from "@/lib/api";
import ModalShell from "@/components/shell/ModalShell";

const REQUIRED_COLUMNS = "invoice_number, debtor_name, amount_due, issue_date, due_date, is_b2b";

const Hint = styled.p`
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.55;
  color: ${({ theme }) => theme.textMuted};
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }
`;

const DropArea = styled.label`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 16px;
  border: 1px dashed ${({ theme }) => theme.border};
  border-radius: 12px;
  cursor: pointer;
  text-align: center;
  font-size: 13.5px;
  color: ${({ theme }) => theme.textMuted};
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
  input {
    display: none;
  }
  .filename {
    font-weight: 700;
    color: ${({ theme }) => theme.text};
  }
`;

const Summary = styled.div`
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: ${({ theme }) => theme.surfaceAlt};
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  .row {
    display: flex;
    justify-content: space-between;
  }
  ul {
    margin: 4px 0 0;
    padding-left: 18px;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Err = styled.p`
  margin: 10px 0 0;
  font-size: 13px;
  color: ${({ theme }) => theme.status.escalated.fg};
`;

const Btn = styled.button<{ $primary?: boolean }>`
  width: 100%;
  margin-top: 16px;
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
  onImported: () => void;
}

export default function UploadCsvModal({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResponse | null>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const res = await uploadCsv(text);
      setResult(res);
      if (res.accepted > 0) onImported();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Upload your invoices" onClose={onClose}>
      <Hint>
        CSV with a header row. Required columns: <code>{REQUIRED_COLUMNS}</code>. Optional:{" "}
        <code>debtor_email, debtor_phone, currency, late_fee_allowed, payment_link</code>.
      </Hint>
      <DropArea>
        {file ? <span className="filename">{file.name}</span> : "Click to choose a CSV file"}
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
          }}
        />
      </DropArea>
      {error && <Err>{error}</Err>}
      {result && (
        <Summary>
          <div className="row">
            <span>Accepted</span>
            <strong>{result.accepted}</strong>
          </div>
          <div className="row">
            <span>Quarantined (need review)</span>
            <strong>{result.quarantined}</strong>
          </div>
          <div className="row">
            <span>Rejected</span>
            <strong>{result.rejected.length}</strong>
          </div>
          {result.rejected.length > 0 && (
            <ul>
              {result.rejected.slice(0, 5).map((r) => (
                <li key={r.row}>
                  Row {r.row}: {r.reasons.join(", ")}
                </li>
              ))}
              {result.rejected.length > 5 && <li>…and {result.rejected.length - 5} more</li>}
            </ul>
          )}
        </Summary>
      )}
      <Btn $primary onClick={submit} disabled={!file || busy}>
        {busy ? "Uploading…" : "Upload"}
      </Btn>
    </ModalShell>
  );
}
