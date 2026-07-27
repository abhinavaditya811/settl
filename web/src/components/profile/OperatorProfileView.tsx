"use client";

// Operator identity / workspace card. Daily-work tabs stay above; this lives
// in the bottom rail with Settings and Help.

import { useSession } from "next-auth/react";
import styled from "styled-components";
import { Rise } from "@/components/overview/overviewChrome";

const DEMO = {
  name: "Maya Chen",
  email: "maya@northline.studio",
  workspace: "Northline Studio",
  role: "Owner",
  timezone: "America/New_York",
};

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 560px;
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

const Hero = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  .av {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-family: var(--font-display, inherit);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.03em;
    color: ${({ theme }) => theme.accentText};
    background: ${({ theme }) => theme.accent};
  }
  .name {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }
  .sub {
    margin: 3px 0 0;
    font-size: 13px;
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
  padding: 11px 0;
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
    text-align: right;
  }
`;

const Note = styled.p`
  margin: 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textMuted};
`;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function OperatorProfileView({ demo }: { demo?: boolean }) {
  const { data: session } = useSession();
  const name = demo ? DEMO.name : session?.user?.name ?? DEMO.name;
  const email = demo ? DEMO.email : session?.user?.email ?? DEMO.email;
  const workspace = demo ? DEMO.workspace : "Your workspace";

  return (
    <Rise>
      <Page>
        <Head>
          <h1>Profile</h1>
          <p>Who is operating this board, and which workspace it belongs to.</p>
        </Head>

        <Hero>
          <div className="av" aria-hidden>
            {initials(name)}
          </div>
          <div>
            <p className="name">{name}</p>
            <p className="sub">{email}</p>
          </div>
        </Hero>

        <Card>
          <Cap>Workspace</Cap>
          <Row>
            <span className="label">Business</span>
            <span className="value">{workspace}</span>
          </Row>
          <Row>
            <span className="label">Role</span>
            <span className="value">{DEMO.role}</span>
          </Row>
          <Row>
            <span className="label">Timezone</span>
            <span className="value">{DEMO.timezone}</span>
          </Row>
          <Row>
            <span className="label">Pilot mode</span>
            <span className="value">First send needs your OK</span>
          </Row>
        </Card>

        <Card>
          <Cap>About this profile</Cap>
          <Note>
            {demo
              ? "Demo identity for walkthroughs. Sign in to bind this rail to your Google account and real tenant."
              : "Account email and name come from your sign-in. Engine rules and connections live under Settings."}
          </Note>
        </Card>
      </Page>
    </Rise>
  );
}
