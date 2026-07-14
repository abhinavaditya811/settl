"use client";

// The supporting Overview panels: overdue-by-age, what-the-agent-decided,
// needs-your-approval, and the recent activity feed - all real, from useBoard().

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import { useBoard } from "@/lib/BoardContext";
import { formatMoney, overdueLabel } from "@/lib/format";
import ActivityList from "@/components/ActivityList";
import AgingChart from "./AgingChart";
import OutcomeBar from "./OutcomeBar";

const Card = styled.div`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 14px;
  margin-bottom: 14px;
`;
const Head = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  .t { font-size: 14px; font-weight: 700; }
  .m { font-size: 12.5px; color: ${({ theme }) => theme.textMuted}; }
`;
const Two = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 14px;
`;
const Row = styled.div`
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 11px 18px;
  border-top: 1px solid ${({ theme }) => theme.border};
`;
const Avatar = styled.div<{ $fg: string; $bg: string }>`
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
  color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};
`;
const Pill = styled.span<{ $fg: string; $bg: string }>`
  font-size: 12px; padding: 3px 10px; border-radius: 999px; white-space: nowrap;
  color: ${({ $fg }) => $fg}; background: ${({ $bg }) => $bg};
`;
const Btn = styled.button`
  font-size: 13px; padding: 6px 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  &:hover { background: ${({ theme }) => theme.surfaceAlt}; }
`;
const BtnPrimary = styled(Btn)`
  border: none;
  background: ${({ theme }) => theme.accent};
  color: ${({ theme }) => theme.accentText};
  &:hover { filter: brightness(1.05); background: ${({ theme }) => theme.accent}; }
`;
const Line = styled.div`font-size: 14px; b { font-weight: 700; }`;
const Sub = styled.div`font-size: 12.5px; color: ${({ theme }) => theme.textMuted}; margin-top: 2px;`;
const Empty = styled.div`padding: 8px 18px 18px; font-size: 13.5px; color: ${({ theme }) => theme.textMuted};`;
const ListPad = styled.div`padding: 0 10px 6px;`;

const goToApprovals = () => {
  if (typeof window !== "undefined") window.location.hash = "approvals";
};

function ApprovalsPanel() {
  const theme = useTheme() as AppTheme;
  const { board } = useBoard();
  const fg = theme.status.awaiting_approval.fg;
  const bg = theme.status.awaiting_approval.bg;
  const queued = (board?.invoices ?? []).filter((i) => i.can_approve);

  return (
    <Card>
      <Head>
        <span className="t">Needs your approval</span>
        {queued.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pill $fg={fg} $bg={bg}>{queued.length} waiting</Pill>
            <BtnPrimary onClick={goToApprovals}>Review all</BtnPrimary>
          </span>
        )}
      </Head>
      {queued.length === 0 ? (
        <Empty>Nothing waiting on you right now.</Empty>
      ) : (
        queued.slice(0, 4).map((inv) => (
          <Row key={inv.invoice_id}>
            <Avatar $fg={fg} $bg={bg}>
              {inv.channel === "voice" ? "📞" : inv.debtor_name.slice(0, 2).toUpperCase()}
            </Avatar>
            <div>
              <Line>
                {inv.channel === "voice" ? (
                  <>First voice call to <b>{inv.debtor_name}</b></>
                ) : (
                  <>First message to <b>{inv.debtor_name}</b></>
                )}
              </Line>
              <Sub>
                {formatMoney(inv.amount_due, inv.currency)} · {overdueLabel(inv.days_overdue)} ·{" "}
                {inv.channel ?? "email"} draft
              </Sub>
            </div>
            <Btn onClick={goToApprovals}>Review</Btn>
          </Row>
        ))
      )}
    </Card>
  );
}

function RecentActivity() {
  const { activity } = useBoard();
  return (
    <Card>
      <Head>
        <span className="t">What Settl did</span>
        <span className="m">most recent</span>
      </Head>
      <ListPad>
        <ActivityList entries={activity} limit={4} />
      </ListPad>
    </Card>
  );
}

export default function OverviewPanels() {
  const { board, metrics } = useBoard();
  if (!board || !metrics) return null;
  return (
    <>
      <Two>
        <AgingChart metrics={metrics} />
        <OutcomeBar summary={board.summary} />
      </Two>
      <ApprovalsPanel />
      <RecentActivity />
    </>
  );
}
