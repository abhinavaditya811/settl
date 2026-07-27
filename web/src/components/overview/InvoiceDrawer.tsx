"use client";

// Case-file drawer: identity, chase strip, steering, flag, message, plan, trace.

import { useState } from "react";
import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { InvoiceCard, InvoiceDetail, TraceEntry } from "@/lib/types";
import { STATE_META } from "@/lib/types";
import { formatMoney, overdueLabel, timeAgo } from "@/lib/format";
import { useBoard } from "@/lib/BoardContext";
import DecisionTrace from "@/components/DecisionTrace";
import PaymentPlanPanel from "@/components/PaymentPlanPanel";
import FlagForm from "@/components/FlagForm";
import { sendChannelLabel, sendTone } from "./approvalSendMeta";
import { heatColor, initials, whatsNext } from "./invoiceNext";
import { downloadEvidencePack } from "./evidenceDownload";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(8, 11, 15, 0.45);
  z-index: 40;
`;

const Drawer = styled.aside`
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: min(480px, 96vw);
  z-index: 41;
  background: ${({ theme }) => theme.bg};
  border-left: 1px solid ${({ theme }) => theme.border};
  display: flex;
  flex-direction: column;
  animation: slideIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
  @keyframes slideIn {
    from {
      transform: translateX(18px);
      opacity: 0.6;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

const DHead = styled.div`
  padding: 18px 20px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  flex-shrink: 0;
`;

const DBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 28px;
`;

const DFooter = styled.div`
  padding: 14px 20px;
  border-top: 1px solid ${({ theme }) => theme.border};
  flex-shrink: 0;
`;

const Av = styled.div<{ $fg: string; $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  color: ${({ $fg }) => $fg};
  background: ${({ $bg }) => $bg};
`;

const Pill = styled.span<{ $fg: string; $bg: string }>`
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
  color: ${({ $fg }) => $fg};
  background: ${({ $bg }) => $bg};
`;

const Close = styled.button`
  margin-left: 4px;
  background: none;
  border: none;
  color: ${({ theme }) => theme.textMuted};
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 8px;
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
    color: ${({ theme }) => theme.text};
  }
`;

const Cap = styled.div`
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.textMuted};
  font-weight: 700;
  margin: 18px 0 10px;
`;

const Chase = styled.div`
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  padding: 12px 14px;
  font-size: 13.5px;
  line-height: 1.45;
  color: ${({ theme }) => theme.text};
`;

const WhatsNext = styled.div`
  border: 1px solid ${({ theme }) => theme.accent};
  background: ${({ theme }) => theme.surfaceAlt};
  border-radius: 12px;
  padding: 13px 15px;
`;

const Steer = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
`;

const SBtn = styled.button`
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.text};
  cursor: pointer;
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.surfaceAlt};
  }
  &:disabled {
    opacity: 0.5;
    cursor: progress;
  }
`;

const Msg = styled.div`
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 12px;
  background: ${({ theme }) => theme.surface};
  padding: 13px 15px;
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
`;

const Approve = styled.button`
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  background: ${({ theme }) => theme.accent};
  color: ${({ theme }) => theme.accentText};
  &:hover:not(:disabled) {
    filter: brightness(1.05);
  }
  &:disabled {
    opacity: 0.55;
    cursor: progress;
  }
`;

function chaseLabel(
  inv: InvoiceCard,
  detail: InvoiceDetail | null,
): string | null {
  const channel = inv.channel ?? detail?.channel;
  if (!channel && !detail) return null;
  const ch = sendChannelLabel(channel ?? "email");
  const tone = sendTone(detail ?? undefined);
  if (inv.terminal_state === "awaiting_approval") {
    return tone
      ? `Waiting to send via ${ch} · ${tone}`
      : `Waiting to send via ${ch}`;
  }
  if (inv.terminal_state === "sent" || inv.terminal_state === "held") {
    return tone
      ? `Chasing via ${ch} · ${tone}`
      : channel
        ? `Chasing via ${ch}`
        : null;
  }
  if (inv.terminal_state === "recovered") return "Paid in full";
  if (inv.terminal_state === "escalated") return "Paused for your review";
  if (inv.terminal_state === "quarantined") return "Blocked until data is fixed";
  return tone ? `${ch} · ${tone}` : channel ? ch : null;
}

export default function InvoiceDrawer({
  invoice,
  detail,
  trace,
  approving,
  flagging,
  onClose,
  onApprove,
  onPause,
  onSoften,
}: {
  invoice: InvoiceCard;
  detail: InvoiceDetail | null;
  trace: TraceEntry[];
  approving: boolean;
  flagging: boolean;
  onClose: () => void;
  onApprove: () => void;
  onPause: () => void;
  onSoften: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const { activity } = useBoard();
  const [flaggingOpen, setFlaggingOpen] = useState(false);
  const st = theme.status[invoice.terminal_state];
  const chase = chaseLabel(invoice, detail);
  const canSteer =
    invoice.terminal_state !== "recovered" &&
    invoice.terminal_state !== "skipped";
  const canApprove = detail?.can_approve ?? invoice.can_approve;

  return (
    <Overlay onClick={onClose}>
      <Drawer
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Invoice ${invoice.invoice_id}`}
      >
        <DHead>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <Av $fg={st.fg} $bg={st.bg}>
              {initials(invoice.debtor_name)}
            </Av>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-display, inherit)",
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                }}
              >
                {invoice.debtor_name}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12.5,
                  color: theme.textMuted,
                  lineHeight: 1.45,
                }}
              >
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {invoice.invoice_id}
                </span>
                {" · "}
                {formatMoney(invoice.amount_due, invoice.currency)}
                {" · "}
                <span style={{ color: heatColor(invoice.days_overdue, theme) }}>
                  {overdueLabel(invoice.days_overdue)}
                </span>
                {!invoice.is_b2b ? " · Consumer" : ""}
              </div>
            </div>
            <Pill $fg={st.fg} $bg={st.bg}>
              {STATE_META[invoice.terminal_state].label}
            </Pill>
            <Close type="button" onClick={onClose} aria-label="Close">
              ×
            </Close>
          </div>
        </DHead>

        <DBody>
          {chase && (
            <>
              <Cap style={{ marginTop: 0 }}>Status</Cap>
              <Chase>{chase}</Chase>
            </>
          )}

          <Cap style={{ marginTop: chase ? undefined : 0, color: theme.accent }}>
            What&rsquo;s next
          </Cap>
          <WhatsNext>
            <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
              {whatsNext(invoice.terminal_state)}
            </div>
            {canSteer && (
              <Steer>
                <SBtn disabled={flagging} onClick={onPause}>
                  Pause chase
                </SBtn>
                <SBtn disabled={flagging} onClick={onSoften}>
                  Soften tone
                </SBtn>
                <SBtn
                  type="button"
                  disabled={flagging}
                  onClick={() => setFlaggingOpen((v) => !v)}
                >
                  {flaggingOpen ? "Hide rules" : "Set a rule"}
                </SBtn>
              </Steer>
            )}
          </WhatsNext>

          {flaggingOpen && (
            <>
              <Cap>Guardrail</Cap>
              <FlagForm
                invoiceId={invoice.invoice_id}
                onDone={() => setFlaggingOpen(false)}
                onCancel={() => setFlaggingOpen(false)}
              />
            </>
          )}

          {detail?.last_inbound_poll_at && (
            <>
              <Cap>Mailbox</Cap>
              <Chase>
                Last inbound poll {timeAgo(detail.last_inbound_poll_at)}
              </Chase>
            </>
          )}

          {(detail?.message_preview || detail?.message) && (
            <>
              <Cap>
                {invoice.terminal_state === "awaiting_approval"
                  ? "Drafted message"
                  : "The message"}
              </Cap>
              <Msg>{detail.message_preview || detail.message}</Msg>
            </>
          )}

          {detail && (
            <PaymentPlanPanel invoiceId={invoice.invoice_id} steps={detail.steps} />
          )}

          <Cap>Decision trace</Cap>
          {trace.length === 0 ? (
            <div style={{ fontSize: 13, color: theme.textMuted }}>Loading…</div>
          ) : (
            <DecisionTrace trace={trace} />
          )}

          <Steer style={{ marginTop: 16 }}>
            <SBtn
              type="button"
              onClick={() =>
                downloadEvidencePack({
                  invoiceId: invoice.invoice_id,
                  activity,
                  trace,
                })
              }
            >
              Download evidence
            </SBtn>
          </Steer>
        </DBody>

        {canApprove && (
          <DFooter>
            <Approve disabled={approving} onClick={onApprove}>
              {approving ? "Sending…" : "Approve & send"}
            </Approve>
          </DFooter>
        )}
      </Drawer>
    </Overlay>
  );
}
