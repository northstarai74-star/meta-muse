import { beat, ensureRecurring, processDue, type JobHandler, type JobType } from "./jobs";
import { runAgent } from "./agent/runner";
import type { RunInput } from "./agent/trigger";
import { maintenance, scanStaleLeads } from "./agent/stale";
import { checkMetaToken, processMetaEntry, scheduledSync, type MetaEntry } from "./meta-events";

export const handlers: Partial<Record<JobType, JobHandler>> = {
  AGENT_RUN: (p) => runAgent(p as RunInput),
  META_EVENT: (p) => processMetaEntry(p.entry as MetaEntry),
  META_SYNC: () => scheduledSync(),
  STALE_SCAN: () => scanStaleLeads(),
  TOKEN_CHECK: () => checkMetaToken(),
  MAINTENANCE: () => maintenance(),
};

/** Runs due jobs now. Safe to call from anywhere (webhook `after()`, cron endpoint); overlapping calls are no-ops. */
export const kick = () => processDue(handlers).catch((err) => console.error("[worker] run failed", err));

const g = globalThis as unknown as { __workerTimer?: ReturnType<typeof setInterval> };

/** Starts the in-process worker (called once from instrumentation.ts). */
export function startWorker() {
  if (g.__workerTimer) return;
  console.log("[worker] started");
  let lastEnsure = 0;
  const tick = () => {
    beat().catch((e) => console.error("[worker] heartbeat failed", e));
    if (Date.now() - lastEnsure > 60_000) {
      lastEnsure = Date.now();
      ensureRecurring().catch((e) => console.error("[worker] ensureRecurring failed", e));
    }
    void kick();
  };
  g.__workerTimer = setInterval(tick, 5_000);
  g.__workerTimer.unref?.();
  tick();
}
