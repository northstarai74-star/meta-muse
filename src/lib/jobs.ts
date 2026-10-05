import type { Job } from "@prisma/client";
import { db } from "./db";

/**
 * Minimal durable job queue on top of the database.
 * - enqueue() writes a row; the worker (or /api/jobs/tick) claims rows atomically and runs a handler.
 * - Failures are retried with exponential backoff until maxAttempts, then parked as FAILED (retryable from the UI).
 * - Recurring jobs re-enqueue themselves after every run.
 * This module has no handler imports so any code (e.g. ingest) can enqueue without import cycles.
 */

export type JobType = "AGENT_RUN" | "META_EVENT" | "META_SYNC" | "STALE_SCAN" | "TOKEN_CHECK" | "MAINTENANCE";
export type JobHandler = (payload: Record<string, unknown>, job: Job) => Promise<unknown>;

/** Jobs that keep themselves scheduled. */
export const RECURRING: { type: JobType; everyMs: number }[] = [
  { type: "STALE_SCAN", everyMs: 15 * 60_000 },
  { type: "META_SYNC", everyMs: 10 * 60_000 },
  { type: "TOKEN_CHECK", everyMs: 24 * 3600_000 },
  { type: "MAINTENANCE", everyMs: 6 * 3600_000 },
];
const recurringEvery = new Map(RECURRING.map((r) => [r.type, r.everyMs]));

const LOCK_TIMEOUT_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 30 * 60_000;

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown> = {},
  opts: { runAt?: Date; dedupeKey?: string; maxAttempts?: number } = {},
) {
  if (opts.dedupeKey) {
    // Coalesce: a job that has not started yet will already see whatever triggered this call.
    const existing = await db.job.findFirst({ where: { dedupeKey: opts.dedupeKey, status: "PENDING" } });
    if (existing) return existing;
  }
  return db.job.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      dedupeKey: opts.dedupeKey,
      runAt: opts.runAt ?? new Date(),
      maxAttempts: opts.maxAttempts ?? (recurringEvery.has(type) ? 1 : 5),
    },
  });
}

/** Makes sure each recurring job has a pending or running instance. Cheap and idempotent. */
export async function ensureRecurring() {
  for (const r of RECURRING) {
    const active = await db.job.count({ where: { type: r.type, status: { in: ["PENDING", "RUNNING"] } } });
    if (!active) await enqueue(r.type, {}, { dedupeKey: `recurring:${r.type}`, runAt: new Date(Date.now() + 5_000) });
  }
}

async function recoverStale() {
  const cutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const stuck = await db.job.findMany({ where: { status: "RUNNING", lockedAt: { lt: cutoff } } });
  for (const j of stuck) {
    const dead = j.attempts >= j.maxAttempts;
    await db.job.updateMany({
      where: { id: j.id, status: "RUNNING" },
      data: dead ? { status: "FAILED", finishedAt: new Date(), lastError: "Worker stopped mid-run (lock timed out)" } : { status: "PENDING", lockedAt: null },
    });
    if (dead) await rescheduleRecurring(j.type as JobType);
  }
}

async function claim(): Promise<Job | null> {
  for (let i = 0; i < 3; i++) {
    const next = await db.job.findFirst({ where: { status: "PENDING", runAt: { lte: new Date() } }, orderBy: { runAt: "asc" } });
    if (!next) return null;
    const { count } = await db.job.updateMany({
      where: { id: next.id, status: "PENDING" },
      data: { status: "RUNNING", lockedAt: new Date(), attempts: { increment: 1 } },
    });
    if (count === 1) return { ...next, status: "RUNNING", attempts: next.attempts + 1 };
  }
  return null;
}

async function rescheduleRecurring(type: JobType) {
  const every = recurringEvery.get(type);
  if (every) await enqueue(type, {}, { dedupeKey: `recurring:${type}`, runAt: new Date(Date.now() + every) });
}

async function execute(job: Job, handlers: Partial<Record<JobType, JobHandler>>) {
  const handler = handlers[job.type as JobType];
  try {
    if (!handler) throw new Error(`No handler for job type ${job.type}`);
    await handler(JSON.parse(job.payload || "{}"), job);
    await db.job.update({ where: { id: job.id }, data: { status: "DONE", finishedAt: new Date(), lastError: null } });
    await rescheduleRecurring(job.type as JobType);
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    console.error(`[jobs] ${job.type} ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}):`, message);
    if (job.attempts >= job.maxAttempts) {
      await db.job.update({ where: { id: job.id }, data: { status: "FAILED", finishedAt: new Date(), lastError: message } });
      await rescheduleRecurring(job.type as JobType);
    } else {
      const backoff = Math.min(MAX_BACKOFF_MS, 30_000 * 2 ** (job.attempts - 1));
      await db.job.update({ where: { id: job.id }, data: { status: "PENDING", lockedAt: null, lastError: message, runAt: new Date(Date.now() + backoff) } });
    }
  }
}

const g = globalThis as unknown as { __jobsBusy?: boolean };

/** Runs due jobs until the queue is empty, `limit` jobs have run or `budgetMs` has elapsed. One loop per process at a time. */
export async function processDue(handlers: Partial<Record<JobType, JobHandler>>, opts: { limit?: number; budgetMs?: number } = {}) {
  if (g.__jobsBusy) return { ran: 0, busy: true };
  g.__jobsBusy = true;
  const { limit = 20, budgetMs = 50_000 } = opts;
  const started = Date.now();
  let ran = 0;
  try {
    await recoverStale();
    while (ran < limit && Date.now() - started < budgetMs) {
      const job = await claim();
      if (!job) break;
      await execute(job, handlers);
      ran++;
    }
  } finally {
    g.__jobsBusy = false;
  }
  return { ran, busy: false };
}

export async function retryJob(id: string) {
  const { count } = await db.job.updateMany({
    where: { id, status: "FAILED" },
    data: { status: "PENDING", attempts: 0, lastError: null, lockedAt: null, finishedAt: null, runAt: new Date() },
  });
  return count === 1;
}

export async function queueStats() {
  const [grouped, failed, hb] = await Promise.all([
    db.job.groupBy({ by: ["status"], _count: true }),
    db.job.findMany({ where: { status: "FAILED" }, orderBy: { finishedAt: "desc" }, take: 20 }),
    db.setting.findUnique({ where: { key: "worker.heartbeat" } }),
  ]);
  const count = (s: string) => grouped.find((g) => g.status === s)?._count ?? 0;
  const heartbeat = hb ? Number(hb.value) : 0;
  return {
    pending: count("PENDING"),
    running: count("RUNNING"),
    failed: count("FAILED"),
    done: count("DONE"),
    failedJobs: failed,
    heartbeatAt: heartbeat ? new Date(heartbeat) : null,
    // the worker ticks every 5s; allow generous slack for slow handlers
    workerAlive: heartbeat > 0 && Date.now() - heartbeat < 90_000,
  };
}

export async function beat() {
  const now = String(Date.now());
  await db.setting.upsert({ where: { key: "worker.heartbeat" }, create: { key: "worker.heartbeat", value: now }, update: { value: now } });
}
