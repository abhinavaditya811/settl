"use client";

// Elevated activity feed: short chips for scan, full reason as wrapping text.

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { useBoard } from "@/lib/BoardContext";
import { formatMoney, timeAgo } from "@/lib/format";
import { headline, stepTier } from "@/lib/reasoning";
import { TONE } from "@/components/ActivityList";
import type { TerminalState } from "@/lib/types";
import { glanceFacts, type ChipKind } from "./glanceChips";
import { GhostLink, Panel, PanelHead, Rise } from "./overviewChrome";

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 18px;
`;

const Card = styled.div<{ $tone: TerminalState }>`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px 14px;
  padding: 14px 14px 14px 16px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surfaceAlt};
  overflow: hidden;
  transition: border-color 0.15s ease, transform 0.15s ease;
  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${({ theme, $tone }) => theme.status[$tone].fg};
  }
  &:hover {
    border-color: ${({ theme }) => theme.textMuted}55;
    transform: translateY(-1px);
  }
`;

const Main = styled.div`
  min-width: 0;
`;

const Event = styled.div`
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: ${({ theme }) => theme.text};
`;

const Customer = styled.div`
  margin-top: 4px;
  font-size: 13.5px;
  color: ${({ theme }) => theme.textMuted};
  b {
    font-weight: 600;
    color: ${({ theme }) => theme.text};
  }
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
`;

const Inv = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 8px;
  font-family: var(--font-display, inherit);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.text};
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
`;

const Amt = styled.span`
  font-family: var(--font-display, inherit);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.text};
`;

const Chip = styled.span<{ $fg: string; $bg: string }>`
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: ${({ $fg }) => $fg};
  background: ${({ $bg }) => $bg};
  white-space: nowrap;
`;

const Detail = styled.p`
  margin: 10px 0 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.text};
  /* Full width under the side column too */
  grid-column: 1 / -1;
`;

const Side = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
`;

const Badge = styled.span<{ $fg: string; $bg: string }>`
  padding: 4px 8px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ $fg }) => $fg};
  background: ${({ $bg }) => $bg};
  white-space: nowrap;
`;

const When = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.textMuted};
  white-space: nowrap;
`;

const Empty = styled.div`
  padding: 20px 8px;
  font-size: 14px;
  line-height: 1.45;
  color: ${({ theme }) => theme.textMuted};
`;

function plainHeadline(agent: string, decision: string): string {
  return headline(agent, decision).replace(/\s*[—–]\s*/g, ", ");
}

function badgeLabel(decision: string): string {
  if (decision === "sent" || decision === "approved") return "Sent";
  if (decision === "withheld") return "Held";
  if (decision === "escalate" || decision === "escalated" || decision === "awaiting_approval") {
    return "Needs you";
  }
  if (decision === "paid" || decision === "recovered" || decision === "partial") return "Paid";
  return decision.replace(/_/g, " ");
}

function chipColors(theme: AppTheme, kind: ChipKind): { fg: string; bg: string } {
  if (kind === "risk") return { fg: theme.status.escalated.fg, bg: theme.status.escalated.bg };
  if (kind === "ok") return { fg: theme.status.recovered.fg, bg: theme.status.recovered.bg };
  if (kind === "money") return { fg: theme.status.held.fg, bg: theme.status.held.bg };
  if (kind === "channel") {
    return { fg: theme.accent, bg: theme.mode === "dark" ? "#241f3d" : "#efeefe" };
  }
  return { fg: theme.textMuted, bg: theme.surface };
}

export default function AgentPulse() {
  const theme = useTheme() as AppTheme;
  const { activity, board } = useBoard();
  const byId = new Map((board?.invoices ?? []).map((i) => [i.invoice_id, i]));
  const entries = activity
    .filter((e) => stepTier(e.agent, e.decision) === "milestone")
    .slice(0, 5);

  return (
    <Rise $delay={200}>
      <Panel>
        <PanelHead>
          <div className="copy">
            <span className="title">What Settl did</span>
            <span className="hint">Latest recovery moves, facts only.</span>
          </div>
          <GhostLink
            onClick={() => {
              if (typeof window !== "undefined") window.location.hash = "activity";
            }}
          >
            See all
          </GhostLink>
        </PanelHead>
        <Body>
          {entries.length === 0 ? (
            <Empty>Nothing logged yet. Re-run the engine to fill this feed.</Empty>
          ) : (
            entries.map((e, i) => {
              const tone = (TONE[e.decision] ?? "held") as TerminalState;
              const inv = byId.get(e.invoice_id);
              const { chips, detail } = glanceFacts(e.agent, e.decision, e.reasoning);
              const status = theme.status[tone];
              return (
                <Card key={`${e.timestamp}-${e.invoice_id}-${i}`} $tone={tone}>
                  <Main>
                    <Event>{plainHeadline(e.agent, e.decision)}</Event>
                    <Customer>
                      {inv ? (
                        <>
                          to <b>{inv.debtor_name}</b>
                        </>
                      ) : (
                        <>
                          on invoice <b>{e.invoice_id}</b>
                        </>
                      )}
                    </Customer>
                    <MetaRow>
                      <Inv>{e.invoice_id}</Inv>
                      {inv && <Amt>{formatMoney(inv.amount_due, inv.currency)}</Amt>}
                      {chips.map((c) => {
                        const col = chipColors(theme, c.kind);
                        return (
                          <Chip key={c.label} $fg={col.fg} $bg={col.bg}>
                            {c.label}
                          </Chip>
                        );
                      })}
                    </MetaRow>
                  </Main>
                  <Side>
                    <Badge $fg={status.fg} $bg={status.bg}>{badgeLabel(e.decision)}</Badge>
                    <When>{timeAgo(e.timestamp)}</When>
                  </Side>
                  {detail ? <Detail>{detail}</Detail> : null}
                </Card>
              );
            })
          )}
        </Body>
      </Panel>
    </Rise>
  );
}
