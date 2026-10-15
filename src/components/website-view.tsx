"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button, Card, CardHeader, Input, Label, Textarea, Toggle } from "./ui";
import type { SiteFields } from "@/lib/website";

type Props = { initial: SiteFields; isAdmin: boolean; publicUrl: string };

export function WebsiteView({ initial, isAdmin, publicUrl }: Props) {
  const [site, setSite] = React.useState<SiteFields>(initial);
  const [status, setStatus] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const set = (key: keyof SiteFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSite({ ...site, [key]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/website", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(site) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setStatus(res.ok ? { ok: true, text: "Website saved" } : { ok: false, text: body.error ?? "Could not save" });
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Content" subtitle="What visitors see on the public website" />
          <div className="space-y-4 px-5 pb-5">
            <div><Label>Business name</Label><Input value={site.name} onChange={set("name")} disabled={!isAdmin} /></div>
            <div><Label>Headline</Label><Input value={site.headline} onChange={set("headline")} disabled={!isAdmin} placeholder="AI receptionists that never miss a call" /></div>
            <div><Label>Subheadline</Label><Input value={site.subheadline} onChange={set("subheadline")} disabled={!isAdmin} /></div>
            <div><Label>About</Label><Textarea rows={4} value={site.about} onChange={set("about")} disabled={!isAdmin} /></div>
            <div><Label>Services (one per line)</Label><Textarea rows={4} value={site.services} onChange={set("services")} disabled={!isAdmin} placeholder={"AI Voice Receptionist\nWeb Development\nDropshipping"} /></div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Call to action & contact" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <div><Label>Button text</Label><Input value={site.ctaText} onChange={set("ctaText")} disabled={!isAdmin} placeholder="Book a call" /></div>
            <div><Label>Button link</Label><Input value={site.ctaUrl} onChange={set("ctaUrl")} disabled={!isAdmin} placeholder="https://…" /></div>
            <div><Label>Email</Label><Input type="email" value={site.email} onChange={set("email")} disabled={!isAdmin} /></div>
            <div><Label>Phone</Label><Input value={site.phone} onChange={set("phone")} disabled={!isAdmin} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Input value={site.address} onChange={set("address")} disabled={!isAdmin} /></div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Publishing" />
          <div className="space-y-4 px-5 pb-5">
            <Toggle
              label="Published"
              checked={site.published === "true"}
              onChange={(v) => setSite({ ...site, published: v ? "true" : "false" })}
            />
            <p className="text-xs text-muted">
              The public read-only endpoint returns this content only while published is on.
            </p>
            <div>
              <Label>Public endpoint</Label>
              <Input readOnly value={publicUrl} className="font-mono text-xs" />
            </div>
            {isAdmin ? (
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save website"}</Button>
            ) : (
              <p className="text-xs text-muted">Only admins can change the website.</p>
            )}
            {status && (
              <p className={status.ok ? "flex items-center gap-1 text-sm text-emerald-600" : "text-sm text-rose-600"}>
                {status.ok && <Check size={14} />} {status.text}
              </p>
            )}
          </div>
        </Card>
      </div>
    </form>
  );
}
