import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { LeadsView } from "@/components/leads-view";
import { isStale, lastActivityByLead } from "@/lib/followups";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; open?: string; service?: string; attention?: string }> }) {
  const sp = await searchParams;
  const [leads, users] = await Promise.all([
    db.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { contact: { select: { id: true, name: true, instagramHandle: true, email: true, phone: true, company: true } } },
    }),
    db.user.findMany({ select: { id: true, name: true, avatarColor: true }, orderBy: { name: "asc" } }),
  ]);

  const last = await lastActivityByLead(leads.map((l) => l.id));

  return (
    <>
      <PageHeader title="Leads" subtitle="Everything captured from Instagram DMs, comments and Meta lead ads" />
      <LeadsView
        initialQuery={sp.q ?? ""}
        initialOpen={sp.open ?? null}
        initialService={sp.service ?? "ALL"}
        initialAttention={sp.attention === "1"}
        users={users}
        leads={leads.map((l) => ({
          id: l.id,
          title: l.title,
          source: l.source,
          service: l.service,
          stage: l.stage,
          score: l.score,
          assignedAgent: l.assignedAgent,
          assignedUserId: l.assignedUserId,
          estimatedValue: l.estimatedValue,
          createdAt: l.createdAt.toISOString(),
          lastActivityAt: (last.get(l.id) ?? l.createdAt).toISOString(),
          stale: isStale(l.stage, l.createdAt, last.get(l.id)),
          lostReason: l.lostReason,
          contact: l.contact,
        }))}
      />
    </>
  );
}
