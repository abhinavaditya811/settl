"use client";

// Profile tab (signed-in operator only - BoardShell excludes it from the public
// demo). Shows the account identity from the NextAuth session and the Gmail
// "Connect" control (moved here from the sidebar footer so it has room for a
// real label instead of a cramped icon-only button).

import { useSession } from "next-auth/react";
import styled from "styled-components";
import GmailConnect from "@/components/GmailConnect";

const Title = styled.h1`
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
`;
const Sub = styled.p`
  font-size: 13.5px;
  color: ${({ theme }) => theme.textMuted};
  margin: 0 0 22px;
`;
const Card = styled.div`
  max-width: 480px;
  padding: 22px 24px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
`;
const Head = styled.div`
  padding-bottom: 20px;
  margin-bottom: 4px;
  border-bottom: 1px solid ${({ theme }) => theme.border};
  .name {
    font-size: 16px;
    font-weight: 700;
  }
  .email {
    font-size: 13px;
    color: ${({ theme }) => theme.textMuted};
    margin-top: 2px;
  }
`;
const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 0;
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

export default function ProfileView() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <>
      <Title>Profile</Title>
      <Sub>Your account and connected integrations.</Sub>
      <Card>
        <Head>
          <div className="name">{user?.name ?? "—"}</div>
          <div className="email">{user?.email ?? "—"}</div>
        </Head>
        <Row>
          <span className="label">Name</span>
          <span className="value">{user?.name ?? "—"}</span>
        </Row>
        <Row>
          <span className="label">Email</span>
          <span className="value">{user?.email ?? "—"}</span>
        </Row>
        <Row>
          <span className="label">Gmail (inbound replies)</span>
          <GmailConnect />
        </Row>
      </Card>
    </>
  );
}
