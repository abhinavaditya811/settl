"use client";

// Post-login zero-state. Shown across the dashboard until the operator either
// adds their own invoices (CSV upload - a later branch) or opts into the
// synthetic demo board. Guides the onboarding path (FR-15/FR-16).

import styled from "styled-components";
import { useSession } from "next-auth/react";
import { useDemo } from "@/lib/DemoContext";

const STEPS = [
  { label: "Connect Google", done: true },
  { label: "Add your invoices", done: false },
  { label: "Watch the agent recover them", done: false },
];

export default function ZeroState() {
  const { data: session } = useSession();
  const { enableDemo } = useDemo();
  const email = session?.user?.email;

  return (
    <Wrap>
      <Intro>
        <h1>You&rsquo;re connected{email ? `, ${email}` : ""}.</h1>
        <p>
          Settl is ready. Add your overdue invoices and the agent will decide
          when and how to follow up, draft each message in your voice, and clear
          every send through the compliance gate before it goes out.
        </p>
      </Intro>

      <Steps>
        {STEPS.map((s, i) => (
          <Step key={s.label} $done={s.done}>
            <span className="dot">{s.done ? "✓" : i + 1}</span>
            {s.label}
          </Step>
        ))}
      </Steps>

      <Options>
        <Option>
          <h3>Add your invoices</h3>
          <p>
            Upload a CSV export from your invoicing tool. The agent runs on your
            real overdue accounts.
          </p>
          <Cta as="button" disabled>
            Upload CSV
          </Cta>
          <Soon>Coming soon</Soon>
        </Option>

        <Option $primary>
          <h3>Explore the demo</h3>
          <p>
            See the full engine work end-to-end on a set of synthetic invoices,
            including drafts held for your approval.
          </p>
          <Cta as="button" $primary onClick={enableDemo}>
            Show me the demo
          </Cta>
          <Soon>Synthetic data - no real money figures</Soon>
        </Option>
      </Options>
    </Wrap>
  );
}

const Wrap = styled.div`
  max-width: 720px;
  margin: 24px auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
`;

const Intro = styled.div`
  h1 {
    margin: 0 0 8px;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Steps = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Step = styled.li<{ $done: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14.5px;
  font-weight: 600;
  color: ${({ theme, $done }) => ($done ? theme.text : theme.textMuted)};
  .dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 700;
    color: ${({ theme, $done }) => ($done ? theme.accentText : theme.textMuted)};
    background: ${({ theme, $done }) => ($done ? theme.accent : theme.surfaceAlt)};
    border: 1px solid ${({ theme }) => theme.border};
  }
`;

const Options = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Option = styled.div<{ $primary?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 22px;
  border-radius: 14px;
  background: ${({ theme }) => theme.surface};
  border: 1px solid
    ${({ theme, $primary }) => ($primary ? theme.accent : theme.border)};
  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }
  p {
    margin: 0;
    flex: 1;
    font-size: 13.5px;
    line-height: 1.55;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Cta = styled.span<{ $primary?: boolean }>`
  display: inline-block;
  margin-top: 4px;
  padding: 10px 16px;
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  border: 1px solid
    ${({ theme, $primary }) => ($primary ? theme.accent : theme.border)};
  color: ${({ theme, $primary }) =>
    $primary ? theme.accentText : theme.text};
  background: ${({ theme, $primary }) =>
    $primary ? theme.accent : theme.surfaceAlt};
  &:hover:not(:disabled) {
    opacity: 0.92;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Soon = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.textMuted};
`;
