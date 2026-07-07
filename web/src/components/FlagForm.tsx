"use client";

// Inline "flag this decision" form shown in the invoice drawer. The operator leaves a
// guardrail (a durable rule) that re-orchestrates this invoice and steers similar future
// cases. The ENGINE decides the outcome and refuses waiving a non-waivable rule - this
// form only collects intent and calls the flag action.

import { useState } from "react";
import styled from "styled-components";
import type { FlagDirective, FlagScope } from "@/lib/types";
import { useBoard } from "@/lib/BoardContext";

// Directives grouped by scope. Labels are operator-facing; values match the engine enum.
const DIRECTIVES: Record<FlagScope, { value: FlagDirective; label: string }[]> = {
  compliance: [
    { value: "always_escalate", label: "Always escalate cases like this" },
    { value: "waive", label: "Waive a soft rule (accept & proceed)" },
  ],
  strategy: [
    { value: "force_skip", label: "Never chase cases like this" },
    { value: "force_hold", label: "Hold cases like this (wait)" },
    { value: "soften_tone", label: "Use a gentler tone" },
  ],
};

// Only these codes are waivable; the engine enforces this too (hard/legal codes never).
const WAIVABLE = [
  { value: "FIRST_CONTACT_APPROVAL", label: "First-contact approval" },
  { value: "FREQUENCY_LIMIT", label: "Contact-frequency limit" },
];

const Wrap = styled.div`
  background: ${({ theme }) => theme.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  select,
  textarea {
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
  textarea {
    resize: vertical;
    min-height: 52px;
  }
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.border};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ theme, $primary }) => ($primary ? theme.accentText : theme.text)};
  background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surface)};
  &:hover {
    opacity: 0.92;
  }
  &:disabled {
    opacity: 0.55;
    cursor: progress;
  }
`;

interface Props {
  invoiceId: string;
  onDone: () => void;
  onCancel: () => void;
}

export default function FlagForm({ invoiceId, onDone, onCancel }: Props) {
  const { flag, flaggingId } = useBoard();
  const [scope, setScope] = useState<FlagScope>("compliance");
  const [directive, setDirective] = useState<FlagDirective>("always_escalate");
  const [waiveCode, setWaiveCode] = useState(WAIVABLE[0].value);
  const [reason, setReason] = useState("");

  const busy = flaggingId === invoiceId;

  const onScopeChange = (next: FlagScope) => {
    setScope(next);
    setDirective(DIRECTIVES[next][0].value); // keep directive valid for the scope
  };

  const submit = async () => {
    const res = await flag(invoiceId, {
      scope,
      directive,
      waive_code: directive === "waive" ? waiveCode : null,
      reason: reason.trim(),
    });
    if (res) onDone();
  };

  return (
    <Wrap>
      <Field>
        Scope
        <select value={scope} onChange={(e) => onScopeChange(e.target.value as FlagScope)}>
          <option value="compliance">Compliance (the gate)</option>
          <option value="strategy">Strategy (whether/how to chase)</option>
        </select>
      </Field>
      <Field>
        Guardrail
        <select value={directive} onChange={(e) => setDirective(e.target.value as FlagDirective)}>
          {DIRECTIVES[scope].map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>
      {directive === "waive" && (
        <Field>
          Rule to waive (soft only)
          <select value={waiveCode} onChange={(e) => setWaiveCode(e.target.value)}>
            {WAIVABLE.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field>
        Reason
        <textarea
          value={reason}
          placeholder="Why should the engine behave differently for cases like this?"
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <Row>
        <Btn onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
        <Btn $primary onClick={submit} disabled={busy}>
          {busy ? "Applying…" : "Flag & re-orchestrate"}
        </Btn>
      </Row>
    </Wrap>
  );
}
