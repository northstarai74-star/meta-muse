"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileUp } from "lucide-react";
import { Button, Card, CardHeader, Label, Select, Textarea } from "./ui";
import { LAWFUL_BASIS, SERVICES, SERVICE_META, STAGES, STAGE_META } from "@/lib/constants";
import { parseCsv, toProspects, type ProspectRow } from "@/lib/csv";

const CHUNK = 50;
const MAX_ROWS = 5000;
const TEMPLATE = "name,email,phone,company,website,industry,country\nJane Smith,jane@smilebright.co.uk,,Smile Bright Dental,smilebright.co.uk,dental clinic,UK\n";

type Totals = { created: number; duplicate: number; doNotContact: number; invalid: number; errors: { row: number; reason: string }[] };

export function ImportView() {
  const [text, setText] = React.useState("");
  const [service, setService] = React.useState("AI_VOICE");
  const [stage, setStage] = React.useState("CONTACTED");
  const [source, setSource] = React.useState("COLD_EMAIL");
  const [basis, setBasis] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [totals, setTotals] = React.useState<Totals | null>(null);
  const [err, setErr] = React.useState("");

  const parsed = React.useMemo(() => toProspects(parseCsv(text)), [text]);
  const rows: ProspectRow[] = parsed.rows;
  const usable = rows.filter((r) => r.email || r.phone).length;
  const tooMany = rows.length > MAX_ROWS;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setText(await f.text());
    e.target.value = "";
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "prospects-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function run() {
    setBusy(true); setErr(""); setTotals(null); setProgress(0);
    const sum: Totals = { created: 0, duplicate: 0, doNotContact: 0, invalid: 0, errors: [] };
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const res = await fetch("/api/prospects/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: rows.slice(i, i + CHUNK), service, stage, source, lawfulBasis: basis }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        sum.created += data.created; sum.duplicate += data.duplicate; sum.doNotContact += data.doNotContact; sum.invalid += data.invalid;
        sum.errors.push(...data.errors.map((x: { row: number; reason: string }) => ({ row: x.row + i + 2, reason: x.reason })));
        setProgress(Math.min(rows.length, i + CHUNK));
        setTotals({ ...sum });
      }
    } catch (e) {
      setErr((e as Error).message + (sum.created ? ` (${sum.created} rows were imported before the error)` : ""));
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader
            title="1. Your list"
            subtitle="Paste CSV text or choose a file. Columns are matched by name: name, email, phone, company, website, industry, country."
            action={<Button size="sm" onClick={downloadTemplate}><Download size={14} /> Template</Button>}
          />
          <div className="space-y-3 px-5 pb-5">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm text-muted hover:bg-surface-2">
              <FileUp size={16} /> Choose a .csv file
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
            </label>
            <div>
              <Label>Or paste CSV</Label>
              <Textarea id="csv-text" rows={7} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={TEMPLATE} />
            </div>
            {text.trim() && (
              <div className="rounded-xl border bg-surface-2/50 p-3 text-sm">
                <p><span className="font-semibold">{rows.length}</span> rows found, <span className="font-semibold">{usable}</span> with an email or phone.</p>
                {parsed.unmapped.length > 0 && <p className="mt-1 text-xs text-muted">Ignored columns: {parsed.unmapped.join(", ")}</p>}
                {rows.length > 0 && usable === 0 && <p className="mt-1 text-xs text-rose-600">No row has an email or phone. Check that the first row holds the column names.</p>}
                {tooMany && <p className="mt-1 text-xs text-rose-600">Lists are limited to {MAX_ROWS} rows at a time.</p>}
                {rows.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-muted"><th className="py-1 pr-3 font-medium">Name</th><th className="pr-3 font-medium">Email</th><th className="pr-3 font-medium">Company</th><th className="font-medium">Industry</th></tr></thead>
                      <tbody>
                        {rows.slice(0, 5).map((r, i) => (
                          <tr key={i} className="border-t"><td className="py-1 pr-3">{r.name ?? "—"}</td><td className="pr-3">{r.email ?? r.phone ?? "—"}</td><td className="pr-3">{r.company ?? "—"}</td><td>{r.industry ?? "—"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="2. How to treat them" />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <div><Label>Service you are pitching</Label><Select id="imp-service" value={service} onChange={(e) => setService(e.target.value)}>{SERVICES.map((s) => <option key={s} value={s}>{SERVICE_META[s].label}</option>)}</Select></div>
            <div><Label>Starting stage</Label><Select id="imp-stage" value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.filter((s) => s !== "WON" && s !== "LOST").map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}</Select></div>
            <div><Label>Source</Label><Select id="imp-source" value={source} onChange={(e) => setSource(e.target.value)}><option value="COLD_EMAIL">Cold email</option><option value="IMPORT">Imported list (other)</option></Select></div>
            <div>
              <Label>Lawful basis for contacting them *</Label>
              <Select id="imp-basis" value={basis} onChange={(e) => setBasis(e.target.value)}>
                <option value="">Choose…</option>
                {Object.entries(LAWFUL_BASIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={run} disabled={busy || !usable || tooMany || !basis}>{busy ? `Importing… ${progress}/${rows.length}` : `Import ${usable || ""} prospects`}</Button>
          {!basis && usable > 0 && <span className="text-xs text-muted">Choose a lawful basis to continue.</span>}
        </div>
        {err && <p role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{err}</p>}
        {totals && (
          <Card className="p-5" role="status">
            <p className="text-sm font-semibold">{busy ? "Importing…" : "Import finished"}</p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              <li><span className="font-semibold tabular-nums">{totals.created}</span> new leads created</li>
              <li><span className="font-semibold tabular-nums">{totals.duplicate}</span> already in the pipeline (skipped)</li>
              <li><span className="font-semibold tabular-nums">{totals.doNotContact}</span> marked do-not-contact (skipped)</li>
              <li><span className="font-semibold tabular-nums">{totals.invalid}</span> rows with problems</li>
            </ul>
            {totals.errors.length > 0 && (
              <ul className="mt-3 max-h-40 space-y-0.5 overflow-y-auto text-xs text-rose-600">
                {totals.errors.slice(0, 30).map((x, i) => <li key={i}>Line {x.row}: {x.reason}</li>)}
              </ul>
            )}
            {!busy && <Link href="/leads" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">Open the leads →</Link>}
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader title="UK cold email: check before you send" />
        <div className="space-y-3 px-5 pb-5 text-sm text-muted">
          <p>Under UK PECR you can send B2B marketing email to <span className="font-medium text-fg">limited companies and LLPs</span> if you identify yourself and give a clear opt-out.</p>
          <p><span className="font-medium text-fg">Sole traders and most partnerships</span> count as individuals, and usually need their prior consent. Many salons and trades are sole traders.</p>
          <p>This tool records the basis you pick and skips anyone marked do-not-contact. It does not check the law for you, and this is not legal advice.</p>
          <p>Send from separate sending domains, never your main one, and keep every opt-out request as a do-not-contact on the contact.</p>
        </div>
      </Card>
    </div>
  );
}
