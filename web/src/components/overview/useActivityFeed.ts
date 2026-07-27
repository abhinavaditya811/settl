"use client";

import { useMemo, useState } from "react";
import type { ActivityEntry, InvoiceCard } from "@/lib/types";
import { useBoard } from "@/lib/BoardContext";
import { friendlyAgent, headline, cleanReasoning, stepTier } from "@/lib/reasoning";
import { useTechnicalTrace } from "@/lib/useTechnicalTrace";
import { TONE } from "@/components/ActivityList";

export const SAFETY_TONES = new Set(["escalated", "quarantined"]);

function dayBucket(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (dt: Date) =>
    new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isToday(iso: string): boolean {
  return dayBucket(iso) === "Today";
}

export function entryKey(e: ActivityEntry, i: number): string {
  return `${e.invoice_id}-${e.timestamp}-${e.agent}-${e.decision}-${i}`;
}

export function useActivityFeed() {
  const { activity, board } = useBoard();
  const [technical, setTechnical] = useTechnicalTrace();
  const [agent, setAgent] = useState("all");
  const [safetyOnly, setSafetyOnly] = useState(false);
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, InvoiceCard>();
    for (const inv of board?.invoices ?? []) m.set(inv.invoice_id, inv);
    return m;
  }, [board]);

  const base = useMemo(
    () =>
      activity.filter(
        (e) => technical || stepTier(e.agent, e.decision) === "milestone",
      ),
    [activity, technical],
  );

  const agents = useMemo(
    () => Array.from(new Set(base.map((e) => e.agent))),
    [base],
  );

  const eventsToday = useMemo(
    () => activity.filter((e) => isToday(e.timestamp)).length,
    [activity],
  );

  const safetyFlags = useMemo(
    () =>
      activity.filter((e) => {
        const tone = TONE[e.decision] ?? "skipped";
        return SAFETY_TONES.has(tone);
      }).length,
    [activity],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return base.filter((e) => {
      const tone = TONE[e.decision] ?? "skipped";
      if (agent !== "all" && e.agent !== agent) return false;
      if (safetyOnly && !SAFETY_TONES.has(tone)) return false;
      if (!query) return true;
      const inv = byId.get(e.invoice_id);
      const hay = [
        e.invoice_id,
        e.agent,
        e.decision,
        e.reasoning,
        headline(e.agent, e.decision),
        cleanReasoning(e.reasoning),
        inv?.debtor_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [base, agent, safetyOnly, q, byId]);

  const groups = useMemo(() => {
    const map = new Map<string, { entry: ActivityEntry; index: number }[]>();
    rows.forEach((e, index) => {
      const key = dayBucket(e.timestamp);
      const bucket = map.get(key) ?? [];
      bucket.push({ entry: e, index });
      map.set(key, bucket);
    });
    return Array.from(map.entries());
  }, [rows]);

  return {
    activity,
    rows,
    groups,
    agents,
    byId,
    q,
    setQ,
    agent,
    setAgent,
    safetyOnly,
    setSafetyOnly,
    technical,
    setTechnical,
    openKey,
    setOpenKey,
    eventsToday,
    safetyFlags,
    friendlyAgent,
  };
}
