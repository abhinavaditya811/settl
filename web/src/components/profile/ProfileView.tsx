"use client";

// Settings (was Profile): identity, connections, autonomy, guardrails, plans, voice notes.

import { useSession } from "next-auth/react";
import styled from "styled-components";
import GmailConnect from "@/components/GmailConnect";
import PaymentPlanTemplates from "@/components/profile/PaymentPlanTemplates";
import GuardrailsPanel from "@/components/GuardrailsPanel";
import { useBoard } from "@/lib/BoardContext";
import AutonomyDial from "@/components/overview/AutonomyDial";
import ConnectionsStrip from "@/components/overview/ConnectionsStrip";
import { downloadEvidencePack } from "@/components/overview/evidenceDownload";
import { Rise } from "@/components/overview/overviewChrome";
import WorkspaceExtras from "@/components/profile/WorkspaceExtras";

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

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 0;
  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.border};
  }
  .label {
    font-size: 12.5px;
    font-weight: 600;
    color: ${({ theme }) => theme.textMuted};
  }
  .value {
    font-size: 14px;
    font-weight: 600;
  }
`;

const Btn = styled.button`
  font-size: 13px;
  font-weight: 700;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surfaceAlt};
  color: ${({ theme }) => theme.text};
  cursor: pointer;
`;

const Note = styled.p`
  margin: 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textMuted};
`;

export default function ProfileView({ demo }: { demo?: boolean }) {
  const { data: session } = useSession();
  const user = session?.user;
  const { health, activity, guardrails } = useBoard();
  const name = demo ? "Maya Chen" : user?.name ?? "—";
  const email = demo ? "maya@northline.studio" : user?.email ?? "—";

  return (
    <Rise>
      <Page>
        <Head>
          <div>
            <h1>Settings</h1>
            <p>
              How Settl is armed, how autonomous it may act, and the rules you taught
              it.
            </p>
          </div>
        </Head>

        <Card>
          <Cap>Account</Cap>
          <Row>
            <span className="label">Name</span>
            <span className="value">{name}</span>
          </Row>
          <Row>
            <span className="label">Email</span>
            <span className="value">{email}</span>
          </Row>
          {!demo && (
            <Row>
              <span className="label">Gmail (inbound replies)</span>
              <GmailConnect />
            </Row>
          )}
          {demo && (
            <Row>
              <span className="label">Gmail (inbound replies)</span>
              <span className="value">Connected · demo</span>
            </Row>
          )}
        </Card>

        <Card>
          <Cap>Connections</Cap>
          <ConnectionsStrip health={health} />
        </Card>

        <Card>
          <Cap>Autonomy dial</Cap>
          <AutonomyDial />
        </Card>

        <Card>
          <Cap>Your rules ({guardrails.length})</Cap>
          {guardrails.length === 0 ? (
            <Note>
              No guardrails yet. Open an invoice and use &ldquo;Set a rule&rdquo; to teach
              the engine how to handle cases like it.
            </Note>
          ) : (
            <GuardrailsPanel />
          )}
        </Card>

        <Card>
          <Cap>Voice ops</Cap>
          <Note>
            Voice scripts preview in Approvals when the channel is voice. Call
            windows, clone consent, and DNC live in the engine voice stack; wire
            full opt-in controls here once tenant audio config is exposed on the
            settings API.
          </Note>
        </Card>

        <Card>
          <Cap>Evidence</Cap>
          <Note style={{ marginBottom: 12 }}>
            Download a JSON pack of the current activity window for pilots and
            audits.
          </Note>
          <Btn
            type="button"
            onClick={() => downloadEvidencePack({ activity })}
          >
            Download board evidence
          </Btn>
        </Card>

        <WorkspaceExtras ownerName={name} ownerEmail={email} />

        <PaymentPlanTemplates />
      </Page>
    </Rise>
  );
}
