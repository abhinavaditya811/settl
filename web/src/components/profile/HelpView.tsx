"use client";

// Bottom-rail Help: how the board maps to the engine, plus operator shortcuts.

import styled from "styled-components";
import { Rise } from "@/components/overview/overviewChrome";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 640px;
  padding-bottom: 48px;
`;

const Head = styled.header`
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
  }
`;

const Card = styled.section`
  padding: 18px 20px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
`;

const Cap = styled.h2`
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.textMuted};
`;

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  li {
    display: grid;
    grid-template-columns: 108px 1fr;
    gap: 12px;
    font-size: 13.5px;
    line-height: 1.45;
  }
  .k {
    font-weight: 700;
    color: ${({ theme }) => theme.text};
  }
  .v {
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Note = styled.p`
  margin: 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textMuted};
`;

export default function HelpView() {
  return (
    <Rise>
      <Page>
        <Head>
          <h1>Help</h1>
          <p>How this control room maps to the recovery engine.</p>
        </Head>

        <Card>
          <Cap>Where to go</Cap>
          <List>
            <li>
              <span className="k">Overview</span>
              <span className="v">Morning brief, cash, chase queue, forecast.</span>
            </li>
            <li>
              <span className="k">Inbox</span>
              <span className="v">Everything that needs you: first sends, disputes, quarantine, plans.</span>
            </li>
            <li>
              <span className="k">Approvals</span>
              <span className="v">Send workbench: draft, diff, one-tap approve.</span>
            </li>
            <li>
              <span className="k">Plans</span>
              <span className="v">Proposed, active, and broken installment schedules.</span>
            </li>
            <li>
              <span className="k">Settings</span>
              <span className="v">
                Autonomy, guardrails, billing stub, team invites, notification prefs.
              </span>
            </li>
          </List>
        </Card>

        <Card>
          <Cap>Approvals flow</Cap>
          <Note>
            Open Approvals, expand a case, read the draft and the Why, then Approve
            &amp; send or Set a rule. First contact to a new debtor always needs that
            one tap in pilot mode.
          </Note>
        </Card>

        <Card>
          <Cap>Hard rules (always on)</Cap>
          <Note>
            Settl never holds funds. Payment links stay on your processor. Consumer
            (non-B2B) debt escalates. Legal threats and fabricated links are blocked
            at the compliance gate before anything sends.
          </Note>
        </Card>
      </Page>
    </Rise>
  );
}
