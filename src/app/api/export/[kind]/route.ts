import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { SERVICE_META, SOURCE_META, STAGE_META } from "@/lib/constants";

type Ctx = { params: Promise<{ kind: string }> };

const csv = (name: string, body: string) =>
  new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });

export const GET = route<Ctx>(async (_req, { params }) => {
  const { kind } = await params;

  if (kind === "leads") {
    const leads = await db.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: { contact: true, assignedUser: { select: { name: true } }, deals: { select: { amount: true } } },
    });
    return csv(
      "leads",
      toCsv(
        ["Name", "Email", "Phone", "Instagram", "Company", "Title", "Service", "Stage", "Score", "Source", "Handled by", "Team member", "Estimated value", "Revenue", "Lost reason", "Created"],
        leads.map((l) => [
          l.contact.name, l.contact.email, l.contact.phone, l.contact.instagramHandle, l.contact.company, l.title,
          SERVICE_META[l.service]?.label ?? l.service, STAGE_META[l.stage]?.label ?? l.stage, l.score, SOURCE_META[l.source] ?? l.source,
          l.assignedAgent === "AI" ? "AI agent" : "Human", l.assignedUser?.name, l.estimatedValue,
          l.deals.reduce((s, d) => s + d.amount, 0), l.lostReason, l.createdAt,
        ]),
      ),
    );
  }

  if (kind === "contacts") {
    const contacts = await db.contact.findMany({ orderBy: { createdAt: "desc" }, take: 10000, include: { leads: { select: { deals: { select: { amount: true } } } } } });
    return csv(
      "contacts",
      toCsv(
        ["Name", "Email", "Phone", "Instagram", "Company", "Notes", "Source", "Leads", "Lifetime value", "Created"],
        contacts.map((c) => [
          c.name, c.email, c.phone, c.instagramHandle, c.company, c.notes, SOURCE_META[c.source] ?? c.source, c.leads.length,
          c.leads.flatMap((l) => l.deals).reduce((s, d) => s + d.amount, 0), c.createdAt,
        ]),
      ),
    );
  }

  return json({ error: "Unknown export" }, 404);
});
