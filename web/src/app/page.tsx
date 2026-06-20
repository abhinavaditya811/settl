"use client";

// Public landing page (/). Branded hero with the value prop and a single CTA
// into the app. When already signed in, the CTA points straight at /dashboard.
// No engine/Shell here - this page is intentionally outside the authed layout.

import Link from "next/link";
import styled from "styled-components";
import { signOut, useSession } from "next-auth/react";

const FEATURES = [
  {
    title: "Decides, drafts, sends",
    body: "The agent picks the timing, tone, and channel for each overdue invoice and writes the message in your voice.",
  },
  {
    title: "A compliance gate on every send",
    body: "No legal threats, no consumer debt, B2B only. Anything risky is escalated to you - never sent.",
  },
  {
    title: "From your own mailbox",
    body: "Recovery emails go out from your Gmail, in your business's name. We never touch your funds.",
  },
];

export default function Landing() {
  const { status } = useSession();
  const authed = status === "authenticated";

  return (
    <Wrap>
      <Nav>
        <Brand>
          <span className="mark">⬢</span>
          <span className="name">Settl</span>
        </Brand>
        <NavRight>
          {authed ? (
            <>
              <Link href="/dashboard">
                <NavCta>Go to dashboard</NavCta>
              </Link>
              <NavGhost onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </NavGhost>
            </>
          ) : (
            <Link href="/signin">
              <NavCta>Sign in</NavCta>
            </Link>
          )}
        </NavRight>
      </Nav>

      <Hero>
        <h1>Get paid for the work you&rsquo;ve already done.</h1>
        <p>
          Settl is an autonomous recovery engine that chases your overdue
          invoices - deciding when and how to follow up, drafting in your
          voice, clearing a hard compliance gate, and reconciling the outcome.
        </p>
        <Link href={authed ? "/dashboard" : "/signin"}>
          <PrimaryCta>
            {authed ? "Open your dashboard" : "Connect Google to start"}
          </PrimaryCta>
        </Link>
        <Synthetic>Demo runs on synthetic invoices - no real money figures.</Synthetic>
      </Hero>

      <Features>
        {FEATURES.map((f) => (
          <Feature key={f.title}>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </Feature>
        ))}
      </Features>
    </Wrap>
  );
}

const Wrap = styled.main`
  min-height: 100vh;
  background: ${({ theme }) => theme.bg};
  color: ${({ theme }) => theme.text};
  padding: 0 24px 80px;
`;

const Nav = styled.nav`
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 0;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  .mark {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-size: 15px;
    color: ${({ theme }) => theme.accentText};
    background: ${({ theme }) => theme.accent};
  }
  .name {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
`;

const NavRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const NavGhost = styled.button`
  padding: 8px 14px;
  border-radius: 9px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: ${({ theme }) => theme.textMuted};
  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.surfaceAlt};
  }
`;

const NavCta = styled.span`
  display: inline-block;
  padding: 8px 16px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme.border};
  color: ${({ theme }) => theme.text};
  &:hover {
    background: ${({ theme }) => theme.surfaceAlt};
  }
`;

const Hero = styled.section`
  max-width: 800px;
  margin: 100px auto 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  h1 {
    margin: 0;
    font-size: 44px;
    line-height: 1.08;
    letter-spacing: -0.025em;
    @media (max-width: 600px) {
      font-size: 32px;
    }
  }
  p {
    margin: 0;
    max-width: 600px;
    font-size: 17px;
    line-height: 1.55;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const PrimaryCta = styled.span`
  display: inline-block;
  margin-top: 8px;
  padding: 13px 26px;
  border-radius: 11px;
  font-size: 15.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.accentText};
  background: ${({ theme }) => theme.accent};
  &:hover {
    opacity: 0.92;
  }
`;

const Synthetic = styled.span`
  font-size: 12.5px;
  color: ${({ theme }) => theme.textMuted};
`;

const Features = styled.section`
  max-width: 1000px;
  margin: 80px auto 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const Feature = styled.div`
  padding: 22px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  h3 {
    margin: 0 0 8px;
    font-size: 15.5px;
    font-weight: 700;
  }
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: ${({ theme }) => theme.textMuted};
  }
`;
