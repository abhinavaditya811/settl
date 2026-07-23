"use client";

// The per-invoice decision trace. Default view shows only the milestones a
// business owner cares about ("You approved it", "They asked us to stop"); a
// "Show details" toggle reveals the mechanics (strategy, drafting, gate internals)
// in plain English; a "Technical trace" toggle (a developer escape hatch, shared
// across surfaces) flips the whole thing to raw agent/decision/reasoning. The
// label + tier logic lives in lib/reasoning.ts so the Activity feed stays in step.

import { useState } from "react";
import styled from "styled-components";
import type { TraceEntry } from "@/lib/types";
import { humanizeDetails, cleanReasoning, friendlyAgent, headline, stepTier } from "@/lib/reasoning";
import { useTechnicalTrace } from "@/lib/useTechnicalTrace";

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
`;
const Toggle = styled.button<{ $on?: boolean }>`
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid ${({ theme, $on }) => ($on ? theme.accent : theme.border)};
  background: ${({ theme, $on }) => ($on ? theme.accent : "transparent")};
  color: ${({ theme, $on }) => ($on ? theme.accentText : theme.textMuted)};
  &:hover { border-color: ${({ theme }) => theme.accent}; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.accent}; outline-offset: 2px; }
`;

const Timeline = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0 0 0 6px;
`;

const Hop = styled.li<{ $milestone?: boolean; $tech?: boolean }>`
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
    background: ${({ theme, $milestone }) => ($milestone ? theme.accent : theme.surface)};
    border: 2px solid ${({ theme, $milestone }) => ($milestone ? theme.bg : theme.border)};
  }
  .agent {
    font-weight: 700;
    font-size: ${({ $milestone }) => ($milestone ? "14px" : "13px")};
    color: ${({ theme, $milestone }) => ($milestone ? theme.text : theme.textMuted)};
  }
  .code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: ${({ theme }) => theme.textMuted};
    margin-left: 8px;
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
  summary::-webkit-details-marker { display: none; }
  summary::before { content: "▸ "; }
  &[open] summary::before { content: "▾ "; }
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
  const [technical, setTechnical] = useTechnicalTrace();
  const [showDetails, setShowDetails] = useState(false);

  const tiered = trace.map((e) => ({ e, tier: stepTier(e.agent, e.decision) }));
  const hasDetails = tiered.some((t) => t.tier === "detail");

  // Technical view: everything raw. Clean view: milestones always, details on toggle,
  // hidden never.
  const visible = technical
    ? tiered
    : tiered.filter((t) => t.tier === "milestone" || (showDetails && t.tier === "detail"));

  return (
    <div>
      <Controls>
        {!technical && hasDetails && (
          <Toggle type="button" $on={showDetails} onClick={() => setShowDetails((s) => !s)}>
            {showDetails ? "Hide details" : "Show details"}
          </Toggle>
        )}
        <Toggle type="button" $on={technical} onClick={() => setTechnical(!technical)}>
          Technical trace
        </Toggle>
      </Controls>

      <Timeline>
        {visible.map(({ e, tier }, i) => {
          const isMs = tier === "milestone";
          const pairs = humanizeDetails(e.details);
          return (
            <Hop key={i} $milestone={isMs} $tech={technical}>
              <div>
                <span className="agent">
                  {technical ? e.agent : isMs ? headline(e.agent, e.decision) : friendlyAgent(e.agent)}
                </span>
                {technical && <span className="code">{e.decision}</span>}
                {e.timestamp && (
                  <span className="time">{new Date(e.timestamp).toLocaleTimeString()}</span>
                )}
              </div>
              <div className="why">{technical ? e.reasoning : cleanReasoning(e.reasoning)}</div>
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
    </div>
  );
}
