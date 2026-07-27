"use client";

import styled from "styled-components";
import type { ConsoleTabKey } from "./consoleTabs";

export type { ConsoleTabKey } from "./consoleTabs";
export { CONSOLE_DATA, CONSOLE_TABS } from "./consoleTabs";

const Surface = styled.div`
  margin-top: 18px;
  border: 1px solid #2a2d33;
  border-radius: 14px;
  overflow: hidden;
  background: #16181c;
`;
const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid #2a2d33;
  .kpi {
    padding: 14px 12px;
    border-right: 1px solid #2a2d33;
  }
  .kpi:last-child {
    border: 0;
  }
  .k {
    font: 600 10px var(--font-body);
    color: #8b9099;
  }
  .v {
    font: 700 20px / 1.1 var(--font-display);
    letter-spacing: -0.03em;
    margin-top: 8px;
    color: #f3f4f6;
  }
  .s {
    font: 400 10px var(--font-body);
    color: #6f747c;
    margin-top: 4px;
  }
  .await .v {
    color: #f0b45a;
  }
  .ok .v {
    color: #76d9aa;
  }
  @media (max-width: 620px) {
    grid-template-columns: 1fr 1fr;
    .kpi:nth-child(2) {
      border-right: 0;
    }
    .kpi:nth-child(-n + 2) {
      border-bottom: 1px solid #2a2d33;
    }
  }
`;
const Row = styled.div`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #24272d;
  font: 500 11px var(--font-body);
  color: #e5e7eb;
  &:last-child {
    border: 0;
  }
  .av {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: #242833;
    color: #a99cff;
    font: 700 8px var(--font-mono);
  }
  .meta {
    font-size: 10px;
    color: #7a808a;
    margin-top: 3px;
  }
  .tag {
    padding: 3px 7px;
    border-radius: 999px;
    font: 600 8px var(--font-mono);
    white-space: nowrap;
  }
  .warn {
    background: rgba(240, 180, 90, 0.14);
    color: #f0b45a;
  }
  .paid {
    background: rgba(118, 217, 170, 0.12);
    color: #76d9aa;
  }
`;
const Approval = styled.div`
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border-bottom: 1px solid #2a2d33;
  }
  .av {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: #242833;
    color: #a99cff;
    font: 700 8px var(--font-mono);
  }
  .meta {
    font: 400 10px var(--font-body);
    color: #7a808a;
    margin-top: 3px;
  }
  .amount {
    margin-left: auto;
    font: 700 13px var(--font-display);
    color: #f3f4f6;
  }
  .message {
    margin: 12px;
    padding: 12px;
    border: 1px solid #2a2d33;
    border-radius: 10px;
    background: #121418;
    font: 400 11px / 1.55 var(--font-body);
    color: #c4c8d0;
  }
  .to {
    font: 600 8px var(--font-mono);
    text-transform: uppercase;
    color: #7a808a;
    margin-bottom: 7px;
  }
  .why {
    margin: 0 12px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(240, 180, 90, 0.1);
    color: #f0b45a;
    font: 600 10px var(--font-body);
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin: 10px 12px;
  }
  .chip {
    padding: 4px 7px;
    border-radius: 999px;
    background: rgba(118, 217, 170, 0.1);
    color: #76d9aa;
    font: 600 8px var(--font-mono);
  }
  .actions {
    display: flex;
    gap: 7px;
    padding: 0 12px 12px;
  }
  .actions button {
    padding: 8px 11px;
    border-radius: 8px;
    border: 1px solid #343842;
    background: #1a1d22;
    color: #e5e7eb;
    font: 600 10px var(--font-body);
    cursor: pointer;
  }
  .actions .primary {
    border-color: #7466f2;
    background: #7466f2;
    color: #fff;
  }
`;
const Table = styled.div`
  .head,
  .row {
    display: grid;
    grid-template-columns: 1fr 1.1fr 0.7fr 0.7fr 1fr;
    gap: 8px;
    padding: 10px 12px;
    align-items: center;
  }
  .head {
    font: 600 9px var(--font-mono);
    text-transform: uppercase;
    color: #7a808a;
    background: #121418;
  }
  .row {
    border-top: 1px solid #24272d;
    font: 500 10px var(--font-body);
    color: #e5e7eb;
  }
  .id {
    font-family: var(--font-mono);
    color: #a99cff;
  }
  .status {
    justify-self: start;
    padding: 3px 6px;
    border-radius: 999px;
    font: 600 8px var(--font-mono);
  }
  .await {
    background: rgba(240, 180, 90, 0.14);
    color: #f0b45a;
  }
  .held {
    background: rgba(116, 102, 242, 0.14);
    color: #a99cff;
  }
  .paid {
    background: rgba(118, 217, 170, 0.12);
    color: #76d9aa;
  }
  @media (max-width: 620px) {
    .head,
    .row {
      grid-template-columns: 1fr 0.9fr 0.8fr;
    }
    .hide {
      display: none;
    }
  }
`;
const Activity = styled.div`
  .filters {
    display: flex;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid #2a2d33;
    overflow: auto;
  }
  .filter {
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid #343842;
    font: 600 8px var(--font-mono);
    color: #8b9099;
    white-space: nowrap;
  }
  .filter.on {
    background: #f3f4f6;
    color: #111214;
    border-color: #f3f4f6;
  }
  .event {
    display: grid;
    grid-template-columns: 8px 1fr auto;
    gap: 10px;
    padding: 11px 12px;
    border-bottom: 1px solid #24272d;
  }
  .event:last-child {
    border: 0;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    margin-top: 4px;
  }
  .title {
    font: 600 11px var(--font-body);
    color: #f3f4f6;
  }
  .reason {
    font: 400 10px / 1.45 var(--font-body);
    color: #7a808a;
    margin-top: 3px;
  }
  .time {
    font: 600 8px var(--font-mono);
    color: #6f747c;
  }
`;

export default function ProductConsolePreview({ tab }: { tab: ConsoleTabKey }) {
  if (tab === "overview")
    return (
      <Surface>
        <KpiGrid>
          <div className="kpi"><div className="k">Outstanding</div><div className="v">$45,970</div><div className="s">still owed across open invoices</div></div>
          <div className="kpi"><div className="k">In flight</div><div className="v">$12,950</div><div className="s">actively being chased</div></div>
          <div className="kpi ok"><div className="k">Recovered</div><div className="v">$8,410</div><div className="s">marked paid</div></div>
          <div className="kpi await"><div className="k">Awaiting you</div><div className="v">2</div><div className="s">$7,800 pending sign-off</div></div>
        </KpiGrid>
        <Row>
          <span className="av">AM</span>
          <div><div>Waiting for your approval</div><div className="meta">Atlas Mechanical · $6,800 · first contact</div></div>
          <span className="tag warn">AWAITING YOU</span>
        </Row>
        <Row>
          <span className="av">SR</span>
          <div><div>Paid in full</div><div className="meta">Summit Roofing · $2,750 · recovery loop stopped</div></div>
          <span className="tag paid">RECOVERED</span>
        </Row>
      </Surface>
    );

  if (tab === "approvals")
    return (
      <Surface>
        <Approval>
          <div className="top">
            <span className="av">AM</span>
            <div><b>Atlas Mechanical</b><div className="meta">first contact · email</div></div>
            <span className="amount">$6,800 · 21d</span>
          </div>
          <div className="message">
            <div className="to">to · accounts@atlasmechanical.com</div>
            Hi Atlas team, invoice INV-012 for $6,800 is now 21 days past due. Could you confirm when we should expect payment?
          </div>
          <div className="why">Waiting for your approval · first contact held</div>
          <div className="chips">
            <span className="chip">compliance passed</span>
            <span className="chip">B2B</span>
            <span className="chip">link resolves on send</span>
          </div>
          <div className="actions">
            <button type="button" className="primary">Approve &amp; send</button>
            <button type="button">Edit</button>
            <button type="button">Hold</button>
          </div>
        </Approval>
      </Surface>
    );

  if (tab === "invoices")
    return (
      <Surface>
        <Table>
          <div className="head">
            <span>Invoice</span><span>Debtor</span><span>Amount</span>
            <span className="hide">Overdue</span><span className="hide">State</span>
          </div>
          {[
            ["INV-012", "Atlas Mechanical", "$6,800", "21 days", "Awaiting you", "await"],
            ["INV-024", "Cedar & Co", "$3,400", "45 days", "Held for review", "held"],
            ["INV-008", "Summit Roofing", "$2,750", "—", "Recovered", "paid"],
          ].map((row) => (
            <div className="row" key={row[0]}>
              <span className="id">{row[0]}</span>
              <span>{row[1]}</span>
              <b>{row[2]}</b>
              <span className="hide">{row[3]}</span>
              <span className={`status hide ${row[5]}`}>{row[4]}</span>
            </div>
          ))}
        </Table>
      </Surface>
    );

  if (tab === "inbox")
    return (
      <Surface>
        <Row>
          <span className="av">AM</span>
          <div><div>First send · needs your OK</div><div className="meta">Atlas Mechanical · $6,800</div></div>
          <span className="tag warn">APPROVE</span>
        </Row>
        <Row>
          <span className="av">CC</span>
          <div><div>Dispute · debtor replied</div><div className="meta">Cedar & Co · $3,400</div></div>
          <span className="tag held">DISPUTE</span>
        </Row>
        <Row>
          <span className="av">PR</span>
          <div><div>Payment plan requested</div><div className="meta">Pacific Retail · $4,200</div></div>
          <span className="tag warn">PLAN</span>
        </Row>
      </Surface>
    );

  if (tab === "plans")
    return (
      <Surface>
        <Row>
          <span className="av">PR</span>
          <div><div>Proposed · 3 installments</div><div className="meta">Pacific Retail · waiting on your decide</div></div>
          <span className="tag warn">PROPOSED</span>
        </Row>
        <Row>
          <span className="av">SR</span>
          <div><div>Active · next due in 12d</div><div className="meta">Summit Roofing · $2,750 schedule</div></div>
          <span className="tag paid">ACTIVE</span>
        </Row>
      </Surface>
    );

  if (tab === "settings")
    return (
      <Surface>
        <Row>
          <span className="av">AU</span>
          <div><div>Autonomy · balanced</div><div className="meta">First send still needs your OK</div></div>
          <span className="tag paid">ARMED</span>
        </Row>
        <Row>
          <span className="av">GR</span>
          <div><div>Guardrails · 2 rules</div><div className="meta">Never chase after dispute · soft tone only</div></div>
          <span className="tag held">RULES</span>
        </Row>
        <Row>
          <span className="av">CN</span>
          <div><div>Connections</div><div className="meta">Gmail connected · Stripe ready</div></div>
          <span className="tag paid">LIVE</span>
        </Row>
      </Surface>
    );

  return (
    <Surface>
      <Activity>
        <div className="filters">
          <span className="filter on">All</span>
          <span className="filter">Strategy</span>
          <span className="filter">Compliance</span>
          <span className="filter">Safety only</span>
        </div>
        {[
          ["#76d9aa", "Paid in full", "Summit Roofing · $2,750 · marked paid", "2m"],
          ["#f0b45a", "Waiting for your approval", "Atlas Mechanical · first contact email", "11m"],
          ["#ec7272", "Flagged for your review", "Cedar & Co · dispute detected", "18m"],
          ["#a99cff", "Ready to send a reminder", "Atlas Mechanical · firm email selected", "24m"],
        ].map(([color, title, reason, time]) => (
          <div className="event" key={title}>
            <span className="dot" style={{ background: color }} />
            <div>
              <div className="title">{title}</div>
              <div className="reason">{reason}</div>
            </div>
            <span className="time">{time}</span>
          </div>
        ))}
      </Activity>
    </Surface>
  );
}
