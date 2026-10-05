import { z } from "zod";
import { json, route } from "@/lib/api";
import { LAWFUL_BASIS, SERVICES, STAGES } from "@/lib/constants";
import { ingestProspect } from "@/lib/ingest";

const opt = z.string().trim().max(300).optional();
const Row = z.object({ name: opt, email: opt, phone: opt, company: opt, website: opt, industry: opt, country: opt, instagramHandle: opt });

const Body = z.object({
  rows: z.array(Row).min(1).max(100, "Send at most 100 rows per request"),
  service: z.enum(SERVICES),
  stage: z.enum(STAGES).default("CONTACTED"),
  source: z.enum(["COLD_EMAIL", "IMPORT"]).default("COLD_EMAIL"),
  lawfulBasis: z.enum(Object.keys(LAWFUL_BASIS) as [string, ...string[]], { error: "Choose the lawful basis for contacting these prospects" }),
});

const emailOk = (s: string) => z.string().email().safeParse(s).success;

/** Imports one chunk of prospects as contacts + leads. The browser sends big lists in chunks of 50. */
export const POST = route(async (req) => {
  const b = Body.parse(await req.json());
  const out = { created: 0, duplicate: 0, doNotContact: 0, invalid: 0, errors: [] as { row: number; reason: string }[] };

  for (const [i, row] of b.rows.entries()) {
    if (!row.email && !row.phone) { out.invalid++; out.errors.push({ row: i, reason: "Needs an email or a phone number" }); continue; }
    if (row.email && !emailOk(row.email)) { out.invalid++; out.errors.push({ row: i, reason: `Invalid email: ${row.email}` }); continue; }
    try {
      const r = await ingestProspect(row, { source: b.source, service: b.service, stage: b.stage, lawfulBasis: b.lawfulBasis });
      if (r.status === "created") out.created++;
      else if (r.status === "duplicate") out.duplicate++;
      else out.doNotContact++;
    } catch (err) {
      out.invalid++;
      out.errors.push({ row: i, reason: err instanceof Error ? err.message : "Could not import" });
    }
  }
  return json(out);
});
