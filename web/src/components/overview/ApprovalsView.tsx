"use client";

// Approvals inbox UI. Queue/sort/keyboard/progress live in useApprovalsQueue.

import styled from "styled-components";
import ApprovalCard from "./ApprovalCard";
import ApprovalCompactRow from "./ApprovalCompactRow";
import ApprovalPulse from "./ApprovalPulse";
import { Rise } from "./overviewChrome";
import { useApprovalsQueue } from "./useApprovalsQueue";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 52px;
`;

const Head = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  h1 {
    margin: 0;
    font-family: var(--font-display, inherit);
    font-size: clamp(26px, 2.6vw, 32px);
    font-weight: 600;
    letter-spacing: -0.045em;
  }
  p {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 1.4;
    color: ${({ theme }) => theme.textMuted};
    max-width: 48ch;
  }
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const SortGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  .label {
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.textMuted};
    margin-right: 2px;
  }
`;

const Filter = styled.button<{ $on?: boolean }>`
  padding: 8px 13px;
  border-radius: 999px;
  border: 1px solid
    ${({ theme, $on }) => ($on ? theme.accent : theme.border)};
  background: ${({ theme, $on }) => ($on ? theme.surfaceAlt : theme.surface)};
  color: ${({ theme, $on }) => ($on ? theme.text : theme.textMuted)};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
  &:hover {
    transform: translateY(-1px);
  }
`;

const Btn = styled.button<{ $primary?: boolean }>`
  font-size: 13.5px;
  font-weight: 700;
  padding: 9px 14px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid
    ${({ theme, $primary }) => ($primary ? "transparent" : theme.border)};
  background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surface)};
  color: ${({ theme, $primary }) => ($primary ? theme.accentText : theme.text)};
  transition: transform 0.15s ease, filter 0.15s ease;
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.04);
  }
  &:disabled {
    opacity: 0.55;
    cursor: progress;
  }
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Empty = styled.div`
  text-align: center;
  padding: 56px 20px;
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  .t {
    font-family: var(--font-display, inherit);
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.03em;
  }
  .s {
    margin: 8px auto 0;
    max-width: 38ch;
    font-size: 14px;
    line-height: 1.5;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Keys = styled.div`
  position: sticky;
  bottom: 12px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(22,27,34,0.92)" : "rgba(255,255,255,0.92)"};
  backdrop-filter: blur(8px);
  font-size: 12px;
  color: ${({ theme }) => theme.textMuted};
  kbd {
    display: inline-block;
    min-width: 1.4em;
    padding: 2px 6px;
    margin-right: 4px;
    border-radius: 5px;
    border: 1px solid ${({ theme }) => theme.border};
    background: ${({ theme }) => theme.surfaceAlt};
    font-size: 11px;
    font-weight: 700;
    color: ${({ theme }) => theme.text};
    text-align: center;
  }
`;

export default function ApprovalsView() {
  const q = useApprovalsQueue();

  return (
    <Rise>
      <Page>
        <Head>
          <div>
            <h1>Approvals</h1>
            <p>
              Clear one first message at a time. Edit if needed, then approve. Gate re-checks
              every send.
            </p>
          </div>
          {q.queued.length > 1 && (
            <Btn $primary disabled={q.bulkBusy} onClick={q.approveAll}>
              {q.bulkBusy ? "Approving…" : `Approve all ${q.queued.length}`}
            </Btn>
          )}
        </Head>

        {q.allQueued.length > 0 && (
          <ApprovalPulse
            waiting={q.allQueued.length}
            heldAmount={q.heldAmount}
            currency={q.ccy}
          />
        )}

        <Toolbar>
          <Filters>
            {(
              [
                ["all", "All"],
                ["email", "Email"],
                ["sms", "SMS"],
                ["voice", "Voice"],
              ] as const
            ).map(([key, label]) => (
              <Filter
                key={key}
                $on={q.channel === key}
                onClick={() => q.setChannel(key)}
                type="button"
              >
                {label}
                {q.counts[key] > 0 ? ` · ${q.counts[key]}` : ""}
              </Filter>
            ))}
          </Filters>
          <SortGroup>
            <span className="label">Sort</span>
            <Filter
              type="button"
              $on={q.sortMode === "risk"}
              onClick={() => q.setSortMode("risk")}
            >
              Highest risk
            </Filter>
            <Filter
              type="button"
              $on={q.sortMode === "amount"}
              onClick={() => q.setSortMode("amount")}
            >
              Largest $
            </Filter>
          </SortGroup>
        </Toolbar>

        {q.queued.length === 0 ? (
          <Empty>
            <div className="t">You&rsquo;re clear</div>
            <div className="s">
              {q.channel === "all"
                ? "Nothing waiting. New first contacts land here before they send."
                : `No ${q.channel} messages waiting. Try All.`}
            </div>
          </Empty>
        ) : (
          <Stack>
            {q.queued.map((inv, idx) => {
              const isOpen = inv.invoice_id === q.open?.invoice_id;
              if (isOpen) {
                return (
                  <Rise key={inv.invoice_id} $delay={40}>
                    <ApprovalCard
                      invoice={inv}
                      detail={q.details[inv.invoice_id]}
                      busy={
                        q.approvingId === inv.invoice_id ||
                        q.flaggingId === inv.invoice_id ||
                        q.bulkBusy
                      }
                      requestEdit={q.editTick}
                      onApprove={q.handleApprove}
                      onCall={q.handleCall}
                      onSkip={q.handleSkip}
                      onHold={q.handleHold}
                    />
                  </Rise>
                );
              }
              return (
                <ApprovalCompactRow
                  key={inv.invoice_id}
                  invoice={inv}
                  rank={idx + 1}
                  onOpen={() => q.setOpenId(inv.invoice_id)}
                />
              );
            })}
          </Stack>
        )}

        {q.queued.length > 0 && (
          <Keys>
            <span>
              <kbd>A</kbd> approve
            </span>
            <span>
              <kbd>E</kbd> edit
            </span>
            <span>
              <kbd>J</kbd>/<kbd>K</kbd> next / prev
            </span>
          </Keys>
        )}
      </Page>
    </Rise>
  );
}
