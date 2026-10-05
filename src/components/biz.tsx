"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button, Card, Input, Label, Modal, Select, Textarea } from "./ui";
import { cn } from "@/lib/utils";
import type { Field } from "@/lib/fields";

export function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", tone === "good" && "text-emerald-600", tone === "bad" && "text-rose-600", tone === "warn" && "text-amber-600")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="inline-flex rounded-xl border bg-surface p-1">
      {items.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", value === t.id ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg")}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 text-xs opacity-70">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

const TONES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600", DELIVERED: "bg-emerald-500/10 text-emerald-600", POSTED: "bg-emerald-500/10 text-emerald-600", DONE: "bg-slate-500/10 text-slate-500",
  PENDING: "bg-amber-500/10 text-amber-600", TESTING: "bg-amber-500/10 text-amber-600", PLANNED: "bg-sky-500/10 text-sky-600", SCHEDULED: "bg-sky-500/10 text-sky-600", SHIPPED: "bg-sky-500/10 text-sky-600",
  PAUSED: "bg-slate-500/10 text-slate-500", IDEA: "bg-violet-500/10 text-violet-600", DRAFT: "bg-slate-500/10 text-slate-500",
  REFUNDED: "bg-rose-500/10 text-rose-600", CHURNED: "bg-rose-500/10 text-rose-600",
};
export function Pill({ value }: { value: string }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", TONES[value] ?? "bg-slate-500/10 text-slate-500")}>{value.charAt(0) + value.slice(1).toLowerCase()}</span>;
}

export async function ops(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function RowActions({ resource, id, onEdit, label }: { resource: string; id: string; onEdit: () => void; label: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  async function remove() {
    await ops("DELETE", `/api/ops/${resource}/${id}`);
    setConfirm(false);
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <button onClick={onEdit} aria-label={`Edit ${label}`} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"><Pencil size={14} /></button>
      <button onClick={() => setConfirm(true)} aria-label={`Delete ${label}`} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-rose-600"><Trash2 size={14} /></button>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete this?">
        <p className="text-sm text-muted">&ldquo;{label}&rdquo; will be permanently removed.</p>
        <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete</Button></div>
      </Modal>
    </span>
  );
}

type Values = Record<string, string>;
/** Drops undefined entries so a partial autofill result can be spread into Values. */
const defined = (o: Partial<Values> | undefined): Values => Object.fromEntries(Object.entries(o ?? {}).filter(([, x]) => x !== undefined)) as Values;

/** Add / edit form driven by a field list. Posts to /api/ops/<resource>. */
export function EntityDialog({
  open, onClose, title, resource, fields, initial, id, extra, autofill,
}: {
  open: boolean; onClose: () => void; title: string; resource: string; fields: readonly Field[]; initial?: Values; id?: string;
  /** Fixed values sent with every save (e.g. the income/expense type). */
  extra?: Record<string, unknown>;
  autofill?: (v: Values, changed: string) => Partial<Values>;
}) {
  const router = useRouter();
  const blank = React.useMemo<Values>(() => Object.fromEntries(fields.map((f) => [f.key, f.type === "select" ? (f.options?.[0]?.value ?? "") : ""])), [fields]);
  const [v, setV] = React.useState<Values>({ ...blank, ...initial });
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const uid = React.useId();
  const set = (k: string, val: string) => setV((cur) => ({ ...cur, [k]: val, ...defined(autofill?.({ ...cur, [k]: val }, k)) }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await ops(id ? "PATCH" : "POST", id ? `/api/ops/${resource}/${id}` : `/api/ops/${resource}`, { ...v, ...extra });
      onClose();
      router.refresh();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
    setBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key} className={f.half ? "col-span-1" : "col-span-2"}>
            <Label htmlFor={`${uid}-${f.key}`}>{f.label}{f.required && " *"}</Label>
            {f.type === "select" ? (
              <Select id={`${uid}-${f.key}`} value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} required={f.required}>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            ) : f.type === "textarea" ? (
              <Textarea id={`${uid}-${f.key}`} value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <Input id={`${uid}-${f.key}`} type={f.type} step={f.type === "number" ? "any" : undefined} min={f.type === "number" ? 0 : undefined} value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} required={f.required} placeholder={f.placeholder} />
            )}
          </div>
        ))}
        {err && <p role="alert" className="col-span-2 text-sm text-rose-600">{err}</p>}
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Dialog key so the form re-initialises for each record it edits. */
export const dlgKey = (id?: string | null, open?: boolean) => `${id ?? "new"}-${open ? "open" : "closed"}`;
