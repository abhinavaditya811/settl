"use client";

// Morning cash read: one dominant outstanding figure, recovery ring, and the
// three secondary signals (in flight / recovered / awaiting) as a strip — not
// four equal school-project cards. Pattern borrowed from Monk/Stripe: answer
// "where does cash stand?" in under five seconds.

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { Metrics } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { useBoard } from "@/lib/BoardContext";
import { Rise } from "./overviewChrome";
import { useCountUp } from "./useCountUp";

const Hero = styled.section`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.7fr);
  gap: 28px;
  padding: 28px 28px 24px;
  border-radius: 22px;
  border: 1px solid ${({ theme }) => theme.border};
  background:
    radial-gradient(
      120% 140% at 0% 0%,
      ${({ theme }) => (theme.mode === "dark" ? "rgba(155,140,255,0.12)" : "rgba(109,94,246,0.08)")} 0%,
      transparent 55%
    ),
    ${({ theme }) => theme.surface};
  overflow: hidden;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Eyebrow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  .label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Refresh = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 11px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
  &:disabled {
    opacity: 0.55;
    cursor: progress;
  }
`;

const Giant = styled.div`
  font-family: var(--font-display, inherit);
  font-size: clamp(40px, 5.2vw, 56px);
  font-weight: 600;
  letter-spacing: -0.055em;
  line-height: 0.95;
  color: ${({ theme }) => theme.text};
`;

const Sub = styled.p`
  margin: 12px 0 0;
  max-width: 42ch;
  font-size: 14px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textMuted};
`;

const Strip = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin-top: 26px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.border};
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const Cell = styled.div<{ $hot?: boolean; $click?: boolean }>`
  text-align: left;
  padding: 14px 16px;
  background: ${({ theme, $hot }) => ($hot ? theme.status.awaiting_approval.bg : theme.surfaceAlt)};
  cursor: ${({ $click }) => ($click ? "pointer" : "default")};
  transition: filter 0.15s ease;
  &:hover {
    filter: ${({ $click }) => ($click ? "brightness(1.03)" : "none")};
  }
  .k {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.textMuted};
  }
  .v {
    margin-top: 6px;
    font-family: var(--font-display, inherit);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.035em;
  }
  .s {
    margin-top: 4px;
    font-size: 12px;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const RingWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 8px 0;
`;

const RingLabel = styled.div`
  text-align: center;
  .pct {
    font-family: var(--font-display, inherit);
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.04em;
  }
  .cap {
    margin-top: 4px;
    font-size: 12px;
    color: ${({ theme }) => theme.textMuted};
  }
`;

function RecoveryRing({ pct, accent }: { pct: number; accent: string }) {
  const theme = useTheme() as AppTheme;
  const r = 54;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  return (
    <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden>
      <circle cx="74" cy="74" r={r} fill="none" stroke={theme.surfaceAlt} strokeWidth="10" />
      <circle
        cx="74"
        cy="74"
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 74 74)"
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}

export default function CashCommand({ metrics }: { metrics: Metrics }) {
  const { refresh, refreshing, board } = useBoard();
  const theme = useTheme() as AppTheme;
  const book = Math.max(0, metrics.outstanding + metrics.recovered);
  const rate = book > 0 ? (metrics.recovered / book) * 100 : 0;
  const shown = useCountUp(metrics.outstanding);
  const rateShown = useCountUp(rate, 900);
  const customers = board
    ? new Set(board.invoices.filter((i) => i.status !== "paid").map((i) => i.debtor_name)).size
    : 0;
  const openCount = board?.invoices.filter((i) => i.status !== "paid").length ?? 0;

  const goApprovals = () => {
    if (typeof window !== "undefined") window.location.hash = "approvals";
  };

  return (
    <Rise>
      <Hero>
        <div>
          <Eyebrow>
            <span className="label">Cash position</span>
            <Refresh onClick={() => refresh(true)} disabled={refreshing}>
              <span aria-hidden>↻</span>
              {refreshing ? "Re-running…" : "Re-run engine"}
            </Refresh>
          </Eyebrow>
          <Giant>{formatAmount(shown, metrics.currency)}</Giant>
          <Sub>
            {openCount} open invoices
            {customers ? ` · ${customers} customers` : ""}. In flight is already being chased.
          </Sub>
          <Strip>
            <Cell>
              <div className="k">In flight</div>
              <div className="v">{formatAmount(metrics.in_flight, metrics.currency)}</div>
              <div className="s">Actively chased</div>
            </Cell>
            <Cell>
              <div className="k">Recovered</div>
              <div className="v" style={{ color: theme.status.recovered.fg }}>
                {formatAmount(metrics.recovered, metrics.currency)}
              </div>
              <div className="s">Verified paid</div>
            </Cell>
            <Cell
              $hot={metrics.awaiting_count > 0}
              $click
              onClick={goApprovals}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") goApprovals();
              }}
            >
              <div className="k">Needs you</div>
              <div className="v" style={{ color: theme.status.awaiting_approval.fg }}>
                {metrics.awaiting_count}
              </div>
              <div className="s">{formatAmount(metrics.awaiting_amount, metrics.currency)} held</div>
            </Cell>
          </Strip>
        </div>
        <RingWrap>
          <div style={{ position: "relative" }}>
            <RecoveryRing pct={rateShown} accent={theme.status.recovered.fg} />
            <RingLabel style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <div>
                <div className="pct">{Math.round(rateShown)}%</div>
                <div className="cap">recovered</div>
              </div>
            </RingLabel>
          </div>
          <RingLabel>
            <div className="cap">Collection effectiveness on this book</div>
          </RingLabel>
        </RingWrap>
      </Hero>
    </Rise>
  );
}
