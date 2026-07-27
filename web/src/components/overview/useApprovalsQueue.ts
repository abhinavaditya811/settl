"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InvoiceCard, InvoiceDetail } from "@/lib/types";
import { useBoard } from "@/lib/BoardContext";
import { getDetail } from "@/lib/api";
import { formatAmount } from "@/lib/format";

export type ChannelFilter = "all" | "email" | "sms" | "voice";
export type SortMode = "risk" | "amount";

function riskScore(inv: InvoiceCard): number {
  return (Number(inv.amount_due) || 0) * Math.max(1, inv.days_overdue);
}

function amountScore(inv: InvoiceCard): number {
  return Number(inv.amount_due) || 0;
}

function typingInField(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

export function useApprovalsQueue() {
  const { board, metrics, approve, call, flag, notify, approvingId, flaggingId } = useBoard();
  const [details, setDetails] = useState<Record<string, InvoiceDetail>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("risk");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editTick, setEditTick] = useState(0);

  const allQueued = useMemo(() => {
    const list = [...(board?.invoices ?? []).filter((i) => i.can_approve)];
    list.sort((a, b) =>
      sortMode === "amount"
        ? amountScore(b) - amountScore(a)
        : riskScore(b) - riskScore(a),
    );
    return list;
  }, [board, sortMode]);

  const queued = useMemo(() => {
    if (channel === "all") return allQueued;
    return allQueued.filter((i) => (i.channel ?? "email") === channel);
  }, [allQueued, channel]);

  const queuedKey = queued.map((i) => i.invoice_id).join(",");
  const heldAmount = allQueued.reduce((s, i) => s + (Number(i.amount_due) || 0), 0);
  const ccy = metrics?.currency ?? allQueued[0]?.currency ?? "USD";
  const open = queued.find((i) => i.invoice_id === openId) ?? null;

  useEffect(() => {
    if (queued.length === 0) {
      setOpenId(null);
      return;
    }
    if (!openId || !queued.some((i) => i.invoice_id === openId)) {
      setOpenId(queued[0].invoice_id);
    }
  }, [queued, openId]);

  useEffect(() => {
    if (!queuedKey) return;
    let active = true;
    Promise.all(
      queuedKey.split(",").map((id) => getDetail(id).then((d) => [id, d] as const)),
    ).then((pairs) => {
      if (!active) return;
      setDetails((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      active = false;
    };
  }, [queuedKey]);

  const announceProgress = useCallback(
    (verb: string, id: string) => {
      const before = allQueued.length;
      const beforeHeld = heldAmount;
      const amt = Number(allQueued.find((i) => i.invoice_id === id)?.amount_due) || 0;
      const left = Math.max(0, before - 1);
      const still = Math.max(0, beforeHeld - amt);
      notify({
        tone: "ok",
        text:
          left === 0
            ? `${verb}. You're clear · nothing held.`
            : `${verb}. ${left} left · ${formatAmount(still, ccy)} still held.`,
      });
    },
    [allQueued, heldAmount, ccy, notify],
  );

  const handleApprove = useCallback(
    async (id: string, message?: string) => {
      const res = await approve(id, message);
      if (res?.sent) announceProgress("Sent", id);
    },
    [approve, announceProgress],
  );

  const handleCall = useCallback(
    async (id: string, message?: string) => {
      const res = await call(id, message);
      if (res?.sent) announceProgress("Called", id);
    },
    [call, announceProgress],
  );

  const handleSkip = useCallback(
    async (id: string) => {
      const res = await flag(id, { scope: "strategy", directive: "force_skip" });
      if (res?.applied) announceProgress("Skipped", id);
    },
    [flag, announceProgress],
  );

  const handleHold = useCallback(
    async (id: string) => {
      const res = await flag(id, { scope: "strategy", directive: "force_hold" });
      if (res?.applied) announceProgress("Held", id);
    },
    [flag, announceProgress],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingInField()) return;
      if (!open || queued.length === 0) return;
      const idx = queued.findIndex((i) => i.invoice_id === open.invoice_id);
      const itemBusy =
        approvingId === open.invoice_id || flaggingId === open.invoice_id || bulkBusy;

      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        if (!itemBusy && details[open.invoice_id]) void handleApprove(open.invoice_id);
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setEditTick((n) => n + 1);
        return;
      }
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = queued[Math.min(queued.length - 1, idx + 1)];
        if (next) setOpenId(next.invoice_id);
        return;
      }
      if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = queued[Math.max(0, idx - 1)];
        if (prev) setOpenId(prev.invoice_id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, queued, approvingId, flaggingId, bulkBusy, details, handleApprove]);

  const approveAll = async () => {
    if (
      !window.confirm(
        `Approve and send ${queued.length} first messages? The compliance gate still re-checks each one.`,
      )
    ) {
      return;
    }
    const n = queued.length;
    setBulkBusy(true);
    let sent = 0;
    for (const inv of queued) {
      // eslint-disable-next-line no-await-in-loop
      const res = await approve(inv.invoice_id);
      if (res?.sent) sent += 1;
    }
    setBulkBusy(false);
    if (sent > 0) {
      notify({
        tone: "ok",
        text:
          sent >= n
            ? `Approved ${sent}. You're clear · nothing held.`
            : `Approved ${sent} of ${n}.`,
      });
    }
  };

  const counts = {
    all: allQueued.length,
    email: allQueued.filter((i) => (i.channel ?? "email") === "email").length,
    sms: allQueued.filter((i) => i.channel === "sms").length,
    voice: allQueued.filter((i) => i.channel === "voice").length,
  };

  return {
    allQueued,
    queued,
    open,
    details,
    bulkBusy,
    channel,
    setChannel,
    sortMode,
    setSortMode,
    setOpenId,
    editTick,
    heldAmount,
    ccy,
    counts,
    approvingId,
    flaggingId,
    handleApprove,
    handleCall,
    handleSkip,
    handleHold,
    approveAll,
  };
}
