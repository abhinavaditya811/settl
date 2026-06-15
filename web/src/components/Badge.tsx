"use client";

import styled from "styled-components";
import { STATE_META, type TerminalState } from "@/lib/types";

const Pill = styled.span<{ $tone: TerminalState }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  color: ${({ theme, $tone }) => theme.status[$tone].fg};
  background: ${({ theme, $tone }) => theme.status[$tone].bg};
`;

const Dot = styled.span<{ $tone: TerminalState }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ theme, $tone }) => theme.status[$tone].fg};
`;

export function StateBadge({ state }: { state: TerminalState }) {
  return (
    <Pill $tone={state}>
      <Dot $tone={state} />
      {STATE_META[state].label}
    </Pill>
  );
}

const Tag = styled.span`
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: ${({ theme }) => theme.textMuted};
  background: ${({ theme }) => theme.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.border};
`;

export function StatusTag({ label }: { label: string }) {
  return <Tag>{label}</Tag>;
}
