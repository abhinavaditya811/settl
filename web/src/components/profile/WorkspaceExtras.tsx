"use client";

// Lightweight workspace extras for Settings: billing stub, team invite UI,
// notification prefs (local). Real Stripe billing / invite mail later.

import { useEffect, useState } from "react";
import styled from "styled-components";
import { useBoard } from "@/lib/BoardContext";

const KEY = "settl.notify.prefs.v1";

type Prefs = {
  morningBrief: boolean;
  firstSend: boolean;
  disputes: boolean;
  plans: boolean;
};

const DEFAULTS: Prefs = {
  morningBrief: true,
  firstSend: true,
  disputes: true,
  plans: true,
};

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
  }
  .hint {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    font-weight: 500;
    color: ${({ theme }) => theme.textMuted};
  }
`;

const Note = styled.p`
  margin: 0 0 12px;
  font-size: 13.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textMuted};
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
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const Invite = styled.form`
  display: flex;
  gap: 8px;
  margin-top: 12px;
  input {
    flex: 1;
    min-width: 0;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid ${({ theme }) => theme.border};
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    font: inherit;
    font-size: 13.5px;
  }
`;

const Toggle = styled.button<{ $on: boolean }>`
  min-width: 44px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.border};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  color: ${({ theme, $on }) => ($on ? theme.status.recovered.fg : theme.textMuted)};
  background: ${({ theme, $on }) =>
    $on ? theme.status.recovered.bg : theme.surfaceAlt};
`;

const Member = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  .av {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 700;
    color: ${({ theme }) => theme.accentText};
    background: ${({ theme }) => theme.accent};
  }
  .meta {
    flex: 1;
    min-width: 0;
  }
  .n {
    font-size: 13.5px;
    font-weight: 600;
  }
  .e {
    font-size: 12px;
    color: ${({ theme }) => theme.textMuted};
  }
  .role {
    font-size: 11px;
    font-weight: 700;
    color: ${({ theme }) => theme.textMuted};
  }
`;

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

export default function WorkspaceExtras({
  ownerName,
  ownerEmail,
}: {
  ownerName: string;
  ownerEmail: string;
}) {
  const { notify } = useBoard();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const setPref = (k: keyof Prefs, v: boolean) => {
    setPrefs((p) => {
      const next = { ...p, [k]: v };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <>
      <Card>
        <Cap>Billing &amp; plan</Cap>
        <Row>
          <span className="label">Plan</span>
          <span className="value">Pre-beta pilot</span>
        </Row>
        <Row>
          <span className="label">Price</span>
          <span className="value">$0 while piloting</span>
        </Row>
        <Row>
          <span className="label">Next charge</span>
          <span className="value">None yet</span>
        </Row>
        <Note style={{ marginTop: 12 }}>
          Paid plans unlock when we close the first pilots. No card on file.
        </Note>
        <Btn
          type="button"
          onClick={() =>
            notify({
              tone: "ok",
              text: "Billing goes live after pilots. You’re on the free pilot.",
            })
          }
        >
          View plans
        </Btn>
      </Card>

      <Card>
        <Cap>Team</Cap>
        <Member>
          <span className="av">
            {ownerName
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("")}
          </span>
          <div className="meta">
            <div className="n">{ownerName}</div>
            <div className="e">{ownerEmail}</div>
          </div>
          <span className="role">Owner</span>
        </Member>
        {pending.map((e) => (
          <Member key={e}>
            <span className="av">?</span>
            <div className="meta">
              <div className="n">Invite pending</div>
              <div className="e">{e}</div>
            </div>
            <span className="role">Operator</span>
          </Member>
        ))}
        <Invite
          onSubmit={(ev) => {
            ev.preventDefault();
            const next = email.trim().toLowerCase();
            if (!next || !next.includes("@")) {
              notify({ tone: "err", text: "Enter a valid email to invite." });
              return;
            }
            setPending((p) => (p.includes(next) ? p : [...p, next]));
            setEmail("");
            notify({
              tone: "ok",
              text: `Invite queued for ${next} (demo only, no email sent).`,
            });
          }}
        >
          <input
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Invite email"
          />
          <Btn type="submit">Invite</Btn>
        </Invite>
      </Card>

      <Card>
        <Cap>Notifications</Cap>
        <Note>Stored on this device for now. Wire to email/SMS after YC.</Note>
        {(
          [
            ["morningBrief", "Morning brief", "Daily cash + needs-you summary"],
            ["firstSend", "First-send waiting", "When a new debtor needs your OK"],
            ["disputes", "Disputes & quarantine", "Anything the gate escalates"],
            ["plans", "Payment plans", "Proposed or broken installments"],
          ] as const
        ).map(([k, label, hint]) => (
          <Row key={k}>
            <span className="label">
              {label}
              <span className="hint">{hint}</span>
            </span>
            <Toggle
              type="button"
              $on={prefs[k]}
              aria-pressed={prefs[k]}
              onClick={() => setPref(k, !prefs[k])}
            >
              {prefs[k] ? "On" : "Off"}
            </Toggle>
          </Row>
        ))}
      </Card>
    </>
  );
}
