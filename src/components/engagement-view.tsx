"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ClipboardList, MessageCircle, Reply, UserPlus } from "lucide-react";
import { Avatar, Button, Card, Empty, Input } from "./ui";
import { cn, timeAgo } from "@/lib/utils";

type Comment = { id: string; author: string; text: string; postRef: string | null; handled: boolean; leadId: string | null; createdAt: string };
type Enquiry = { id: string; formName: string | null; name: string | null; email: string | null; phone: string | null; message: string | null; handled: boolean; leadId: string | null; createdAt: string };

export function EngagementView({ comments, enquiries }: { comments: Comment[]; enquiries: Enquiry[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"comments" | "enquiries">("comments");
  const [replyFor, setReplyFor] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [err, setErr] = React.useState("");

  async function act(kind: string, id: string, action: string, text?: string) {
    setBusy(id);
    setErr("");
    const res = await fetch(`/api/engagement/${kind}/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, text }) });
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error ?? "Failed");
    else { setReplyFor(null); setReply(""); router.refresh(); }
    setBusy("");
  }

  const pendingC = comments.filter((c) => !c.handled).length;
  const pendingE = enquiries.filter((e) => !e.handled).length;

  return (
    <>
      <div className="mb-4 inline-flex rounded-xl border bg-surface p-1">
        {([["comments", MessageCircle, "Comments", pendingC], ["enquiries", ClipboardList, "Enquiries", pendingE]] as const).map(([k, Icon, label, n]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition", tab === k ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}>
            <Icon size={15} /> {label} {n > 0 && <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", tab === k ? "bg-white/25" : "bg-accent/15 text-accent")}>{n}</span>}
          </button>
        ))}
      </div>
      {err && <p className="mb-3 text-sm text-rose-600">{err}</p>}

      <Card className="divide-y overflow-hidden">
        {tab === "comments" && comments.map((c) => (
          <div key={c.id} className={cn("flex gap-3 p-4", c.handled && "opacity-60")}>
            <Avatar name={c.author} color="#8b5cf6" size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm"><span className="font-semibold">@{c.author}</span> <span className="text-xs text-muted">· {timeAgo(c.createdAt)}{c.postRef ? ` · on ${c.postRef}` : ""}</span></p>
              <p className="mt-0.5 text-sm">{c.text}</p>
              {replyFor === c.id && (
                <div className="mt-2 flex gap-2">
                  <Input autoFocus value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Public reply…" onKeyDown={(e) => e.key === "Enter" && act("comments", c.id, "reply", reply)} />
                  <Button variant="primary" size="sm" disabled={busy === c.id} onClick={() => act("comments", c.id, "reply", reply)}>Post</Button>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {c.leadId ? (
                  <Link href={`/leads?open=${c.leadId}`} className="text-xs font-medium text-accent hover:underline">View lead →</Link>
                ) : (
                  <Button size="sm" disabled={busy === c.id} onClick={() => act("comments", c.id, "convert")}><UserPlus size={13} /> Convert to lead</Button>
                )}
                {!c.handled && <Button size="sm" onClick={() => setReplyFor(replyFor === c.id ? null : c.id)}><Reply size={13} /> Reply</Button>}
                {!c.handled && <Button size="sm" variant="ghost" onClick={() => act("comments", c.id, "handle")}><Check size={13} /> Mark handled</Button>}
              </div>
            </div>
          </div>
        ))}
        {tab === "enquiries" && enquiries.map((e) => (
          <div key={e.id} className={cn("flex gap-3 p-4", e.handled && "opacity-60")}>
            <Avatar name={e.name ?? "?"} color="#3b82f6" size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm"><span className="font-semibold">{e.name ?? "Unknown"}</span> <span className="text-xs text-muted">· {e.formName ?? "Lead form"} · {timeAgo(e.createdAt)}</span></p>
              <p className="text-xs text-muted">{[e.email, e.phone].filter(Boolean).join(" · ")}</p>
              {e.message && <p className="mt-1 text-sm">{e.message}</p>}
              <div className="mt-2 flex gap-2">
                {e.leadId ? (
                  <Link href={`/leads?open=${e.leadId}`} className="text-xs font-medium text-accent hover:underline">View lead →</Link>
                ) : (
                  <Button size="sm" disabled={busy === e.id} onClick={() => act("enquiries", e.id, "convert")}><UserPlus size={13} /> Convert to lead</Button>
                )}
                {!e.handled && !e.leadId && <Button size="sm" variant="ghost" onClick={() => act("enquiries", e.id, "handle")}><Check size={13} /> Dismiss</Button>}
              </div>
            </div>
          </div>
        ))}
        {tab === "comments" && comments.length === 0 && <Empty title="No comments yet" />}
        {tab === "enquiries" && enquiries.length === 0 && <Empty title="No enquiries yet" />}
      </Card>
    </>
  );
}
