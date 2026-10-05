"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, Mail, Phone, Plus, Search } from "lucide-react";
import { Avatar, Button, Card, Empty, Input, Label, Modal, Select, ServiceBadge, Textarea } from "./ui";
import { LAWFUL_BASIS, SOURCE_META } from "@/lib/constants";
import { money } from "@/lib/utils";

type Row = {
  doNotContact: boolean;
  id: string; name: string; email: string | null; phone: string | null; instagramHandle: string | null; company: string | null; source: string;
  leadCount: number; services: string[]; lifetimeValue: number; owner: { name: string; avatarColor: string } | null;
};

export function ContactForm({ initial, onDone, onCancel, id }: { initial?: Partial<Record<string, string | boolean | null>>; id?: string; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = React.useState({
    name: (initial?.name as string) ?? "", email: (initial?.email as string) ?? "", phone: (initial?.phone as string) ?? "",
    instagramHandle: (initial?.instagramHandle as string) ?? "", company: (initial?.company as string) ?? "", notes: (initial?.notes as string) ?? "",
    website: (initial?.website as string) ?? "", industry: (initial?.industry as string) ?? "", country: (initial?.country as string) ?? "",
    lawfulBasis: (initial?.lawfulBasis as string) ?? "",
  });
  const [dnc, setDnc] = React.useState(Boolean(initial?.doNotContact));
  const [err, setErr] = React.useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(id ? `/api/contacts/${id}` : "/api/contacts", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, doNotContact: dnc }) });
    if (res.ok) onDone();
    else setErr((await res.json().catch(() => ({}))).error ?? "Could not save");
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Name *</Label><Input value={f.name} onChange={set("name")} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Email</Label><Input type="email" value={f.email} onChange={set("email")} /></div>
        <div><Label>Phone</Label><Input value={f.phone} onChange={set("phone")} /></div>
        <div><Label>Instagram</Label><Input value={f.instagramHandle} onChange={set("instagramHandle")} placeholder="@handle" /></div>
        <div><Label>Company</Label><Input value={f.company} onChange={set("company")} /></div>
        <div><Label>Website</Label><Input value={f.website} onChange={set("website")} placeholder="example.co.uk" /></div>
        <div><Label>Industry</Label><Input value={f.industry} onChange={set("industry")} placeholder="e.g. dental clinic" /></div>
        <div><Label>Country</Label><Input value={f.country} onChange={set("country")} placeholder="e.g. UK" /></div>
        <div>
          <Label>Lawful basis (cold outreach)</Label>
          <Select value={f.lawfulBasis} onChange={set("lawfulBasis")}>
            <option value="">Not recorded</option>
            {Object.entries(LAWFUL_BASIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm">
        <input type="checkbox" checked={dnc} onChange={(e) => setDnc(e.target.checked)} />
        <span><span className="font-medium">Do not contact</span> <span className="text-muted">— opted out; imports and API leads will skip this person</span></span>
      </label>
      <div><Label>Notes</Label><Textarea value={f.notes} onChange={set("notes")} /></div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">{id ? "Save changes" : "Add contact"}</Button>
      </div>
    </form>
  );
}

export function ContactsView({ contacts }: { contacts: Row[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const needle = q.trim().toLowerCase();
  const rows = contacts.filter((c) => !needle || [c.name, c.email, c.phone, c.instagramHandle, c.company].some((v) => v?.toLowerCase().includes(needle)));

  return (
    <>
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search contacts…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-xs text-muted">{rows.length} contacts</span>
        <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add contact</Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-2/60 text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Contact info</th>
                <th className="px-3 py-3 font-medium">Services</th>
                <th className="px-3 py-3 font-medium">Assigned team</th>
                <th className="px-3 py-3 font-medium">Source</th>
                <th className="px-3 py-3 text-right font-medium">Lifetime value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="px-5 py-3">
                    <Link href={`/contacts/${c.id}`} className="flex items-center gap-3">
                      <Avatar name={c.name} color="#64748b" size={34} />
                      <span>
                        <span className="block font-medium hover:text-accent">{c.name}</span>
                        <span className="block text-xs text-muted">{c.company ?? "—"}{c.doNotContact && <span className="ml-1.5 rounded bg-rose-500/10 px-1.5 py-0.5 font-semibold text-rose-600">Do not contact</span>}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {c.email && <p className="flex items-center gap-1.5"><Mail size={12} className="text-muted" />{c.email}</p>}
                    {c.phone && <p className="flex items-center gap-1.5"><Phone size={12} className="text-muted" />{c.phone}</p>}
                    {c.instagramHandle && <p className="flex items-center gap-1.5"><AtSign size={12} className="text-muted" />{c.instagramHandle}</p>}
                  </td>
                  <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{c.services.map((s) => <ServiceBadge key={s} service={s} />)}</div></td>
                  <td className="px-3 py-3">
                    {c.owner ? <span className="flex items-center gap-2 text-xs"><Avatar name={c.owner.name} color={c.owner.avatarColor} size={22} />{c.owner.name}</span> : <span className="text-xs text-muted">—</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">{SOURCE_META[c.source]}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">{c.lifetimeValue ? money(c.lifetimeValue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty title="No contacts found" />}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add contact">
        <ContactForm onCancel={() => setAdding(false)} onDone={() => { setAdding(false); router.refresh(); }} />
      </Modal>
    </>
  );
}
