"use client";

// Expanded "Why" panel: structured send preview or emphasized prose.
// Typography matches Approvals draft preview, not a raw log dump.

import styled from "styled-components";
import {
  emphasizeReason,
  parseWhy,
  viaLabel,
} from "./activityEmphasis";

const Panel = styled.div`
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px solid ${({ theme }) => theme.border};
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-bottom: 10px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.textMuted};
  b {
    font-weight: 600;
    color: ${({ theme }) => theme.text};
  }
`;

const Body = styled.div`
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.bg};
  font-family: var(--font-display, inherit);
  font-size: 14.5px;
  font-weight: 500;
  letter-spacing: -0.015em;
  line-height: 1.55;
  color: ${({ theme }) => theme.text};
  white-space: pre-wrap;
  strong {
    font-weight: 700;
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) =>
      theme.mode === "dark" ? "rgba(116, 102, 242, 0.18)" : "rgba(116, 102, 242, 0.12)"};
    padding: 0 3px;
    border-radius: 4px;
  }
`;

const Prose = styled.div`
  font-family: var(--font-display, inherit);
  font-size: 14.5px;
  font-weight: 500;
  letter-spacing: -0.015em;
  line-height: 1.55;
  color: ${({ theme }) => theme.text};
  white-space: pre-wrap;
  strong {
    font-weight: 700;
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) =>
      theme.mode === "dark" ? "rgba(116, 102, 242, 0.18)" : "rgba(116, 102, 242, 0.12)"};
    padding: 0 3px;
    border-radius: 4px;
  }
`;

const Tech = styled.div`
  margin-top: 8px;
  font-size: 11.5px;
  font-family: ui-monospace, Menlo, monospace;
  color: ${({ theme }) => theme.textMuted};
`;

export default function ActivityDetail({
  text,
  technical,
  agent,
  decision,
}: {
  text: string;
  technical: boolean;
  agent: string;
  decision: string;
}) {
  if (!text) {
    return (
      <Panel>
        <Prose>No further detail logged.</Prose>
      </Panel>
    );
  }

  // Technical mode: still emphasize, but keep raw shape visible.
  if (technical) {
    return (
      <Panel>
        <Prose>{emphasizeReason(text)}</Prose>
        <Tech>
          {agent} · {decision}
        </Tech>
      </Panel>
    );
  }

  const parsed = parseWhy(text);
  if (parsed.kind === "send") {
    return (
      <Panel>
        <Meta>
          <span>
            Via <b>{viaLabel(parsed.via)}</b>
          </span>
          <span>
            To <b>{parsed.to}</b>
          </span>
        </Meta>
        <Body>{emphasizeReason(parsed.body)}</Body>
      </Panel>
    );
  }

  return (
    <Panel>
      <Prose>{emphasizeReason(parsed.text)}</Prose>
    </Panel>
  );
}
