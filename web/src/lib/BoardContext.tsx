"use client";

// One client-side store for the whole dashboard: it fetches the board, metrics,
// and activity feed together, and exposes refresh + approve actions plus a toast.
// Every view reads from here so actions taken in one place update everywhere.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type {
  ActivityEntry,
  ApproveResponse,
  BoardResponse,
  FlagRequest,
  FlagResponse,
  GuardrailView,
  Metrics,
} from "./types";
import {
  approveInvoice,
  type BoardMode,
  checkPayments,
  flagDecision,
  getActivity,
  getBoard,
  getGuardrails,
  getMetrics,
  refreshBoard,
} from "./api";

interface Toast {
  tone: "ok" | "err";
  text: string;
}

interface BoardCtx {
  board: BoardResponse | null;
  metrics: Metrics | null;
  activity: ActivityEntry[];
  guardrails: GuardrailView[];
  liveSend: boolean;
  loading: boolean;
  error: string | null;
  approvingId: string | null;
  flaggingId: string | null;
  refreshing: boolean;
  toast: Toast | null;
  refresh: (hard?: boolean) => Promise<void>;
  approve: (id: string, message?: string) => Promise<ApproveResponse | null>;
  flag: (id: string, body: FlagRequest) => Promise<FlagResponse | null>;
  notify: (t: Toast) => void;
}

const Ctx = createContext<BoardCtx | null>(null);

export function useBoard(): BoardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBoard must be used inside <BoardProvider>");
  return ctx;
}

export default function BoardProvider({
  children,
  mode,
}: {
  children: React.ReactNode;
  // Which board this provider fetches - the shared demo tenants, or the
  // signed-in operator's own tenant (Phase 1, FR-6). The provider is only ever
  // mounted once there's something to show (dashboard/page.tsx decides that),
  // so - unlike before - it always fetches on mount; no internal "wait for
  // opt-in" gate is needed here anymore.
  mode: BoardMode;
}) {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [guardrails, setGuardrails] = useState<GuardrailView[]>([]);
  const [liveSend, setLiveSend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const loadAll = useCallback(async () => {
    const [b, m, a, g] = await Promise.all([
      getBoard(mode),
      getMetrics(mode),
      getActivity(mode),
      getGuardrails(mode),
    ]);
    setBoard(b);
    setMetrics(m);
    setActivity(a);
    setGuardrails(g);
    setError(null);
  }, [mode]);

  const refresh = useCallback(
    async (hard = false) => {
      setRefreshing(true);
      try {
        if (hard) await refreshBoard(mode);
        await loadAll();
      } catch (e) {
        setError(String((e as Error).message ?? e));
      } finally {
        setRefreshing(false);
      }
    },
    [loadAll, mode],
  );

  useEffect(() => {
    setLoading(true);
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => {
        setLiveSend(Boolean(h.live_send));
        setStripeEnabled(h.payments === "stripe");
      })
      .catch(() => {
        setLiveSend(false);
        setStripeEnabled(false);
      });
    loadAll()
      .catch((e) => setError(String((e as Error).message ?? e)))
      .finally(() => setLoading(false));
  }, [mode, loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const approve = useCallback(
    async (id: string, message?: string) => {
      setApprovingId(id);
      try {
        const res = await approveInvoice(id, message);
        await loadAll();
        setToast(
          res.sent
            ? { tone: "ok", text: `${id} approved and sent.` }
            : { tone: "err", text: `${id} not sent - ${res.detail}` },
        );
        return res;
      } catch (e) {
        setToast({ tone: "err", text: `${id}: ${String((e as Error).message)}` });
        return null;
      } finally {
        setApprovingId(null);
      }
    },
    [loadAll],
  );

  const flag = useCallback(
    async (id: string, body: FlagRequest) => {
      setFlaggingId(id);
      try {
        const res = await flagDecision(id, body);
        await loadAll();
        setToast(
          res.applied
            ? { tone: "ok", text: `${id} flagged - guardrail ${res.rule_id} applied.` }
            : { tone: "err", text: `${id}: ${res.note}` },
        );
        return res;
      } catch (e) {
        setToast({ tone: "err", text: `${id}: ${String((e as Error).message)}` });
        return null;
      } finally {
        setFlaggingId(null);
      }
    },
    [loadAll],
  );

  // Auto-detect Stripe payments: poll the engine, which reconciles any paid invoices
  // on its own. Only runs while a board is mounted and Stripe is armed.
  useEffect(() => {
    if (!stripeEnabled) return;
    const tick = async () => {
      try {
        const res = await checkPayments();
        if (res.recovered.length) {
          await loadAll();
          setToast({ tone: "ok", text: `Payment detected - ${res.recovered.join(", ")} recovered.` });
        }
      } catch {
        /* polling errors are non-fatal */
      }
    };
    const t = setInterval(tick, 12000);
    return () => clearInterval(t);
  }, [stripeEnabled, loadAll]);

  const value: BoardCtx = {
    board,
    metrics,
    activity,
    guardrails,
    liveSend,
    loading,
    error,
    approvingId,
    flaggingId,
    refreshing,
    toast,
    refresh,
    approve,
    flag,
    notify: setToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
