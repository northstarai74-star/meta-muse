/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, commas and newlines inside quotes, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type ProspectRow = {
  name?: string; email?: string; phone?: string; company?: string;
  website?: string; industry?: string; country?: string; instagramHandle?: string;
};

const ALIASES: Record<keyof ProspectRow | "firstName" | "lastName", string[]> = {
  name: ["name", "fullname", "contact", "contactname"],
  firstName: ["firstname", "first"],
  lastName: ["lastname", "last", "surname"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "telephone", "tel", "mobile", "phonenumber"],
  company: ["company", "companyname", "business", "businessname", "organisation", "organization"],
  website: ["website", "url", "site", "web", "domain"],
  industry: ["industry", "niche", "category", "sector", "type"],
  country: ["country", "location", "region", "city"],
  instagramHandle: ["instagram", "instagramhandle", "ig", "handle"],
};

/** Maps a header row + data rows to prospect objects by common column names. */
export function toProspects(table: string[][]): { rows: ProspectRow[]; unmapped: string[] } {
  if (table.length < 2) return { rows: [], unmapped: [] };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const headers = table[0].map(norm);
  const index = (key: keyof typeof ALIASES) => headers.findIndex((h) => ALIASES[key].includes(h));
  const idx = Object.fromEntries((Object.keys(ALIASES) as (keyof typeof ALIASES)[]).map((k) => [k, index(k)])) as Record<keyof typeof ALIASES, number>;
  const used = new Set(Object.values(idx).filter((i) => i >= 0));
  const unmapped = table[0].filter((_, i) => !used.has(i)).map((h) => h.trim()).filter(Boolean);

  const rows = table.slice(1).map((r) => {
    const get = (k: keyof typeof ALIASES) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
    const name = get("name") || [get("firstName"), get("lastName")].filter(Boolean).join(" ");
    const out: ProspectRow = {};
    const put = (k: keyof ProspectRow, v: string) => { if (v) out[k] = v; };
    put("name", name); put("email", get("email")); put("phone", get("phone")); put("company", get("company"));
    put("website", get("website")); put("industry", get("industry")); put("country", get("country")); put("instagramHandle", get("instagramHandle"));
    return out;
  });
  return { rows, unmapped };
}
