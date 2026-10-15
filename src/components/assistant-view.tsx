"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button, Input } from "./ui";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["How many leads are in each stage?", "What's my net this month?", "Which conversations need a reply?"];

export function AssistantView() {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const bottom = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: q }];
    setTurns(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-30) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The assistant is unavailable");
      setTurns([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-[420px] flex-col rounded-2xl border bg-surface">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Ask about your leads, conversations or finances.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border px-3 py-1.5 text-xs hover:bg-surface-2">{s}</button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm", t.role === "user" ? "ml-auto bg-accent text-white" : "bg-surface-2")}>
            {t.content}
          </div>
        ))}
        {busy && <div className="max-w-[80%] rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">Thinking…</div>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div ref={bottom} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t p-3">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the assistant…" aria-label="Message" />
        <Button type="submit" disabled={busy || !input.trim()} aria-label="Send"><Send size={15} /></Button>
      </form>
    </div>
  );
}
