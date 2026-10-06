"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ImageIcon, Loader2, Trash2, Wand2 } from "lucide-react";
import { Button, Card, CardHeader, Empty, Label, Select, Textarea } from "./ui";
import { cn, timeAgo } from "@/lib/utils";

type Creative = { id: string; prompt: string; aspect: string; status: string; imageUrl: string | null; error: string | null; author: string | null; createdAt: string };

const ASPECTS = [
  ["1:1", "Square 1:1 (feed)"],
  ["4:5", "Portrait 4:5 (feed)"],
  ["9:16", "Vertical 9:16 (reels / stories)"],
  ["16:9", "Landscape 16:9 (ads / web)"],
] as const;
const FINAL = ["completed", "failed", "nsfw"];
const RATIO: Record<string, string> = { "1:1": "aspect-square", "4:5": "aspect-[4/5]", "9:16": "aspect-[9/16]", "16:9": "aspect-video" };

export function StudioView({ creatives, demoMode, hasKey }: { creatives: Creative[]; demoMode: boolean; hasKey: boolean }) {
  const router = useRouter();
  const [items, setItems] = React.useState(creatives);
  const [prompt, setPrompt] = React.useState("");
  const [aspect, setAspect] = React.useState("1:1");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  // Take fresh server data after router.refresh() (adjusting state during render, not in an effect)
  const [prevCreatives, setPrevCreatives] = React.useState(creatives);
  if (prevCreatives !== creatives) {
    setPrevCreatives(creatives);
    setItems(creatives);
  }

  // Poll unfinished jobs every 4s; each GET refreshes the job's status from Higgsfield.
  const pending = items.filter((c) => !FINAL.includes(c.status)).map((c) => c.id).join(",");
  React.useEffect(() => {
    if (!pending) return;
    const t = setInterval(async () => {
      const updates = await Promise.all(
        pending.split(",").map((id) => fetch(`/api/creatives/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)),
      );
      setItems((cur) => cur.map((c) => {
        const u = updates.find((x) => x?.id === c.id);
        return u ? { ...c, status: u.status, imageUrl: u.imageUrl, error: u.error } : c;
      }));
    }, 4000);
    return () => clearInterval(t);
  }, [pending]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res = await fetch("/api/creatives", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, aspect }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "Generation failed");
    setPrompt("");
    router.refresh();
  }

  async function remove(c: Creative) {
    if (!confirm("Delete this creative?")) return;
    setItems((cur) => cur.filter((x) => x.id !== c.id));
    await fetch(`/api/creatives/${c.id}`, { method: "DELETE" });
    router.refresh();
  }

  const blocked = demoMode ? "Demo mode is on — turn it off in Settings to generate with Higgsfield." : !hasKey ? "No active Higgsfield key." : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="New image" subtitle="Describe the visual. Jobs run on Higgsfield and appear below when ready." />
        <form onSubmit={generate} className="space-y-3 px-5 pb-5">
          <div>
            <Label>Prompt</Label>
            <Textarea
              rows={3}
              required
              minLength={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Modern dental clinic front desk, friendly AI receptionist on a tablet, soft daylight, photorealistic"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-64">
              <Label>Format</Label>
              <Select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                {ASPECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
            <Button type="submit" variant="primary" disabled={busy || !!blocked}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Generate
            </Button>
          </div>
          {blocked && (
            <p className="text-xs text-amber-600">
              {blocked} {!demoMode && <Link href="/integrations" className="underline">Add one in Integrations</Link>}
            </p>
          )}
          {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
        </form>
      </Card>

      {items.length === 0 ? (
        <Card><Empty title="No creatives yet" hint="Generated images show up here for the whole team." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="animate-in overflow-hidden">
              <div className={cn("relative flex items-center justify-center bg-surface-2", RATIO[c.aspect] ?? "aspect-square")}>
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote Higgsfield CDN URL, no optimisation needed
                  <img src={c.imageUrl} alt={c.prompt} className="h-full w-full object-cover" />
                ) : FINAL.includes(c.status) ? (
                  <div className="px-6 text-center text-sm text-rose-600"><ImageIcon className="mx-auto mb-2" size={22} />{c.error ?? "No image returned"}</div>
                ) : (
                  <div className="text-center text-sm text-muted"><Loader2 className="mx-auto mb-2 animate-spin" size={22} />{c.status === "queued" ? "Queued…" : "Generating…"}</div>
                )}
              </div>
              <div className="flex items-start gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm">{c.prompt}</p>
                  <p className="mt-1 text-xs text-muted">{c.aspect} · {c.author ?? "Someone"} · {timeAgo(c.createdAt)}</p>
                </div>
                {c.imageUrl && (
                  <a href={c.imageUrl} target="_blank" rel="noopener noreferrer" aria-label="Open full size" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"><Download size={15} /></a>
                )}
                <button onClick={() => remove(c)} aria-label="Delete creative" className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-600"><Trash2 size={15} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
