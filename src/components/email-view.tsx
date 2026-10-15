"use client";

import * as React from "react";
import { Button, Card, CardHeader, Input, Label, Textarea } from "./ui";

type Sender = { email: string; name: string };

export function EmailView({ sender: initial, isAdmin }: { sender: Sender; isAdmin: boolean }) {
  const [sender, setSender] = React.useState<Sender>(initial);
  const [mail, setMail] = React.useState({ to: "", subject: "", text: "" });
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState("");

  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy("");
  };

  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  const saveSender = (e: React.FormEvent) => {
    e.preventDefault();
    run("sender", async () => {
      await call("/api/email/settings", "PUT", sender);
      return "Sender saved";
    });
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    run("send", async () => {
      const to = mail.to.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      const r = await call("/api/email/send", "POST", { to, subject: mail.subject, text: mail.text });
      setMail({ to: "", subject: "", text: "" });
      return `Sent to ${r.sent} recipient${r.sent === 1 ? "" : "s"}`;
    });
  };

  const sync = () =>
    run("sync", async () => {
      const r = await call("/api/email/sync", "POST");
      const fail = r.failed.length ? ` First errors: ${r.failed.join("; ")}` : "";
      return `Synced ${r.synced} of ${r.total} contacts with email to Brevo.${fail}`;
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader title="Send email" subtitle="Sent through Brevo using your saved Brevo key" />
        <form onSubmit={send} className="space-y-4 px-5 pb-5">
          <div><Label>To (comma or space separated)</Label><Input required value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} placeholder="client@example.com" /></div>
          <div><Label>Subject</Label><Input required value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} /></div>
          <div><Label>Message</Label><Textarea required rows={10} value={mail.text} onChange={(e) => setMail({ ...mail, text: e.target.value })} /></div>
          <Button type="submit" disabled={busy === "send"}>{busy === "send" ? "Sending…" : "Send email"}</Button>
        </form>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Sender" subtitle="Must be a sender verified in Brevo" />
          <form onSubmit={saveSender} className="space-y-3 px-5 pb-5">
            <div><Label>Sender email</Label><Input type="email" required disabled={!isAdmin} value={sender.email} onChange={(e) => setSender({ ...sender, email: e.target.value })} /></div>
            <div><Label>Sender name</Label><Input disabled={!isAdmin} value={sender.name} onChange={(e) => setSender({ ...sender, name: e.target.value })} /></div>
            {isAdmin && <Button type="submit" variant="secondary" disabled={busy === "sender"} className="w-full">Save sender</Button>}
          </form>
        </Card>
        <Card>
          <CardHeader title="Store contacts in Brevo" subtitle="Pushes CRM contacts that have an email (up to 200 per run)" />
          <div className="px-5 pb-5">
            {isAdmin && <Button onClick={sync} disabled={busy === "sync"} className="w-full">{busy === "sync" ? "Syncing…" : "Sync contacts to Brevo"}</Button>}
          </div>
        </Card>
        {msg && <p className={msg.ok ? "text-sm text-emerald-600" : "text-sm text-rose-600"}>{msg.text}</p>}
      </div>
    </div>
  );
}
