import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { LeadsView } from "@/components/leads-view";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; open?: string; service?: string; stage?: string }> }) {
  const sp = await searchParams;
  const [leads, users] = await Promise.all([
    db.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { id: true, name: true, instagramHandle: true, email: true, phone: true, company: true } } },
    }),
    db.user.findMany({ select: { id: true, name: true, avatarColor: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Leads" subtitle="Everything captured from Instagram DMs, comments and Meta lead ads" />
      <LeadsView
        initialQuery={sp.q ?? ""}
        initialOpen={sp.open ?? null}
        initialService={sp.service ?? "ALL"}
        initialStage={sp.stage ?? "ALL"}
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
          contact: l.contact,
        }))}
      />
    </>
  );
}
