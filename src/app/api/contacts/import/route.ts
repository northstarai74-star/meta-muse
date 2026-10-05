import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { parseCsv } from "@/lib/csv";

const MAX_ROWS = 2000;
const Body = z.object({ csv: z.string().min(1, "The file is empty").max(2_000_000, "File is too large (2 MB max)") });

const ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "fullname", "full_name", "contact", "contact name"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "phone number", "mobile", "tel", "telephone"],
  instagramHandle: ["instagram", "instagram handle", "handle", "ig", "username"],
  company: ["company", "business", "organization", "organisation"],
  notes: ["notes", "note", "comments"],
};

const emailOk = z.string().email();

/** Bulk-create contacts from a CSV. Existing emails (and repeats inside the file) are skipped, not overwritten. */
export const POST = route(async (req) => {
  const { csv } = Body.parse(await req.json());
  const [header, ...rows] = parseCsv(csv);
  if (!header || rows.length === 0) return json({ error: "No rows found — the first row must be column headings" }, 400);
  if (rows.length > MAX_ROWS) return json({ error: `Too many rows (${MAX_ROWS} max per import)` }, 400);

  const norm = header.map((h) => h.trim().toLowerCase());
  const col = (key: string) => norm.findIndex((h) => ALIASES[key].includes(h));
  const idx = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)]));
  if (idx.name < 0 && idx.email < 0 && idx.instagramHandle < 0) {
    return json({ error: "Couldn't find a Name, Email or Instagram column in the first row" }, 400);
  }
  const cell = (r: string[], k: string) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");

  const existing = new Set(
    (await db.contact.findMany({ where: { email: { not: null } }, select: { email: true } })).map((c) => c.email!.toLowerCase()),
  );
  const data: {
    name: string; email: string | null; phone: string | null; instagramHandle: string | null; company: string | null; notes: string | null; source: string;
  }[] = [];
  const problems: string[] = [];
  let skipped = 0;

  rows.forEach((r, i) => {
    const email = cell(r, "email").toLowerCase();
    const handle = cell(r, "instagramHandle").replace(/^@/, "");
    const name = cell(r, "name") || handle || email;
    const line = i + 2;
    if (!name) { skipped++; problems.push(`Row ${line}: no name, email or Instagram handle`); return; }
    if (email && !emailOk.safeParse(email).success) { skipped++; problems.push(`Row ${line}: "${email}" isn't a valid email`); return; }
    if (email && existing.has(email)) { skipped++; return; }
    if (email) existing.add(email);
    data.push({
      name: name.slice(0, 120), email: email || null, phone: cell(r, "phone") || null, instagramHandle: handle || null,
      company: cell(r, "company") || null, notes: cell(r, "notes") || null, source: "MANUAL",
    });
  });

  if (data.length) await db.contact.createMany({ data });
  return json({ created: data.length, skipped, problems: problems.slice(0, 10) });
});
