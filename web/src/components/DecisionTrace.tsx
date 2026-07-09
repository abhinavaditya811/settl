"use client";

// The per-invoice decision trace: one hop per agent decision, each expandable to its
// structured "thought process" (the details the engine logged - factors, gate codes,
// tone, waivers). Extracted from InvoiceDrawer so the drawer stays lean and the trace
// is reusable.

import styled from "styled-components";
import type { TraceEntry } from "@/lib/types";
import { humanizeDetails, cleanReasoning, friendlyAgent } from "@/lib/reasoning";

const Timeline = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0 0 0 6px;
`;

const Hop = styled.li`
  position: relative;
  padding: 0 0 18px 22px;
  border-left: 2px solid ${({ theme }) => theme.border};
  &:last-child {
    border-left-color: transparent;
    padding-bottom: 0;
  }
  &::before {
    content: "";
    position: absolute;
    left: -7px;
    top: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${({ theme }) => theme.accent};
    border: 2px solid ${({ theme }) => theme.bg};
  }
  .agent {
    font-weight: 700;
    font-size: 13.5px;
  }
  .why {
    font-size: 13px;
    line-height: 1.5;
    color: ${({ theme }) => theme.textMuted};
    margin-top: 3px;
  }
  .time {
    font-size: 11px;
    color: ${({ theme }) => theme.textMuted};
    opacity: 0.7;
    margin-left: 8px;
  }
`;

const HopDetails = styled.details`
  margin-top: 6px;
  summary {
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 700;
    color: ${({ theme }) => theme.accent};
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::before {
    content: "▸ ";
  }
  &[open] summary::before {
    content: "▾ ";
  }
  dl {
    margin: 8px 0 0;
    padding: 10px 12px;
    background: ${({ theme }) => theme.surfaceAlt};
    border-radius: 9px;
    font-size: 12px;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
  }
  dt {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 10.5px;
    color: ${({ theme }) => theme.textMuted};
    align-self: center;
  }
  dd {
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-word;
  }
`;

export default function DecisionTrace({ trace }: { trace: TraceEntry[] }) {
  return (
    <Timeline>
      {trace.map((e, i) => {
        const pairs = humanizeDetails(e.details);
        return (
          <Hop key={i}>
            <div>
              <span className="agent">{friendlyAgent(e.agent)}</span>
              {e.timestamp && (
                <span className="time">{new Date(e.timestamp).toLocaleTimeString()}</span>
              )}
            </div>
            <div className="why">{cleanReasoning(e.reasoning)}</div>
            {pairs.length > 0 && (
              <HopDetails>
                <summary>Why — full reasoning</summary>
                <dl>
                  {pairs.map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </HopDetails>
            )}
          </Hop>
        );
      })}
    </Timeline>
  );
}
