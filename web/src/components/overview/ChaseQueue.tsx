"use client";

// Featured next decision + readable queue. Ranked by amount × days overdue.

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { useBoard } from "@/lib/BoardContext";
import { formatMoney, overdueLabel } from "@/lib/format";
import type { InvoiceCard } from "@/lib/types";
import { GhostLink, Panel, PanelHead, Rise } from "./overviewChrome";

const CHANNEL: Record<string, string> = { email: "Email", sms: "SMS", voice: "Voice" };

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 22px 20px;
`;

const Featured = styled.button`
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: end;
  padding: 18px 18px 16px;
  border: 1px solid ${({ theme }) => `${theme.status.awaiting_approval.fg}44`};
  border-radius: 18px;
  background:
    linear-gradient(
      135deg,
      ${({ theme }) => theme.status.awaiting_approval.bg} 0%,
      ${({ theme }) => theme.surface} 70%
    );
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
  &:hover {
    transform: translateY(-1px);
    border-color: ${({ theme }) => theme.status.awaiting_approval.fg}88;
  }
`;

const Tag = styled.div`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.status.awaiting_approval.fg};
`;

const Debtor = styled.div`
  margin-top: 8px;
  font-family: var(--font-display, inherit);
  font-size: clamp(22px, 2.4vw, 28px);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1.1;
  color: ${({ theme }) => theme.text};
`;

const Action = styled.div`
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.4;
  color: ${({ theme }) => theme.textMuted};
`;

const FeatMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
`;

const Pill = styled.span<{ $fg?: string; $bg?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme, $fg }) => $fg ?? theme.text};
  background: ${({ theme, $bg }) => $bg ?? theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
`;

const ReviewBtn = styled.span`
  align-self: end;
  padding: 10px 14px;
  border-radius: 11px;
  font-size: 13.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.accentText};
  background: ${({ theme }) => theme.accent};
  white-space: nowrap;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Row = styled.button`
  width: 100%;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px 14px;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 14px;
  background: ${({ theme }) => theme.surfaceAlt};
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  &:hover {
    background: ${({ theme }) => theme.surface};
    border-color: ${({ theme }) => theme.textMuted}55;
  }
`;

const Rank = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-family: var(--font-display, inherit);
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.text};
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
`;

const Name = styled.div`
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: ${({ theme }) => theme.text};
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
  font-size: 13px;
  color: ${({ theme }) => theme.textMuted};
  .amt {
    font-weight: 600;
    color: ${({ theme }) => theme.text};
  }
`;

const Cta = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.accent};
`;

const Empty = styled.div`
  padding: 28px 8px;
  text-align: center;
  .t {
    font-family: var(--font-display, inherit);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.03em;
  }
  .s {
    margin: 8px auto 0;
    max-width: 36ch;
    font-size: 14px;
    line-height: 1.5;
    color: ${({ theme }) => theme.textMuted};
  }
`;

function score(inv: InvoiceCard): number {
  const amt = Number(inv.amount_due) || 0;
  return amt * Math.max(1, inv.days_overdue);
}

function urgencyColor(theme: AppTheme, days: number): string {
  if (days >= 15) return theme.status.escalated.fg;
  if (days >= 8) return theme.status.awaiting_approval.fg;
  return theme.status.held.fg;
}

const goApprovals = () => {
  if (typeof window !== "undefined") window.location.hash = "approvals";
};

export default function ChaseQueue() {
  const theme = useTheme() as AppTheme;
  const { board } = useBoard();
  const queued = [...(board?.invoices ?? []).filter((i) => i.can_approve)].sort(
    (a, b) => score(b) - score(a),
  );
  const [first, ...rest] = queued;
  const firstCh = first?.channel ?? "email";

  return (
    <Rise $delay={160}>
      <Panel>
        <PanelHead>
          <div className="copy">
            <span className="title">Needs your OK</span>
            <span className="hint">Tap Review. First message won&rsquo;t send without you.</span>
          </div>
          {queued.length > 0 && (
            <GhostLink onClick={goApprovals}>Review all {queued.length}</GhostLink>
          )}
        </PanelHead>
        <Body>
          {queued.length === 0 ? (
            <Empty>
              <div className="t">You&rsquo;re clear</div>
              <div className="s">
                Nothing waiting. The agent parks first contact here for one-tap sign-off.
              </div>
            </Empty>
          ) : (
            <>
              {first && (
                <Featured onClick={goApprovals}>
                  <div>
                    <Tag>Next up</Tag>
                    <Debtor>{first.debtor_name}</Debtor>
                    <Action>
                      {firstCh === "voice"
                        ? "Approve the first voice call before it dials."
                        : "Approve the first outreach before it sends."}
                    </Action>
                    <FeatMeta>
                      <Pill>{formatMoney(first.amount_due, first.currency)}</Pill>
                      <Pill $fg={urgencyColor(theme, first.days_overdue)}>
                        {overdueLabel(first.days_overdue)}
                      </Pill>
                      <Pill>{CHANNEL[firstCh] ?? firstCh}</Pill>
                    </FeatMeta>
                  </div>
                  <ReviewBtn>Review</ReviewBtn>
                </Featured>
              )}
              {rest.length > 0 && (
                <List>
                  {rest.slice(0, 4).map((inv, idx) => {
                    const ch = inv.channel ?? "email";
                    return (
                      <Row key={inv.invoice_id} onClick={goApprovals}>
                        <Rank>{idx + 2}</Rank>
                        <div>
                          <Name>{inv.debtor_name}</Name>
                          <Meta>
                            <span className="amt">{formatMoney(inv.amount_due, inv.currency)}</span>
                            <span>·</span>
                            <span style={{ color: urgencyColor(theme, inv.days_overdue) }}>
                              {overdueLabel(inv.days_overdue)}
                            </span>
                            <span>·</span>
                            <span>{CHANNEL[ch] ?? ch}</span>
                          </Meta>
                        </div>
                        <Cta>Review</Cta>
                      </Row>
                    );
                  })}
                </List>
              )}
            </>
          )}
        </Body>
      </Panel>
    </Rise>
  );
}
