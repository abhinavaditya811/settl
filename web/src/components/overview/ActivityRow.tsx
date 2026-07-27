"use client";

// Dense activity event: headline + chips + short emphasized why; expand for full.

import styled, { useTheme } from "styled-components";
import type { AppTheme } from "@/lib/theme";
import type { ActivityEntry, InvoiceCard } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { headline, cleanReasoning } from "@/lib/reasoning";
import { TONE } from "@/components/ActivityList";
import ActivityDetail from "./ActivityDetail";
import { glanceFacts, type ChipKind } from "./glanceChips";
import { emphasizeReason, shortReason } from "./activityEmphasis";
import { goToInvoice } from "./focusInvoice";

const Row = styled.div<{ $open?: boolean }>`
  border-radius: 12px;
  border: 1px solid
    ${({ theme, $open }) => ($open ? theme.accent : theme.border)};
  background: ${({ theme, $open }) =>
    $open ? theme.surfaceAlt : theme.surface};
  padding: 10px 14px;
  transition: border-color 0.15s ease, background 0.15s ease;
`;

const Top = styled.button`
  width: 100%;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
`;

const Dot = styled.span<{ $fg: string }>`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  margin-top: 5px;
  background: ${({ $fg }) => $fg};
  flex-shrink: 0;
`;

const Head = styled.div`
  .title {
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.015em;
    line-height: 1.3;
  }
  .meta {
    margin-top: 3px;
    font-size: 12px;
    font-weight: 500;
    color: ${({ theme }) => theme.textMuted};
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: center;
  }
`;

const Inv = styled.button`
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11.5px;
  font-weight: 600;
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.accent};
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`;

const When = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.textMuted};
  white-space: nowrap;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
`;

const Chip = styled.span<{ $fg: string; $bg: string }>`
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  color: ${({ $fg }) => $fg};
  background: ${({ $bg }) => $bg};
  white-space: nowrap;
`;

const Why = styled.div`
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.45;
  color: ${({ theme }) => theme.textMuted};
  strong {
    font-weight: 700;
    color: ${({ theme }) => theme.text};
  }
`;

const WhyBtn = styled.button`
  margin-top: 8px;
  font-size: 12px;
  font-weight: 700;
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.accent};
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`;

function chipColors(theme: AppTheme, kind: ChipKind): { fg: string; bg: string } {
  if (kind === "risk") return { fg: theme.status.escalated.fg, bg: theme.status.escalated.bg };
  if (kind === "ok") return { fg: theme.status.recovered.fg, bg: theme.status.recovered.bg };
  if (kind === "money") return { fg: theme.status.held.fg, bg: theme.status.held.bg };
  if (kind === "channel") {
    return { fg: theme.accent, bg: theme.mode === "dark" ? "#241f3d" : "#efeefe" };
  }
  return { fg: theme.textMuted, bg: theme.surfaceAlt };
}

export default function ActivityRow({
  entry,
  invoice,
  open,
  technical,
  onToggle,
}: {
  entry: ActivityEntry;
  invoice?: InvoiceCard;
  open: boolean;
  technical: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const { agent, decision, reasoning, invoice_id, timestamp } = entry;
  const tone = TONE[decision] ?? "skipped";
  const fg = theme.status[tone].fg;
  const title = technical ? `${agent} · ${decision}` : headline(agent, decision);
  const full = technical ? reasoning : cleanReasoning(reasoning);
  const glance = glanceFacts(agent, decision, reasoning);
  const why = glance.detail || shortReason(full, 110);
  const showWhyBtn = full.length > (why?.length ?? 0) + 8 || full.length > 110;

  return (
    <Row $open={open}>
      <Top type="button" onClick={onToggle} aria-expanded={open}>
        <Dot $fg={fg} />
        <Head>
          <div className="title">{title}</div>
          <div className="meta">
            <Inv
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToInvoice(invoice_id);
              }}
            >
              {invoice_id}
            </Inv>
            {invoice && <span>{invoice.debtor_name}</span>}
          </div>
        </Head>
        <When>{timeAgo(timestamp)}</When>
      </Top>

      {glance.chips.length > 0 && (
        <Chips>
          {glance.chips.map((c) => {
            const col = chipColors(theme, c.kind);
            return (
              <Chip key={c.label} $fg={col.fg} $bg={col.bg}>
                {c.label}
              </Chip>
            );
          })}
        </Chips>
      )}

      {!open && why && (
        <Why onClick={onToggle}>{emphasizeReason(shortReason(why, 110))}</Why>
      )}

      {open && (
        <ActivityDetail
          text={full}
          technical={technical}
          agent={agent}
          decision={decision}
        />
      )}

      {showWhyBtn && (
        <WhyBtn
          type="button"
          onClick={onToggle}
        >
          {open ? "Hide why" : "Why"}
        </WhyBtn>
      )}
    </Row>
  );
}
