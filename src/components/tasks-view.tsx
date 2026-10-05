"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Empty, ServiceBadge } from "./ui";
import { cn } from "@/lib/utils";

export type TaskRow = {
  id: string; title: string; dueAt: string; done: boolean; assignedUserId: string | null; assignee: string | null;
  lead: { id: string; name: string; service: string };
};

const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function TasksView({ today, meId, open, done }: { today: string; meId: string; open: TaskRow[]; done: TaskRow[] }) {
  const router = useRouter();
  const [mine, setMine] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function patch(id: string, body: unknown) {
    setErr("");
    const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error ?? "Could not update");
    router.refresh();
  }
  async function remove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const keep = (t: TaskRow) => !mine || t.assignedUserId === meId;
  const groups = [
    { key: "overdue", title: "Overdue", tone: "text-rose-600", rows: open.filter((t) => keep(t) && t.dueAt < today) },
    { key: "today", title: "Due today", tone: "text-amber-600", rows: open.filter((t) => keep(t) && t.dueAt === today) },
    { key: "upcoming", title: "Upcoming", tone: "text-muted", rows: open.filter((t) => keep(t) && t.dueAt > today) },
  ];

  const row = (t: TaskRow) => (
    <li key={t.id} className="flex items-center gap-3 px-5 py-3">
      <input type="checkbox" aria-label={`Mark "${t.title}" ${t.done ? "not done" : "done"}`} checked={t.done} onChange={() => patch(t.id, { done: !t.done })} className="h-4 w-4 accent-indigo-500" />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", t.done && "text-muted line-through")}>{t.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Link href={`/leads?open=${t.lead.id}`} className="font-medium text-fg hover:text-accent">{t.lead.name}</Link>
          <ServiceBadge service={t.lead.service} />
          {t.assignee && <span>· {t.assignee}</span>}
        </p>
      </div>
      <span className={cn("shrink-0 text-xs tabular-nums", !t.done && t.dueAt < today ? "font-semibold text-rose-600" : "text-muted")}>{label(t.dueAt)}</span>
      <button onClick={() => remove(t.id)} aria-label="Delete follow-up" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-rose-600"><Trash2 size={15} /></button>
    </li>
  );

  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{total} open follow-up{total === 1 ? "" : "s"}</p>
        <div className="inline-flex rounded-xl border bg-surface p-1">
          {([["All", false], ["Mine", true]] as const).map(([l, v]) => (
            <Button key={l} size="sm" variant={mine === v ? "primary" : "ghost"} onClick={() => setMine(v)}>{l}</Button>
          ))}
        </div>
      </div>
      {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
      {total === 0 && <Card><Empty title="Nothing to chase" hint="Open a lead and add a follow-up so it shows up here when it's due." /></Card>}
      {groups.map((g) => g.rows.length > 0 && (
        <Card key={g.key}>
          <CardHeader title={`${g.title} · ${g.rows.length}`} />
          <ul className="divide-y border-t">{g.rows.map(row)}</ul>
        </Card>
      ))}
      {done.length > 0 && (
        <Card>
          <CardHeader title="Recently completed" />
          <ul className="divide-y border-t">{done.map(row)}</ul>
        </Card>
      )}
    </div>
  );
}
