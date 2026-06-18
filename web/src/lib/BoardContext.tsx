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
  Metrics,
} from "./types";
import {
  approveInvoice,
  getActivity,
  getBoard,
  getMetrics,
  refreshBoard,
} from "./api";
import { useDemo } from "./DemoContext";

interface Toast {
  tone: "ok" | "err";
  text: string;
}

interface BoardCtx {
  board: BoardResponse | null;
  metrics: Metrics | null;
  activity: ActivityEntry[];
  liveSend: boolean;
  loading: boolean;
  error: string | null;
  approvingId: string | null;
  refreshing: boolean;
  toast: Toast | null;
  refresh: (hard?: boolean) => Promise<void>;
  approve: (id: string, message?: string) => Promise<ApproveResponse | null>;
  notify: (t: Toast) => void;
}

const Ctx = createContext<BoardCtx | null>(null);

export function useBoard(): BoardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBoard must be used inside <BoardProvider>");
  return ctx;
}

export default function BoardProvider({ children }: { children: React.ReactNode }) {
  const { demoEnabled } = useDemo();
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [liveSend, setLiveSend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const loadAll = useCallback(async () => {
    const [b, m, a] = await Promise.all([getBoard(), getMetrics(), getActivity()]);
    setBoard(b);
    setMetrics(m);
    setActivity(a);
    setError(null);
  }, []);

  const refresh = useCallback(
    async (hard = false) => {
      setRefreshing(true);
      try {
        if (hard) await refreshBoard();
        await loadAll();
      } catch (e) {
        setError(String((e as Error).message ?? e));
      } finally {
        setRefreshing(false);
      }
    },
    [loadAll],
  );

  useEffect(() => {
    // No engine traffic until the operator opts into the demo board. A
    // brand-new user sees the zero-state with no data fetched.
    if (!demoEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setLiveSend(Boolean(h.live_send)))
      .catch(() => setLiveSend(false));
    loadAll()
      .catch((e) => setError(String((e as Error).message ?? e)))
      .finally(() => setLoading(false));
  }, [demoEnabled, loadAll]);

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

  const value: BoardCtx = {
    board,
    metrics,
    activity,
    liveSend,
    loading,
    error,
    approvingId,
    refreshing,
    toast,
    refresh,
    approve,
    notify: setToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
