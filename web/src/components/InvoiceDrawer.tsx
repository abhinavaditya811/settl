"use client";

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import type { InvoiceDetail, TraceEntry } from "@/lib/types";
import { getDetail, getTrace } from "@/lib/api";
import { formatMoney, overdueLabel } from "@/lib/format";
import { useBoard } from "@/lib/BoardContext";
import { StateBadge, StatusTag } from "./Badge";
import DecisionTrace from "./DecisionTrace";
import FlagForm from "./FlagForm";
import GuardrailsPanel from "./GuardrailsPanel";
import PaymentPlanPanel from "./PaymentPlanPanel";

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const slideIn = keyframes`from { transform: translateX(24px); opacity: 0.4; } to { transform: translateX(0); opacity: 1; }`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(8, 11, 15, 0.45);
  animation: ${fadeIn} 0.15s ease;
  z-index: 40;
`;

const Panel = styled.aside`
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: min(540px, 100vw);
  background: ${({ theme }) => theme.bg};
  border-left: 1px solid ${({ theme }) => theme.border};
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  animation: ${slideIn} 0.2s ease;
  z-index: 41;
`;

const Head = styled.div`
  padding: 22px 24px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .who {
    font-size: 18px;
    font-weight: 700;
  }
  .id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    color: ${({ theme }) => theme.textMuted};
    margin-top: 2px;
  }
  .tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 14px;
    align-items: center;
  }
`;

const Close = styled.button`
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  border-radius: 9px;
  width: 32px;
  height: 32px;
  font-size: 16px;
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 24px;
`;

const Label = styled.div`
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.textMuted};
  margin: 18px 0 9px;
  font-weight: 700;
`;

const Message = styled.div`
  background: ${({ theme }) => theme.surface};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 12px;
  padding: 15px 16px;
  font-size: 14px;
  line-height: 1.6;
`;

const PayLink = styled.a`
  word-break: break-all;
  color: ${({ theme }) => theme.accent};
  text-decoration: underline;
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid ${({ theme }) => theme.border};
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Approve = styled.button`
  width: 100%;
  padding: 12px;
  border-radius: 11px;
  border: none;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ theme }) => theme.accentText};
  background: ${({ theme }) => theme.accent};
  &:hover {
    opacity: 0.92;
  }
  &:disabled {
    opacity: 0.55;
    cursor: progress;
  }
`;

const FlagBtn = styled.button`
  width: 100%;
  padding: 11px;
  border-radius: 11px;
  border: 1px solid ${({ theme }) => theme.border};
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ theme }) => theme.text};
  background: ${({ theme }) => theme.surface};
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
`;

const Muted = styled.p`
  color: ${({ theme }) => theme.textMuted};
  font-size: 13.5px;
`;

// Render the message body, turning the resolved payment URL into a clickable link.
function renderBody(text: string, url: string | null) {
  if (!url || !text.includes(url)) return text;
  return text.split(url).map((part, i, arr) => (
    <span key={i}>
      {part}
      {i < arr.length - 1 && (
        <PayLink href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </PayLink>
      )}
    </span>
  ));
}

interface Props {
  invoiceId: string;
  approvingId: string | null;
  onApprove: (id: string) => void;
  onClose: () => void;
  refreshKey: number;
}

export default function InvoiceDrawer({
  invoiceId,
  approvingId,
  onApprove,
  onClose,
  refreshKey,
}: Props) {
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFlag, setShowFlag] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0); // re-fetch after a flag
  const { guardrails } = useBoard();

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    Promise.all([getDetail(invoiceId), getTrace(invoiceId)])
      .then(([d, t]) => {
        if (!active) return;
        setDetail(d);
        setTrace(t);
      })
      .catch((e) => active && setError(String(e.message ?? e)));
    return () => {
      active = false;
    };
  }, [invoiceId, refreshKey, localRefresh]);

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        {error && (
          <Body>
            <Muted>Couldn’t load {invoiceId}: {error}</Muted>
          </Body>
        )}
        {!error && !detail && (
          <Body>
            <Muted>Loading {invoiceId}…</Muted>
          </Body>
        )}
        {detail && (
          <>
            <Head>
              <div className="row">
                <div>
                  <div className="who">{detail.debtor_name}</div>
                  <div className="id">{detail.invoice_id}</div>
                </div>
                <Close onClick={onClose} aria-label="Close">
                  ✕
                </Close>
              </div>
              <div className="tags">
                <StateBadge state={detail.terminal_state} />
                <StatusTag label={formatMoney(detail.amount_due, detail.currency)} />
                <StatusTag label={overdueLabel(detail.days_overdue)} />
                <StatusTag label={detail.is_b2b ? "B2B" : "Consumer"} />
                {detail.channel && <StatusTag label={detail.channel} />}
              </div>
            </Head>
            <Body>
              {detail.message_preview ? (
                <>
                  <Label>Drafted message</Label>
                  <Message>
                    {renderBody(detail.message_preview, detail.payment_link)}
                  </Message>
                </>
              ) : (
                <Muted>No message was drafted for this invoice.</Muted>
              )}

              <PaymentPlanPanel invoiceId={detail.invoice_id} steps={detail.steps} />

              <Label>Decision trace</Label>
              <DecisionTrace trace={trace} />

              {guardrails.length > 0 && (
                <>
                  <Label>Active guardrails</Label>
                  <GuardrailsPanel />
                </>
              )}
            </Body>
            <Footer>
              {showFlag ? (
                <FlagForm
                  invoiceId={detail.invoice_id}
                  onDone={() => {
                    setShowFlag(false);
                    setLocalRefresh((k) => k + 1); // re-fetch the re-orchestrated result
                  }}
                  onCancel={() => setShowFlag(false)}
                />
              ) : (
                <>
                  {detail.can_approve && (
                    <Approve
                      disabled={approvingId === detail.invoice_id}
                      onClick={() => onApprove(detail.invoice_id)}
                    >
                      {approvingId === detail.invoice_id ? "Sending…" : "Approve & Send"}
                    </Approve>
                  )}
                  <FlagBtn onClick={() => setShowFlag(true)}>⚑ Flag decision</FlagBtn>
                </>
              )}
            </Footer>
          </>
        )}
      </Panel>
    </Overlay>
  );
}
