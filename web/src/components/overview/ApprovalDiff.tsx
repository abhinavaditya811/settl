"use client";

// Compact line diff between original draft and operator edit.

import styled from "styled-components";

const Box = styled.div`
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => `${theme.status.awaiting_approval.fg}44`};
  background: ${({ theme }) => theme.status.awaiting_approval.bg};
`;

const Label = styled.div`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.status.awaiting_approval.fg};
  margin-bottom: 8px;
`;

const Line = styled.div<{ $kind: "del" | "add" }>`
  font-size: 13px;
  line-height: 1.45;
  margin-top: 4px;
  color: ${({ theme, $kind }) =>
    $kind === "del" ? theme.status.escalated.fg : theme.status.sent.fg};
  text-decoration: ${({ $kind }) => ($kind === "del" ? "line-through" : "none")};
  opacity: ${({ $kind }) => ($kind === "del" ? 0.85 : 1)};
`;

function splitLines(s: string): string[] {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Return changed lines only; null if nothing meaningful to show. */
export function changedLines(
  original: string,
  edited: string,
): { removed: string[]; added: string[] } | null {
  const a = splitLines(original);
  const b = splitLines(edited);
  if (a.join("\n") === b.join("\n")) return null;
  const aSet = new Set(a);
  const bSet = new Set(b);
  const removed = a.filter((l) => !bSet.has(l));
  const added = b.filter((l) => !aSet.has(l));
  if (!removed.length && !added.length) {
    // Same lines, content edited in place — show both full texts briefly.
    return { removed: a.slice(0, 2), added: b.slice(0, 2) };
  }
  return {
    removed: removed.slice(0, 3),
    added: added.slice(0, 3),
  };
}

export default function ApprovalDiff({
  original,
  edited,
}: {
  original: string;
  edited: string;
}) {
  const diff = changedLines(original, edited);
  if (!diff) return null;
  return (
    <Box>
      <Label>Your edits</Label>
      {diff.removed.map((l) => (
        <Line key={`r-${l.slice(0, 24)}`} $kind="del">
          − {l}
        </Line>
      ))}
      {diff.added.map((l) => (
        <Line key={`a-${l.slice(0, 24)}`} $kind="add">
          + {l}
        </Line>
      ))}
    </Box>
  );
}
