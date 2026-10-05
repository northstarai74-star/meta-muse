"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Keeps a server-rendered page current: re-fetches it on an interval while the tab is visible,
 * when the tab regains focus or the network comes back, and on demand.
 */
export function LiveRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [online, setOnline] = React.useState(true);
  const [{ updatedAt, now }, setClock] = React.useState({ updatedAt: 0, now: 0 });
  const last = React.useRef(0);

  const refresh = React.useCallback(() => {
    if (!navigator.onLine) return;
    last.current = Date.now();
    startTransition(() => {
      router.refresh();
      setClock({ updatedAt: Date.now(), now: Date.now() });
    });
  }, [router]);

  React.useEffect(() => {
    last.current = Date.now();
    const started = setTimeout(() => {
      setClock({ updatedAt: Date.now(), now: Date.now() });
      setOnline(navigator.onLine);
    }, 0);

    const stale = () => Date.now() - last.current >= intervalMs;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && stale()) refresh();
      setClock((c) => ({ ...c, now: Date.now() }));
    }, 5_000);
    const onVisible = () => document.visibilityState === "visible" && stale() && refresh();
    const onOnline = () => { setOnline(true); refresh(); };
    const onOffline = () => setOnline(false);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearTimeout(started);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [intervalMs, refresh]);

  const secs = Math.max(0, Math.floor((now - updatedAt) / 1000));
  const label = !online ? "Offline" : pending ? "Updating…" : secs < 10 ? "Live" : secs < 60 ? `Updated ${secs}s ago` : `Updated ${Math.floor(secs / 60)}m ago`;

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={!online}
      title="Refresh now (auto-refreshes every 30s)"
      className="inline-flex h-9 items-center gap-2 rounded-xl border bg-surface px-3 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-60"
    >
      <span className={cn("h-2 w-2 rounded-full", online ? "bg-emerald-500" : "bg-rose-500", online && !pending && "animate-pulse")} />
      <span className="tabular-nums" aria-live="polite">{label}</span>
      <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
    </button>
  );
}
