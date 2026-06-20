"use client";

// Login page (public). The single entry point into the app: "Connect Google"
// runs the OAuth flow and, on success, lands the user in /dashboard. If an
// already-authenticated user hits this page, bounce them straight to the
// dashboard. Middleware sends unauthenticated dashboard visitors here.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { signIn, useSession } from "next-auth/react";

const DASHBOARD = "/dashboard";

export default function SignInPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace(DASHBOARD);
  }, [status, router]);

  return (
    <Wrap>
      <Card>
        <Brand>
          <span className="mark">⬢</span>
          <span className="name">Settl</span>
        </Brand>
        <h1>Sign in</h1>
        <p>
          Settl chases your overdue invoices and sends recovery emails from your
          own Gmail account. Connect Google to get started.
        </p>
        <GoogleButton
          onClick={() => signIn("google", { callbackUrl: DASHBOARD })}
          disabled={status === "loading"}
        >
          <GoogleMark aria-hidden>G</GoogleMark>
          {status === "loading" ? "Checking…" : "Continue with Google"}
        </GoogleButton>
        <Fine>
          We request permission to send email on your behalf. We never read your
          inbox and never hold your funds.
        </Fine>
      </Card>
    </Wrap>
  );
}

const Wrap = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: ${({ theme }) => theme.bg};
`;

const Card = styled.div`
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 32px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  h1 {
    margin: 6px 0 0;
    font-size: 22px;
    letter-spacing: -0.01em;
  }
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  .mark {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-size: 16px;
    color: ${({ theme }) => theme.accentText};
    background: ${({ theme }) => theme.accent};
  }
  .name {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
`;

const GoogleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;
  padding: 11px 16px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surfaceAlt};
  color: ${({ theme }) => theme.text};
  font: inherit;
  font-size: 14.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.surface};
    border-color: ${({ theme }) => theme.textMuted};
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const GoogleMark = styled.span`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 13px;
  color: #fff;
  background: #4285f4;
`;

const Fine = styled.p`
  && {
    font-size: 12px;
    color: ${({ theme }) => theme.textMuted};
  }
`;
