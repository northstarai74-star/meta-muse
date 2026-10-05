"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button, Card, CardHeader, Empty } from "./ui";
import { EntityDialog, Pill, RowActions, StatCard, Tabs, dlgKey } from "./biz";
import { FIELDS } from "@/lib/fields";
import { CHANNEL_LABEL, LINE_LABEL } from "@/lib/constants";
import { money } from "@/lib/utils";

type Campaign = { id: string; name: string; channel: string; service: string; status: string; budget: number; spend: number; leadsGenerated: number; startsAt: string; endsAt: string; notes: string };
type Content = { id: string; title: string; channel: string; status: string; scheduledFor: string; caption: string };

export function MarketingView({ kpis, byChannel, campaigns, content }: { kpis: { active: number; spend: number; budget: number; leads: number; cpl: number; scheduled: number }; byChannel: { channel: string; spend: number; leads: number }[]; campaigns: Campaign[]; content: Content[] }) {
  const [tab, setTab] = React.useState<"campaigns" | "content">("campaigns");
  const [dlg, setDlg] = React.useState<{ kind: "campaign" | "content"; id?: string } | null>(null);
  const editing = dlg?.id ? (dlg.kind === "campaign" ? campaigns : content).find((x) => x.id === dlg.id) : undefined;
  const asValues = (o: object | undefined) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v == null ? "" : String(v)])) : undefined);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active campaigns" value={String(kpis.active)} />
        <StatCard label="Total spend" value={money(kpis.spend)} sub={kpis.budget ? `of ${money(kpis.budget)} budgeted` : undefined} />
        <StatCard label="Leads generated" value={String(kpis.leads)} />
        <StatCard label="Cost per lead" value={kpis.leads ? money(kpis.cpl) : "—"} />
        <StatCard label="Posts scheduled" value={String(kpis.scheduled)} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Tabs value={tab} onChange={setTab} items={[{ id: "campaigns", label: "Campaigns", count: campaigns.length }, { id: "content", label: "Content calendar", count: content.length }]} />
            <Button variant="primary" onClick={() => setDlg({ kind: tab === "campaigns" ? "campaign" : "content" })}><Plus size={16} /> {tab === "campaigns" ? "New campaign" : "New post"}</Button>
          </div>

          {tab === "campaigns" ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-surface-2/60 text-left text-xs text-muted">
                    <th className="px-5 py-3 font-medium">Campaign</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 text-right font-medium">Spend / budget</th>
                    <th className="px-3 py-3 text-right font-medium">Leads</th><th className="px-3 py-3 text-right font-medium">CPL</th><th className="px-3 py-3" />
                  </tr></thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-surface-2/50">
                        <td className="px-5 py-3"><p className="font-medium">{c.name}</p><p className="text-xs text-muted">{CHANNEL_LABEL[c.channel]} · {LINE_LABEL[c.service] ?? c.service}</p></td>
                        <td className="px-3 py-3"><Pill value={c.status} /></td>
                        <td className="px-3 py-3 text-right tabular-nums">{money(c.spend)}<span className="text-muted"> / {money(c.budget)}</span></td>
                        <td className="px-3 py-3 text-right tabular-nums">{c.leadsGenerated}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{c.leadsGenerated ? money(c.spend / c.leadsGenerated) : "—"}</td>
                        <td className="px-3 py-3 text-right"><RowActions resource="campaigns" id={c.id} label={c.name} onEdit={() => setDlg({ kind: "campaign", id: c.id })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {campaigns.length === 0 && <Empty title="No campaigns yet" hint="Track each ad or promotion with its spend and the leads it brought in." />}
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y">
                {content.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted">{CHANNEL_LABEL[c.channel]}{c.scheduledFor && ` · ${c.scheduledFor}`}</p>
                    </div>
                    <Pill value={c.status} />
                    <RowActions resource="content" id={c.id} label={c.title} onEdit={() => setDlg({ kind: "content", id: c.id })} />
                  </li>
                ))}
              </ul>
              {content.length === 0 && <Empty title="Nothing planned" hint="Capture post ideas and schedule them." />}
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="By channel" subtitle="Where leads come from per dollar" />
          {byChannel.length === 0 ? <Empty title="No data yet" /> : (
            <ul className="space-y-3 px-5 pb-5 text-sm">
              {byChannel.map((c) => (
                <li key={c.channel}>
                  <div className="flex justify-between"><span className="font-medium">{CHANNEL_LABEL[c.channel]}</span><span className="tabular-nums">{c.leads} leads</span></div>
                  <p className="text-xs text-muted">{money(c.spend)} spent{c.leads ? ` · ${money(c.spend / c.leads)} per lead` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <EntityDialog
        key={dlgKey(dlg?.id, !!dlg) + (dlg?.kind ?? "")}
        open={!!dlg}
        onClose={() => setDlg(null)}
        title={dlg?.kind === "campaign" ? (dlg.id ? "Edit campaign" : "New campaign") : dlg?.id ? "Edit post" : "New post"}
        resource={dlg?.kind === "campaign" ? "campaigns" : "content"}
        fields={dlg?.kind === "campaign" ? FIELDS.campaigns : FIELDS.content}
        id={dlg?.id}
        initial={asValues(editing) ?? (dlg?.kind === "campaign" ? { status: "PLANNED", budget: "0", spend: "0", leadsGenerated: "0" } : { status: "IDEA" })}
      />
    </>
  );
}
