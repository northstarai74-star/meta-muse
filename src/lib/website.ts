import { db } from "./db";

/** Fields of the public website, stored as Setting rows named site.<field>. */
export const WEBSITE_FIELDS = ["published", "name", "headline", "subheadline", "about", "services", "ctaText", "ctaUrl", "email", "phone", "address"] as const;
export type SiteFields = Record<(typeof WEBSITE_FIELDS)[number], string>;

export async function getSite(): Promise<SiteFields> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: "site." } } });
  const map = Object.fromEntries(rows.map((r) => [r.key.slice(5), r.value]));
  return Object.fromEntries(WEBSITE_FIELDS.map((f) => [f, map[f] ?? ""])) as SiteFields;
}
