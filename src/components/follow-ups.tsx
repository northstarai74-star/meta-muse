"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Empty } from "./ui";
import { cn } from "@/lib/utils";

export type DueTask = { id: string; title: string; dueDate: string; when: "overdue" | "today" | "soon"; leadId: string; leadTitle: string; contactName: string };

const LABEL = { overdue: "Overdue", today: "Today", soon: "Tomorrow" } as const;

export function FollowUps({ tasks }: { tasks: DueTask[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const due = tasks.filter((t) => t.when !== "soon").length;

  async function complete(id: string) {
    setBusy(id);
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Follow-ups" subtitle={due ? `${due} due today or overdue` : "Nothing due today"} />
      {tasks.length === 0 ? (
        <Empty title="No follow-ups scheduled" hint="Open a lead and add one so nothing goes cold." />
      ) : (
        <ul className="divide-y border-t">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <input type="checkbox" disabled={busy === t.id} aria-label={`Mark "${t.title}" done`} onChange={() => complete(t.id)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.title}</p>
                <Link href={`/leads?open=${t.leadId}`} className="truncate text-xs text-muted hover:text-accent">{t.contactName} · {t.leadTitle}</Link>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", t.when === "overdue" ? "bg-rose-500/10 text-rose-600" : t.when === "today" ? "bg-amber-500/10 text-amber-600" : "bg-slate-500/10 text-slate-500")}>
                {LABEL[t.when]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
