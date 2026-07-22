"use client";

// Profile-tab settings: the vendor's own pre-approved payment-plan installment
// options (SCHEMA.md §8). What a debtor sees offered is always one of these -
// the AI never invents terms. Self-contained: loads on mount, edits locally,
// saves the full list on "Save" (the API replaces, never patches).

import { useEffect, useState } from "react";
import styled from "styled-components";
import type { PaymentPlanTemplateInput } from "@/lib/types";
import {
  getPaymentPlanAutonomy,
  getPaymentPlanTemplates,
  savePaymentPlanTemplates,
  setPaymentPlanAutonomy,
} from "@/lib/api";

const Card = styled.div`
  max-width: 480px;
  margin-top: 22px;
  padding: 22px 24px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
`;

const Head = styled.div`
  margin-bottom: 4px;
  .t { font-size: 15px; font-weight: 700; }
  .s { font-size: 12.5px; color: ${({ theme }) => theme.textMuted}; margin-top: 2px; }
`;

const AutonomyRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid ${({ theme }) => theme.border};
  .t { font-size: 13px; font-weight: 700; }
  .s { font-size: 12px; color: ${({ theme }) => theme.textMuted}; margin-top: 2px; max-width: 340px; }
`;

const Switch = styled.button<{ $on: boolean }>`
  flex-shrink: 0;
  width: 40px;
  height: 23px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  padding: 2px;
  background: ${({ theme, $on }) => ($on ? theme.accent : theme.border)};
  transition: background 0.15s ease;
  &:disabled { opacity: 0.6; cursor: progress; }
  &::after {
    content: "";
    display: block;
    width: 19px;
    height: 19px;
    border-radius: 50%;
    background: #fff;
    transform: translateX(${({ $on }) => ($on ? "17px" : "0")});
    transition: transform 0.15s ease;
  }
`;

const List = styled.ul`
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Item = styled.li`
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr auto;
  gap: 8px;
  align-items: center;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  label {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: ${({ theme }) => theme.textMuted};
  }
  input {
    font: inherit;
    font-size: 13px;
    padding: 7px 9px;
    border-radius: 8px;
    border: 1px solid ${({ theme }) => theme.border};
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    width: 100%;
  }
`;

const Remove = styled.button`
  align-self: flex-end;
  width: 30px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.border};
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.textMuted};
  cursor: pointer;
  &:hover { color: ${({ theme }) => theme.text}; }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  padding: 9px 14px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid ${({ theme, $primary }) => ($primary ? theme.accent : theme.border)};
  color: ${({ theme, $primary }) => ($primary ? theme.accentText : theme.text)};
  background: ${({ theme, $primary }) => ($primary ? theme.accent : theme.surface)};
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: progress; }
`;

const Status = styled.p<{ $err?: boolean }>`
  margin: 10px 0 0;
  font-size: 12px;
  color: ${({ theme, $err }) => ($err ? theme.status.escalated.fg : theme.status.sent.fg)};
`;

const EMPTY: PaymentPlanTemplateInput = { installments: 3, period_days: 30, label: "" };

export default function PaymentPlanTemplates() {
  const [templates, setTemplates] = useState<PaymentPlanTemplateInput[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string; err?: boolean } | null>(null);
  const [autonomy, setAutonomy] = useState<boolean | null>(null);
  const [autonomyBusy, setAutonomyBusy] = useState(false);

  useEffect(() => {
    getPaymentPlanTemplates()
      .then(setTemplates)
      .catch((e) => setStatus({ text: String((e as Error).message ?? e), err: true }));
    getPaymentPlanAutonomy()
      .then((a) => setAutonomy(a.enabled))
      .catch(() => setAutonomy(false));
  }, []);

  const toggleAutonomy = async () => {
    if (autonomy === null) return;
    const next = !autonomy;
    setAutonomyBusy(true);
    try {
      const res = await setPaymentPlanAutonomy(next);
      setAutonomy(res.enabled);
    } catch (e) {
      setStatus({ text: String((e as Error).message ?? e), err: true });
    } finally {
      setAutonomyBusy(false);
    }
  };

  const update = (i: number, patch: Partial<PaymentPlanTemplateInput>) => {
    setTemplates((cur) => (cur ?? []).map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const remove = (i: number) => {
    setTemplates((cur) => (cur ?? []).filter((_, idx) => idx !== i));
  };
  const add = () => {
    setTemplates((cur) => [...(cur ?? []), { ...EMPTY }]);
  };

  const save = async () => {
    if (!templates) return;
    setSaving(true);
    setStatus(null);
    try {
      const saved = await savePaymentPlanTemplates(templates);
      setTemplates(saved);
      setStatus({ text: "Saved." });
    } catch (e) {
      setStatus({ text: String((e as Error).message ?? e), err: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Head>
        <div className="t">Payment-plan templates</div>
        <div className="s">
          Pre-approved installment options you can offer a debtor who asks to pay over time. Settl
          never invents terms - it only offers one of these, and nothing is confirmed to the debtor
          without your approval.
        </div>
      </Head>

      {templates === null && !status ? (
        <div style={{ fontSize: 13, marginTop: 14 }}>Loading…</div>
      ) : (
        <>
          <List>
            {(templates ?? []).map((t, i) => (
              <Item key={i}>
                <Field>
                  <label>Installments</label>
                  <input
                    type="number" min={1} max={24} value={t.installments}
                    onChange={(e) => update(i, { installments: Number(e.target.value) })}
                  />
                </Field>
                <Field>
                  <label>Days apart</label>
                  <input
                    type="number" min={1} max={365} value={t.period_days}
                    onChange={(e) => update(i, { period_days: Number(e.target.value) })}
                  />
                </Field>
                <Field>
                  <label>Label</label>
                  <input
                    type="text" placeholder="3 installments over 90 days" value={t.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                  />
                </Field>
                <Remove type="button" onClick={() => remove(i)} aria-label="Remove template">✕</Remove>
              </Item>
            ))}
          </List>

          <Actions>
            <Btn type="button" onClick={add}>+ Add a template</Btn>
            <Btn type="button" $primary disabled={saving || !templates} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Btn>
          </Actions>
          {(templates ?? []).length === 0 && (
            <Status>No templates yet - the Offer button won&rsquo;t work until you add at least one.</Status>
          )}
          {status && <Status $err={status.err}>{status.text}</Status>}

          <AutonomyRow>
            <div>
              <div className="t">Confirm the plan to the debtor as soon as I approve it</div>
              <div className="s">
                With this off, approving a plan records your decision but doesn&rsquo;t yet notify
                the debtor. A plan is never offered or changed without your explicit approve/reject
                either way.
              </div>
            </div>
            <Switch
              type="button"
              role="switch"
              aria-checked={autonomy ?? false}
              aria-label="Confirm approved payment plans automatically"
              $on={autonomy ?? false}
              disabled={autonomy === null || autonomyBusy}
              onClick={toggleAutonomy}
            />
          </AutonomyRow>
        </>
      )}
    </Card>
  );
}
