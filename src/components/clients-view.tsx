"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Card, CardHeader, Empty, Select, ServiceBadge } from "./ui";
import { EntityDialog, RowActions, StatCard, Tabs, dlgKey, ops } from "./biz";
import { FIELDS, today as todayStr, type Opt } from "@/lib/fields";
import { CLIENT_STATUS, SERVICE_META } from "@/lib/constants";
import { money } from "@/lib/utils";

type Client = { id: string; contactId: string; name: string; company: string | null; service: string; monthlyFee: number; status: string; startedAt: string; renewsAt: string; notes: string };

const daysUntil = (d: string, today: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86400_000);

export function ClientsView({ kpis, byService, contacts, renewalIds, today, clients }: {
  kpis: { active: number; mrr: number; arr: number; avgFee: number; paused: number; churned: number; churnRate: number };
  byService: { service: string; clients: number; mrr: number }[]; contacts: Opt[]; renewalIds: string[]; today: string; clients: Client[];
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"ACTIVE" | "ALL">("ACTIVE");
  const [dlg, setDlg] = React.useState<{ id?: string } | null>(null);
  const rows = clients.filter((c) => filter === "ALL" || c.status === "ACTIVE");
  const editing = dlg?.id ? clients.find((c) => c.id === dlg.id) : undefined;
  const renewals = clients.filter((c) => renewalIds.includes(c.id));

  async function setStatus(id: string, status: string) {
    await ops("PATCH", `/api/ops/clients/${id}`, { status });
    router.refresh();
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Active clients" value={String(kpis.active)} sub={kpis.paused ? `${kpis.paused} paused` : undefined} />
        <StatCard label="Monthly recurring (MRR)" value={money(kpis.mrr)} tone="good" />
        <StatCard label="Annual run-rate" value={money(kpis.arr)} />
        <StatCard label="Avg monthly fee" value={kpis.active ? money(kpis.avgFee) : "—"} />
        <StatCard label="Churned" value={String(kpis.churned)} tone={kpis.churned ? "bad" : undefined} sub={`${kpis.churnRate}% of all clients`} />
        <StatCard label="Renewing in 30 days" value={String(renewals.length)} tone={renewals.length ? "warn" : undefined} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Tabs value={filter} onChange={setFilter} items={[{ id: "ACTIVE", label: "Active" }, { id: "ALL", label: "All clients", count: clients.length }]} />
            <Button variant="primary" onClick={() => setDlg({})}><Plus size={16} /> Add client</Button>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-surface-2/60 text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">Client</th><th className="px-3 py-3 font-medium">Service</th><th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Monthly</th><th className="px-3 py-3 font-medium">Renews</th><th className="px-3 py-3" />
                </tr></thead>
                <tbody>
                  {rows.map((c) => {
                    const left = c.renewsAt ? daysUntil(c.renewsAt, today) : null;
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-surface-2/50">
                        <td className="px-5 py-3"><Link href={`/contacts/${c.contactId}`} className="font-medium hover:text-accent">{c.name}</Link><p className="text-xs text-muted">{c.company ?? `Since ${c.startedAt}`}</p></td>
                        <td className="px-3 py-3"><ServiceBadge service={c.service} /></td>
                        <td className="px-3 py-3">
                          <Select className="h-8 w-auto text-xs" value={c.status} onChange={(e) => setStatus(c.id, e.target.value)} aria-label={`Status of ${c.name}`}>
                            {CLIENT_STATUS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                          </Select>
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{money(c.monthlyFee)}</td>
                        <td className="px-3 py-3 text-xs">{c.renewsAt ? <span className={left !== null && left <= 7 && c.status === "ACTIVE" ? "font-semibold text-amber-600" : "text-muted"}>{c.renewsAt}{left !== null && c.status === "ACTIVE" && (left < 0 ? " · overdue" : left <= 30 ? ` · in ${left}d` : "")}</span> : <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-3 text-right"><RowActions resource="clients" id={c.id} label={c.name} onEdit={() => setDlg({ id: c.id })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <Empty title="No clients here yet" hint="Add a client from your contacts to track their retainer and renewal date." />}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Recurring revenue by service" />
            {byService.length === 0 ? <Empty title="No active clients" /> : (
              <ul className="space-y-3 px-5 pb-5 text-sm">
                {byService.map((b) => (
                  <li key={b.service} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERVICE_META[b.service]?.color }} />{SERVICE_META[b.service]?.label ?? b.service}<span className="text-xs text-muted">· {b.clients}</span></span>
                    <span className="font-medium tabular-nums">{money(b.mrr)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Renewals coming up" subtitle="Next 30 days" />
            {renewals.length === 0 ? <Empty title="Nothing due" /> : (
              <ul className="divide-y border-t">
                {renewals.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted">{c.renewsAt} · {money(c.monthlyFee)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <EntityDialog
        key={dlgKey(dlg?.id, !!dlg)}
        open={!!dlg}
        onClose={() => setDlg(null)}
        title={dlg?.id ? "Edit client" : "Add client"}
        resource="clients"
        fields={FIELDS.clients(contacts)}
        id={dlg?.id}
        initial={editing ? { contactId: editing.contactId, service: editing.service, monthlyFee: String(editing.monthlyFee), status: editing.status, startedAt: editing.startedAt, renewsAt: editing.renewsAt, notes: editing.notes } : { service: "AI_VOICE", status: "ACTIVE", monthlyFee: "0", startedAt: todayStr() }}
      />
    </>
  );
}
