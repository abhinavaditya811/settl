"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InvoiceCard, InvoiceDetail, TerminalState, TraceEntry } from "@/lib/types";
import { useBoard } from "@/lib/BoardContext";
import { getDetail, getTrace } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { takeFocusInvoice } from "./focusInvoice";
import { isOpenBook, needsYou } from "./invoiceNext";

export type AttentionFilter =
  | "needs_you"
  | "in_flight"
  | "recovered"
  | "held"
  | "skipped"
  | "quarantined"
  | "all";

export type SortMode = "risk" | "amount" | "overdue";

function typingInField(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

function riskScore(inv: InvoiceCard): number {
  const base = (Number(inv.amount_due) || 0) * Math.max(1, inv.days_overdue);
  return needsYou(inv) ? base * 1.5 : base;
}

function matchesAttention(inv: InvoiceCard, filter: AttentionFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "needs_you":
      return needsYou(inv);
    case "in_flight":
      return inv.terminal_state === "sent" || inv.terminal_state === "held";
    case "recovered":
      return inv.terminal_state === "recovered";
    case "held":
      return inv.terminal_state === "held";
    case "skipped":
      return inv.terminal_state === "skipped";
    case "quarantined":
      return inv.terminal_state === "quarantined";
    default:
      return true;
  }
}

export function useInvoicesBoard() {
  const { board, metrics, approve, flag, notify, approvingId, flaggingId, refresh } =
    useBoard();
  const invoices = board?.invoices ?? [];

  const needsYouCount = useMemo(
    () => invoices.filter((i) => needsYou(i)).length,
    [invoices],
  );

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<AttentionFilter>("all");
  const [didInitFilter, setDidInitFilter] = useState(false);
  const [stateFilter, setStateFilter] = useState<TerminalState | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("risk");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [trace, setTrace] = useState<TraceEntry[]>([]);

  useEffect(() => {
    if (didInitFilter || invoices.length === 0) return;
    setFilter(needsYouCount > 0 ? "needs_you" : "all");
    setDidInitFilter(true);
  }, [didInitFilter, invoices.length, needsYouCount]);

  // Activity (and Overview) can hand off a case via sessionStorage + #invoices.
  useEffect(() => {
    if (invoices.length === 0) return;
    const id = takeFocusInvoice();
    if (!id) return;
    if (!invoices.some((i) => i.invoice_id === id)) return;
    setFilter("all");
    setStateFilter("all");
    setFocusId(id);
    setOpenId(id);
  }, [invoices]);

  const openBookAmount = useMemo(
    () =>
      invoices
        .filter((i) => isOpenBook(i.terminal_state))
        .reduce((s, i) => s + (Number(i.amount_due) || 0), 0),
    [invoices],
  );

  const inFlightCount = useMemo(
    () =>
      invoices.filter(
        (i) => i.terminal_state === "sent" || i.terminal_state === "held",
      ).length,
    [invoices],
  );

  const recoveredCount = useMemo(
    () => invoices.filter((i) => i.terminal_state === "recovered").length,
    [invoices],
  );

  const stateCounts = useMemo(() => {
    const c: Partial<Record<TerminalState, number>> = {};
    invoices.forEach((i) => {
      c[i.terminal_state] = (c[i.terminal_state] ?? 0) + 1;
    });
    return c;
  }, [invoices]);

  const attentionCounts = useMemo(
    () => ({
      needs_you: needsYouCount,
      in_flight: inFlightCount,
      recovered: recoveredCount,
      held: stateCounts.held ?? 0,
      skipped: stateCounts.skipped ?? 0,
      quarantined: stateCounts.quarantined ?? 0,
      all: invoices.length,
    }),
    [needsYouCount, inFlightCount, recoveredCount, stateCounts, invoices.length],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = invoices.filter((i) => {
      if (!matchesAttention(i, filter)) return false;
      if (stateFilter !== "all" && i.terminal_state !== stateFilter) return false;
      if (!query) return true;
      return (
        i.invoice_id.toLowerCase().includes(query) ||
        i.debtor_name.toLowerCase().includes(query) ||
        (i.detail ?? "").toLowerCase().includes(query)
      );
    });
    list.sort((a, b) => {
      if (sortMode === "amount") {
        return (Number(b.amount_due) || 0) - (Number(a.amount_due) || 0);
      }
      if (sortMode === "overdue") {
        return b.days_overdue - a.days_overdue;
      }
      return riskScore(b) - riskScore(a);
    });
    return list;
  }, [invoices, q, filter, stateFilter, sortMode]);

  const open = rows.find((i) => i.invoice_id === openId) ?? null;
  const focused =
    rows.find((i) => i.invoice_id === focusId) ?? rows[0] ?? null;

  useEffect(() => {
    if (rows.length === 0) {
      setFocusId(null);
      return;
    }
    if (!focusId || !rows.some((i) => i.invoice_id === focusId)) {
      setFocusId(rows[0].invoice_id);
    }
  }, [rows, focusId]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      setTrace([]);
      return;
    }
    if (!rows.some((i) => i.invoice_id === openId)) {
      setOpenId(null);
      return;
    }
    let active = true;
    setDetail(null);
    setTrace([]);
    Promise.all([getDetail(openId), getTrace(openId)]).then(([d, t]) => {
      if (!active) return;
      setDetail(d);
      setTrace(t);
    });
    return () => {
      active = false;
    };
  }, [openId, rows]);

  const ccy = metrics?.currency ?? invoices[0]?.currency ?? "USD";

  const handleApprove = useCallback(
    async (id: string) => {
      const wasNeedsYou = invoices.some((i) => i.invoice_id === id && needsYou(i));
      const amt = Number(invoices.find((i) => i.invoice_id === id)?.amount_due) || 0;
      const res = await approve(id);
      if (res?.sent) {
        const left = Math.max(0, needsYouCount - (wasNeedsYou ? 1 : 0));
        const stillOpen = Math.max(0, openBookAmount - amt);
        notify({
          tone: "ok",
          text:
            left === 0
              ? "Sent. You're clear · nothing needs you."
              : `Sent. ${left} still need you · ${formatAmount(stillOpen, ccy)} open.`,
        });
        setOpenId(null);
      }
    },
    [approve, invoices, needsYouCount, openBookAmount, ccy, notify],
  );

  const handlePause = useCallback(
    async (id: string) => {
      const res = await flag(id, { scope: "strategy", directive: "force_hold" });
      if (res?.applied) {
        notify({ tone: "ok", text: "Paused. Chase will resume on schedule limits." });
      }
    },
    [flag, notify],
  );

  const handleSoften = useCallback(
    async (id: string) => {
      const res = await flag(id, { scope: "strategy", directive: "soften_tone" });
      if (res?.applied) {
        notify({ tone: "ok", text: "Tone softened for the next touch." });
      }
    },
    [flag, notify],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingInField()) return;
      if (e.key === "Escape") {
        if (openId) {
          e.preventDefault();
          setOpenId(null);
        }
        return;
      }
      if (rows.length === 0) return;
      const idx = Math.max(
        0,
        rows.findIndex((i) => i.invoice_id === (openId ?? focusId)),
      );

      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = rows[Math.min(rows.length - 1, idx + 1)];
        if (!next) return;
        setFocusId(next.invoice_id);
        if (openId) setOpenId(next.invoice_id);
        return;
      }
      if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = rows[Math.max(0, idx - 1)];
        if (!prev) return;
        setFocusId(prev.invoice_id);
        if (openId) setOpenId(prev.invoice_id);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const target = openId ? open : focused;
        if (target) {
          setFocusId(target.invoice_id);
          setOpenId(target.invoice_id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, focusId, openId, open, focused]);

  const filterLabel = (f: AttentionFilter): string => {
    switch (f) {
      case "needs_you":
        return "Needs you";
      case "in_flight":
        return "In flight";
      case "recovered":
        return "Recovered";
      case "held":
        return "Held";
      case "skipped":
        return "Skipped";
      case "quarantined":
        return "Quarantined";
      default:
        return "All";
    }
  };

  return {
    invoices,
    rows,
    q,
    setQ,
    filter,
    setFilter,
    stateFilter,
    setStateFilter,
    sortMode,
    setSortMode,
    focusId,
    setFocusId,
    openId,
    setOpenId,
    open,
    detail,
    trace,
    openBookAmount,
    needsYouCount,
    inFlightCount,
    recoveredCount,
    attentionCounts,
    stateCounts,
    ccy,
    approvingId,
    flaggingId,
    handleApprove,
    handlePause,
    handleSoften,
    refresh,
    filterLabel,
  };
}
