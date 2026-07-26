"use client";

import styled from "styled-components";

const dark = "#111214";
const violet = "#7466f2";

const ProductSurface = styled.div`
  margin-top: 24px;
  border: 1px solid #d8d0c4;
  border-radius: 16px;
  overflow: hidden;
  background: #fffdf7;
  box-shadow: 0 18px 40px rgba(61, 48, 31, 0.08);
`;
const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid #e3dbcf;
  .kpi {
    padding: 16px;
    border-right: 1px solid #e3dbcf;
  }
  .kpi:last-child {
    border: 0;
  }
  .k {
    font: 500 8px var(--font-mono);
    text-transform: uppercase;
    color: #817970;
  }
  .v {
    font: 600 22px var(--font-display);
    letter-spacing: -0.04em;
    margin-top: 7px;
  }
  .s {
    font: 400 8px var(--font-body);
    color: #938b81;
    margin-top: 3px;
  }
  @media (max-width: 620px) {
    grid-template-columns: 1fr 1fr;
    .kpi:nth-child(2) {
      border-right: 0;
    }
    .kpi:nth-child(-n + 2) {
      border-bottom: 1px solid #e3dbcf;
    }
  }
`;
const ProductRow = styled.div`
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 13px 15px;
  border-bottom: 1px solid #e6dfd4;
  font: 500 10.5px var(--font-body);
  &:last-child {
    border: 0;
  }
  .av {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #ece8ff;
    color: ${violet};
    font: 600 8px var(--font-mono);
  }
  .tag {
    padding: 4px 7px;
    border-radius: 99px;
    background: #e2f3e9;
    color: #39795b;
    font: 500 7px var(--font-mono);
    white-space: nowrap;
  }
  .warn {
    background: #f8ead4;
    color: #98662b;
  }
  .meta {
    font-size: 8px;
    color: #938b81;
    margin-top: 3px;
  }
`;
const ApprovalMini = styled.div`
  .approval-top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border-bottom: 1px solid #e3dbcf;
  }
  .av {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #ece8ff;
    color: ${violet};
    font: 600 8px var(--font-mono);
  }
  .meta {
    font: 400 8px var(--font-body);
    color: #938b81;
    margin-top: 3px;
  }
  .approval-top .amount {
    margin-left: auto;
    font: 600 13px var(--font-display);
  }
  .message {
    margin: 14px;
    padding: 14px;
    border: 1px solid #e2dacd;
    border-radius: 10px;
    background: #faf7ef;
    font: 400 10px / 1.55 var(--font-body);
    color: #5f5952;
  }
  .to {
    font: 500 7px var(--font-mono);
    text-transform: uppercase;
    color: #948b81;
    margin-bottom: 7px;
  }
  .why {
    margin: 0 14px;
    padding: 9px 11px;
    border-radius: 8px;
    background: #eeeaff;
    color: #5e50b7;
    font: 500 8px var(--font-mono);
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin: 10px 14px;
  }
  .chip {
    padding: 4px 7px;
    border-radius: 99px;
    background: #e3f1e8;
    color: #39745a;
    font: 500 7px var(--font-mono);
  }
  .actions {
    display: flex;
    gap: 7px;
    padding: 0 14px 14px;
  }
  .actions button {
    padding: 8px 11px;
    border-radius: 8px;
    border: 1px solid #d8d0c4;
    background: #fffdf7;
    font: 600 9px var(--font-body);
    cursor: pointer;
  }
  .actions .primary {
    border-color: ${violet};
    background: ${violet};
    color: #fff;
  }
`;
const InvoiceTable = styled.div`
  .head,
  .invoice-row {
    display: grid;
    grid-template-columns: 1.1fr 1fr 0.7fr 0.7fr 0.9fr;
    align-items: center;
    gap: 10px;
    padding: 10px 13px;
  }
  .head {
    font: 500 7px var(--font-mono);
    text-transform: uppercase;
    color: #918980;
    background: #f6f1e7;
  }
  .invoice-row {
    border-top: 1px solid #e6dfd4;
    font: 500 9px var(--font-body);
  }
  .id {
    font-family: var(--font-mono);
    color: ${violet};
  }
  .status {
    justify-self: start;
    padding: 4px 6px;
    border-radius: 99px;
    background: #e2f3e9;
    color: #39795b;
    font: 500 7px var(--font-mono);
  }
  .held {
    background: #f8ead4;
    color: #98662b;
  }
  @media (max-width: 620px) {
    .head,
    .invoice-row {
      grid-template-columns: 1fr 0.8fr 0.8fr;
    }
    .hide-mobile {
      display: none;
    }
  }
`;
const ActivityMini = styled.div`
  .filters {
    display: flex;
    gap: 6px;
    padding: 12px;
    border-bottom: 1px solid #e3dbcf;
    overflow: auto;
  }
  .filter {
    padding: 5px 8px;
    border-radius: 99px;
    border: 1px solid #d8d0c4;
    font: 500 7px var(--font-mono);
    white-space: nowrap;
  }
  .filter.on {
    background: ${dark};
    color: #fff;
    border-color: ${dark};
  }
  .event {
    display: grid;
    grid-template-columns: 9px 1fr auto;
    gap: 10px;
    padding: 11px 14px;
    border-bottom: 1px solid #e6dfd4;
  }
  .event:last-child {
    border: 0;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    margin-top: 3px;
  }
  .event-title {
    font: 600 9px var(--font-body);
  }
  .reason {
    font: 400 8px / 1.45 var(--font-body);
    color: #8d857b;
    margin-top: 3px;
  }
  .time {
    font: 500 7px var(--font-mono);
    color: #9c948b;
  }
`;

export const CONSOLE_DATA = {
  overview: {
    label: "Portfolio",
    title: "Money in motion.",
    desc: "Outstanding, in flight, recovered, and waiting for you. Every figure links back to a real invoice.",
    sub: "Live cash position",
  },
  approvals: {
    label: "Human control",
    title: "The exact message before it leaves.",
    desc: "First contacts and anything the gate flags arrive with the operational reason and every safety check.",
    sub: "One-tap approval",
  },
  invoices: {
    label: "Recovery portfolio",
    title: "Every invoice and what happens next.",
    desc: "Searchable state, amount, age, type, and the next move selected by the engine.",
    sub: "Full ledger",
  },
  activity: {
    label: "Audit trail",
    title: "Every decision leaves a reason.",
    desc: "Actions, policy checks, approvals, delivery, and payment events become one exportable timeline.",
    sub: "Execution log",
  },
} as const;

export type ConsoleTabKey = keyof typeof CONSOLE_DATA;

export default function ProductConsolePreview({ tab }: { tab: ConsoleTabKey }) {
  if (tab === "overview")
    return (
      <ProductSurface>
        <KpiGrid>
          <div className="kpi"><div className="k">Outstanding</div><div className="v">$45,970</div><div className="s">still owed</div></div>
          <div className="kpi"><div className="k">In flight</div><div className="v">$12,950</div><div className="s">actively followed up</div></div>
          <div className="kpi"><div className="k">Recovered</div><div className="v">$8,410</div><div className="s">payment verified</div></div>
          <div className="kpi"><div className="k">Awaiting you</div><div className="v">2</div><div className="s">$7,800 pending</div></div>
        </KpiGrid>
        <ProductRow><span className="av">AM</span><div><div>First message to Atlas Mechanical</div><div className="meta">$6,800 · 21 days overdue · email</div></div><span className="tag warn">REVIEW</span></ProductRow>
        <ProductRow><span className="av">SR</span><div><div>Payment verified for Summit Roofing</div><div className="meta">$2,750 · recovery loop stopped</div></div><span className="tag">PAID</span></ProductRow>
      </ProductSurface>
    );
  if (tab === "approvals")
    return (
      <ProductSurface>
        <ApprovalMini>
          <div className="approval-top"><span className="av">AM</span><div><b>Atlas Mechanical</b><div className="meta">first contact · email</div></div><span className="amount">$6,800 · 21d</span></div>
          <div className="message"><div className="to">to · accounts@atlasmechanical.com</div>Hi Atlas team, invoice INV-012 for $6,800 is now 21 days past due. Could you confirm when we should expect payment?</div>
          <div className="why">First contact held for your one-tap approval.</div>
          <div className="chips"><span className="chip">compliance passed</span><span className="chip">B2B</span><span className="chip">link resolves on send</span></div>
          <div className="actions"><button className="primary">Approve &amp; send</button><button>Edit</button><button>Hold</button></div>
        </ApprovalMini>
      </ProductSurface>
    );
  if (tab === "invoices")
    return (
      <ProductSurface>
        <InvoiceTable>
          <div className="head"><span>Invoice</span><span>Debtor</span><span>Amount</span><span className="hide-mobile">Overdue</span><span className="hide-mobile">Status</span></div>
          {[
            ["INV-012", "Atlas Mechanical", "$6,800", "21 days", "Awaiting you"],
            ["INV-024", "Cedar & Co", "$3,400", "45 days", "Escalated"],
            ["INV-008", "Summit Roofing", "$2,750", "Paid", "Recovered"],
          ].map((row, index) => (
            <div className="invoice-row" key={row[0]}>
              <span className="id">{row[0]}</span><span>{row[1]}</span><b>{row[2]}</b>
              <span className="hide-mobile">{row[3]}</span>
              <span className={`status hide-mobile ${index < 2 ? "held" : ""}`}>{row[4]}</span>
            </div>
          ))}
        </InvoiceTable>
      </ProductSurface>
    );
  return (
    <ProductSurface>
      <ActivityMini>
        <div className="filters"><span className="filter on">All</span><span className="filter">Strategy</span><span className="filter">Compliance</span><span className="filter">Safety only</span></div>
        {[
          ["#76d9aa", "Payment verified", "Summit Roofing · $2,750 · loop stopped", "2m"],
          ["#7466f2", "Firm email selected", "Atlas Mechanical · 21 days overdue", "11m"],
          ["#ec7272", "Draft escalated", "Cedar & Co · dispute detected", "18m"],
        ].map(([color, title, reason, time]) => (
          <div className="event" key={title}>
            <span className="dot" style={{ background: color }} />
            <div><div className="event-title">{title}</div><div className="reason">{reason}</div></div>
            <span className="time">{time}</span>
          </div>
        ))}
      </ActivityMini>
    </ProductSurface>
  );
}
