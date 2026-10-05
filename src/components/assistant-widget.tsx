"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Check, Mic, MicOff, Send, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; actions?: string[]; error?: boolean };
type Props = { chat: boolean; voice: boolean; speakDefault: boolean; isAdmin: boolean };

// Web Speech API (Chrome / Edge / Safari) — typed minimally because lib.dom doesn't ship it.
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const getRecognition = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const SUGGESTIONS = ["What needs my attention today?", "How is the store doing?", "Who is renewing soon?", "Add a follow-up for my newest lead tomorrow"];
const STORE_KEY = "assistant-chat";

/** Tiny, safe markdown: **bold** and "- " / "1." list lines. Everything else is plain text (rendered by React, never as HTML). */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
  return (
    <>
      {text.split("\n").map((line, i) => {
        const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
        return m ? <span key={i} className="flex gap-2 pl-1"><span aria-hidden>•</span><span>{inline(m[1])}</span></span> : <span key={i} className="block min-h-[1em]">{inline(line)}</span>;
      })}
    </>
  );
}

/** Strip markdown so the voice doesn't read out asterisks and hashes. */
const speakable = (t: string) => t.replace(/```[\s\S]*?```/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim().slice(0, 1500);

export function AssistantWidget({ chat, voice, speakDefault, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  // Restored lazily; the panel is closed on first render so this can't cause a hydration mismatch.
  const [msgs, setMsgs] = React.useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [speak, setSpeak] = React.useState(speakDefault);
  const [playing, setPlaying] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [micError, setMicError] = React.useState("");
  const recRef = React.useRef<Recognition | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const canListen = React.useSyncExternalStore(() => () => {}, () => !!getRecognition(), () => false);
  React.useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-40)));
    } catch {}
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);
  React.useEffect(() => () => { recRef.current?.stop(); audioRef.current?.pause(); window.speechSynthesis?.cancel(); }, []);

  function stopSpeaking() {
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setPlaying(false);
  }

  const browserSpeak = React.useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => setPlaying(true);
    u.onend = u.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(u);
  }, []);

  const say = React.useCallback(async (text: string) => {
    const t = speakable(text);
    if (!t) return;
    if (!voice) return browserSpeak(t);
    try {
      const res = await fetch("/api/assistant/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) });
      if (!res.ok) throw new Error("voice failed");
      const url = URL.createObjectURL(await res.blob());
      const a = new Audio(url);
      audioRef.current = a;
      a.onplay = () => setPlaying(true);
      a.onended = a.onerror = () => { setPlaying(false); URL.revokeObjectURL(url); };
      await a.play();
    } catch {
      browserSpeak(t); // ElevenLabs unavailable — fall back to the browser voice rather than going silent
    }
  }, [voice, browserSpeak]);

  const send = React.useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    stopSpeaking();
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).slice(-20).map(({ role, content: c }) => ({ role, content: c })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The assistant is unavailable");
      setMsgs([...next, { role: "assistant", content: data.reply, actions: data.actions }]);
      if (data.actions?.length) router.refresh(); // it changed something — update the page behind it
      if (speak) void say(data.reply);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: (e as Error).message, error: true }]);
    }
    setBusy(false);
  }, [busy, msgs, router, say, speak]);

  function toggleMic() {
    if (listening) return recRef.current?.stop();
    const R = getRecognition();
    if (!R) return;
    stopSpeaking();
    setMicError("");
    const rec = new R();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let line = "";
      for (let i = 0; i < e.results.length; i++) {
        line += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = line;
      }
      setInput(line);
    };
    rec.onerror = (e) => setMicError(e.error === "not-allowed" ? "Microphone access is blocked — allow it in your browser's address bar." : e.error === "no-speech" ? "" : "Couldn't hear that — try again.");
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) void send(finalText); // talk, pause, and it sends
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open assistant" className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <Bot size={26} />
        </button>
      )}
      {open && (
        <section role="dialog" aria-label="Assistant" className="animate-in fixed bottom-5 right-5 z-50 flex h-[min(640px,calc(100vh-2.5rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border bg-surface shadow-2xl">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Bot size={17} /></span>
            <div className="flex-1 leading-tight"><p className="text-sm font-semibold">Assistant</p><p className="text-[11px] text-muted">{chat ? "Ask or tell it what to do" : "Not set up yet"}</p></div>
            <button onClick={() => (playing ? stopSpeaking() : setSpeak((v) => !v))} aria-label={playing ? "Stop speaking" : speak ? "Mute voice replies" : "Speak replies aloud"} aria-pressed={speak} title={playing ? "Stop speaking" : speak ? "Voice replies on" : "Voice replies off"} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg">
              {playing ? <Square size={16} /> : speak ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            {msgs.length > 0 && <button onClick={() => { stopSpeaking(); setMsgs([]); }} aria-label="Clear conversation" title="Clear conversation" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"><Trash2 size={16} /></button>}
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"><X size={17} /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-bg/60 p-4" aria-live="polite">
            {!chat ? (
              <div className="rounded-xl border border-dashed p-4 text-sm">
                <p className="font-medium">Turn the assistant on</p>
                <p className="mt-1 text-muted">It needs an OpenRouter API key. {isAdmin ? "Add one in Integrations — it's stored encrypted and never shown again." : "Ask an admin to add one in Integrations."}</p>
                {isAdmin && <Link href="/integrations" onClick={() => setOpen(false)} className="mt-3 inline-block font-medium text-accent hover:underline">Open Integrations →</Link>}
              </div>
            ) : msgs.length === 0 ? (
              <div>
                <p className="text-sm text-muted">Ask about leads, the store, marketing, clients or finance — or tell me to do something, like adding a follow-up. Type, or tap the mic and talk.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border bg-surface px-3 py-1.5 text-left text-xs hover:border-accent hover:text-accent">{s}</button>)}
                </div>
              </div>
            ) : null}
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
                <div className={cn("max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm", m.role === "user" ? "rounded-br-md bg-accent text-accent-fg" : m.error ? "rounded-bl-md border border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300" : "rounded-bl-md border bg-surface")}>{m.role === "assistant" && !m.error ? <Rich text={m.content} /> : m.content}</div>
                {m.actions?.map((a) => <span key={a} className="inline-flex max-w-[88%] items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300"><Check size={12} className="shrink-0" />{a}</span>)}
              </div>
            ))}
            {busy && <div className="flex"><div className="rounded-2xl rounded-bl-md border bg-surface px-3.5 py-2 text-sm text-muted"><span className="animate-pulse">Thinking…</span></div></div>}
            <div ref={endRef} />
          </div>

          {chat && (
            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="border-t p-3">
              {micError && <p role="alert" className="mb-2 text-xs text-rose-600">{micError}</p>}
              {listening && <p className="mb-2 flex items-center gap-2 text-xs text-rose-600"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> Listening… speak, then pause to send</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                  rows={2}
                  maxLength={4000}
                  placeholder={listening ? "Listening…" : "Ask or instruct…"}
                  aria-label="Message the assistant"
                  className="min-h-[44px] flex-1 resize-none rounded-xl border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                {canListen && (
                  <button type="button" onClick={toggleMic} aria-label={listening ? "Stop listening" : "Talk to the assistant"} aria-pressed={listening} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition", listening ? "border-rose-500 bg-rose-500 text-white" : "bg-surface text-muted hover:text-fg")}>
                    {listening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                )}
                <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg transition hover:brightness-110 disabled:opacity-50"><Send size={17} /></button>
              </div>
              {!canListen && <p className="mt-2 text-[11px] text-muted">Voice input needs Chrome, Edge or Safari. Typing works everywhere.</p>}
            </form>
          )}
        </section>
      )}
    </>
  );
}
