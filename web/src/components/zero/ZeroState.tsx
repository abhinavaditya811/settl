"use client";

// Post-login zero-state. Shown until the operator adds their own invoices (CSV
// upload / manual entry). Demo data lives at the separate, public /demo route -
// not a toggle here - so there is no path back to synthetic data from this
// screen. Guides the onboarding path (FR-15/FR-16).

import { useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import { useSession } from "next-auth/react";
import UploadCsvModal from "./UploadCsvModal";
import ManualEntryModal from "./ManualEntryModal";

const STEPS = [
  { label: "Connect Google", done: true },
  { label: "Add your invoices", done: false },
  { label: "Watch the agent recover them", done: false },
];

interface Props {
  // Called once real data has landed - the parent re-probes and, once it finds
  // at least one invoice, swaps out of the zero-state into the "mine" board.
  onOwnDataAdded: () => void;
}

export default function ZeroState({ onOwnDataAdded }: Props) {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const [modal, setModal] = useState<"csv" | "manual" | null>(null);

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
        <Option $primary>
          <h3>Add your invoices</h3>
          <p>
            Upload a CSV export from your invoicing tool, or add one by hand. The
            agent runs on your real overdue accounts.
          </p>
          <CtaRow>
            <Cta as="button" $primary onClick={() => setModal("csv")}>
              Upload CSV
            </Cta>
            <Cta as="button" onClick={() => setModal("manual")}>
              Enter manually
            </Cta>
          </CtaRow>
          <Soon>PDF / photo upload - coming soon</Soon>
        </Option>
      </Options>

      <DemoLink>
        Want to see it in action first?{" "}
        <Link href="/demo" target="_blank" rel="noopener noreferrer">
          View the demo &rarr;
        </Link>
      </DemoLink>

      {modal === "csv" && (
        <UploadCsvModal
          onClose={() => setModal(null)}
          onImported={() => {
            setModal(null);
            onOwnDataAdded();
          }}
        />
      )}
      {modal === "manual" && (
        <ManualEntryModal
          onClose={() => setModal(null)}
          onAdded={() => {
            setModal(null);
            onOwnDataAdded();
          }}
        />
      )}
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
  grid-template-columns: 1fr;
  gap: 16px;
`;

const DemoLink = styled.p`
  margin: 0;
  font-size: 13.5px;
  color: ${({ theme }) => theme.textMuted};
  text-align: center;
  a {
    font-weight: 700;
    text-decoration: underline;
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

const CtaRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
