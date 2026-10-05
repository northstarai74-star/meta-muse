"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Input, Label, Textarea, Toggle } from "./ui";
import { DEFAULT_INSTRUCTIONS } from "@/lib/assistant-defaults";

type S = { demoMode: boolean; autoAssign: boolean; claudeModel: string; assistantModel: string; assistantInstructions: string; voiceId: string; speakReplies: boolean };

type Tpl = { id: string; title: string; body: string };

function QuickReplies({ templates }: { templates: Tpl[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [err, setErr] = React.useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body }) });
    if (!res.ok) return setErr((await res.json().catch(() => ({}))).error ?? "Could not save");
    setTitle("");
    setBody("");
    router.refresh();
  }
  async function remove(id: string) {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Quick replies" subtitle="Saved messages you can insert in the Inbox. Use {{name}} for the contact's first name." />
      <ul className="divide-y border-t">
        {templates.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0"><p className="text-sm font-medium">{t.title}</p><p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.body}</p></div>
            <button onClick={() => remove(t.id)} aria-label={`Delete ${t.title}`} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-rose-600"><Trash2 size={15} /></button>
          </li>
        ))}
        {templates.length === 0 && <li className="px-5 py-4 text-xs text-muted">No quick replies yet.</li>}
      </ul>
      <form onSubmit={add} className="space-y-2 border-t p-5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Pricing intro" maxLength={60} required />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi {{name}}, thanks for reaching out…" maxLength={1000} required />
        {err && <p className="text-xs text-rose-600">{err}</p>}
        <Button type="submit" variant="primary" size="sm">Add quick reply</Button>
      </form>
    </Card>
  );
}

export function SettingsView({ settings, templates, isAdmin }: { settings: S; templates: Tpl[]; isAdmin: boolean }) {
  const router = useRouter();
  const [s, setS] = React.useState(settings);
  const [model, setModel] = React.useState(settings.claudeModel);
  const [err, setErr] = React.useState("");
  const [aModel, setAModel] = React.useState(settings.assistantModel);
  const [voice, setVoice] = React.useState(settings.voiceId);
  const [instr, setInstr] = React.useState(settings.assistantInstructions);
  const [saved, setSaved] = React.useState(false);

  async function save(patch: Partial<S>) {
    setErr("");
    setS((cur) => ({ ...cur, ...patch }));
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) {
      setS(settings);
      setErr((await res.json().catch(() => ({}))).error ?? "Could not save");
    } else router.refresh();
  }

  const rows: { key: "demoMode" | "autoAssign"; title: string; desc: string }[] = [
    { key: "demoMode", title: "Demo mode", desc: "Uses built-in heuristics instead of calling Claude, and never sends messages through Meta. Turn off once Meta and a Claude key are connected." },
    { key: "autoAssign", title: "Auto-assign new leads", desc: "Route every new lead to an AI agent or team member using the rules on the Team page." },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {!isAdmin && <p className="rounded-xl border bg-surface-2 px-4 py-3 text-sm text-muted">Only admins can change settings.</p>}
      {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
      <Card>
        <CardHeader title="Workspace" />
        <ul className="divide-y px-5 pb-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-6 py-4">
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted">{r.desc}</p>
              </div>
              <Toggle label={r.title} checked={s[r.key]} onChange={(v) => isAdmin && save({ [r.key]: v })} />
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Claude" subtitle="Model used to classify leads and draft replies" />
        <div className="px-5 pb-5">
          <Label>Model ID</Label>
          <Input value={model} disabled={!isAdmin} onChange={(e) => setModel(e.target.value)} onBlur={() => model !== s.claudeModel && model.trim() && save({ claudeModel: model.trim() })} />
          <p className="mt-2 text-xs text-muted">Default: claude-sonnet-5-5. Changes save when you click away.</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Assistant" subtitle="The chat/voice assistant (bottom-right of every page). Add its OpenRouter and ElevenLabs keys in Integrations." />
        <div className="space-y-4 px-5 pb-5">
          <div>
            <Label>Model (OpenRouter ID)</Label>
            <Input value={aModel} disabled={!isAdmin} onChange={(e) => setAModel(e.target.value)} onBlur={() => aModel.trim() && aModel !== s.assistantModel && save({ assistantModel: aModel.trim() })} />
            <p className="mt-1.5 text-xs text-muted">Default <code>openrouter/auto</code> lets OpenRouter pick a model. Use a specific ID such as <code>anthropic/claude-sonnet-4.5</code> for consistent answers. It must support tool calling.</p>
          </div>
          <div>
            <Label>ElevenLabs voice ID</Label>
            <Input value={voice} disabled={!isAdmin} onChange={(e) => setVoice(e.target.value)} onBlur={() => voice.trim() && voice !== s.voiceId && save({ voiceId: voice.trim() })} />
            <p className="mt-1.5 text-xs text-muted">Copy a voice ID from your ElevenLabs voice library. Default is the built-in &ldquo;Rachel&rdquo; voice.</p>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div><p className="text-sm font-medium">Speak replies aloud</p><p className="mt-0.5 text-xs text-muted">Reads each answer in the ElevenLabs voice. Can also be toggled in the chat panel.</p></div>
            <Toggle label="Speak replies aloud" checked={s.speakReplies} onChange={(v) => isAdmin && save({ speakReplies: v })} />
          </div>
          <div>
            <Label>Instructions</Label>
            <Textarea className="min-h-44" value={instr} disabled={!isAdmin} onChange={(e) => { setInstr(e.target.value); setSaved(false); }} placeholder={DEFAULT_INSTRUCTIONS} maxLength={4000} />
            <p className="mt-1.5 text-xs text-muted">How the assistant should behave: tone, priorities, what to focus on. Leave blank to use the built-in instructions shown in grey. Safety rules (it can&apos;t message customers, delete data or move reserves) always apply.</p>
            {isAdmin && (
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="primary" onClick={async () => { await save({ assistantInstructions: instr }); setSaved(true); }}>Save instructions</Button>
                <Button size="sm" onClick={async () => { setInstr(""); await save({ assistantInstructions: "" }); setSaved(true); }}>Reset to default</Button>
                {saved && <span role="status" className="text-xs text-emerald-600">Saved</span>}
              </div>
            )}
          </div>
        </div>
      </Card>
      <QuickReplies templates={templates} />
    </div>
  );
}
