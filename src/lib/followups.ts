import { db } from "./db";
import { STALE_DAYS } from "./constants";

const DAY = 86400_000;

/**
 * Task due dates are whole days stored as UTC midnight ("2026-10-06" -> 2026-10-06T00:00Z).
 * "Today" is the current UTC date, so a task is overdue once its date is before today.
 */
export const parseDay = (s: string) => new Date(`${s}T00:00:00Z`);
export const todayUtc = () => parseDay(new Date().toISOString().slice(0, 10));
export const dayLabel = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Open (not done) tasks due today or earlier. */
export const dueNowWhere = () => ({ done: false, dueAt: { lte: todayUtc() } });

/** Creates a follow-up task plus its timeline entry. Caller has already validated the lead and assignee. */
export async function addFollowup(opts: { leadId: string; title: string; dueAt: Date; assignedUserId: string | null; actorId: string }) {
  const [task] = await db.$transaction([
    db.task.create({ data: { leadId: opts.leadId, title: opts.title, dueAt: opts.dueAt, assignedUserId: opts.assignedUserId } }),
    db.activity.create({ data: { leadId: opts.leadId, userId: opts.actorId, type: "TASK", text: `Follow-up added: ${opts.title} (due ${dayLabel(opts.dueAt)})` } }),
  ]);
  return task;
}

export async function lastActivityByLead(leadIds: string[]) {
  if (leadIds.length === 0) return new Map<string, Date>();
  const rows = await db.activity.groupBy({ by: ["leadId"], where: { leadId: { in: leadIds } }, _max: { createdAt: true } });
  return new Map(rows.flatMap((r) => (r._max.createdAt ? [[r.leadId, r._max.createdAt] as const] : [])));
}

export function isStale(stage: string, createdAt: Date, lastActivity: Date | undefined, now = Date.now()) {
  if (stage === "WON" || stage === "LOST") return false;
  return now - (lastActivity ?? createdAt).getTime() > STALE_DAYS * DAY;
}

/** Open leads with no activity for STALE_DAYS+ days, most neglected first. */
export async function staleLeads(limit = 6) {
  const open = await db.lead.findMany({
    where: { stage: { notIn: ["WON", "LOST"] } },
    select: { id: true, title: true, stage: true, service: true, createdAt: true, contact: { select: { name: true } } },
  });
  const last = await lastActivityByLead(open.map((l) => l.id));
  const stale = open
    .map((l) => ({ ...l, lastAt: last.get(l.id) ?? l.createdAt }))
    .filter((l) => isStale(l.stage, l.createdAt, last.get(l.id)))
    .sort((a, b) => a.lastAt.getTime() - b.lastAt.getTime());
  return { count: stale.length, top: stale.slice(0, limit) };
}
