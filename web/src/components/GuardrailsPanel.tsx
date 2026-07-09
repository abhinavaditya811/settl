"use client";

// A compact list of the active operator guardrails (human-in-the-loop rules). Renders
// nothing when there are none. Read-only projection of the engine's rule store.

import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";
import type { GuardrailView } from "@/lib/types";

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Item = styled.li`
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12.5px;
  .head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .rule {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: ${({ theme }) => theme.textMuted};
  }
  .directive {
    font-weight: 700;
  }
  .crit {
    color: ${({ theme }) => theme.textMuted};
    margin-top: 3px;
  }
  .reason {
    margin-top: 4px;
    line-height: 1.45;
  }
`;

const DIRECTIVE_LABEL: Record<string, string> = {
  always_escalate: "Always escalate",
  force_skip: "Never chase",
  force_hold: "Hold",
  soften_tone: "Soften tone",
  waive: "Waive",
};

function criteria(g: GuardrailView): string {
  const parts = Object.entries(g.criteria).map(([k, v]) => `${k}=${String(v)}`);
  return parts.length ? parts.join(", ") : "any";
}

export default function GuardrailsPanel() {
  const { guardrails } = useBoard();
  if (!guardrails.length) return null;
  return (
    <List>
      {guardrails.map((g) => (
        <Item key={g.rule_id}>
          <div className="head">
            <span className="directive">
              {DIRECTIVE_LABEL[g.directive] ?? g.directive}
              {g.waive_code ? ` · ${g.waive_code}` : ""}
            </span>
            <span className="rule">{g.rule_id}</span>
          </div>
          {/* <div className="crit">
            {g.scope} · applies to {criteria(g)}
          </div> */}
          {g.reason && <div className="reason">{g.reason}</div>}
        </Item>
      ))}
    </List>
  );
}
