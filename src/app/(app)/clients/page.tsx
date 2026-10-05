import { db } from "@/lib/db";
import { clientStats } from "@/lib/ops";
import { PageHeader } from "@/components/shell";
import { ClientsView } from "@/components/clients-view";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [s, contacts] = await Promise.all([clientStats(), db.contact.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 1000 })]);
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  return (
    <>
      <PageHeader title="Active clients" subtitle="Who you're serving right now, what they pay, and when they renew" />
      <ClientsView
        kpis={s.kpis}
        byService={s.byService}
        contacts={contacts.map((c) => ({ value: c.id, label: c.name }))}
        renewalIds={s.renewals.map((c) => c.id)}
        today={new Date().toISOString().slice(0, 10)}
        clients={s.clients.map((c) => ({ id: c.id, contactId: c.contactId, name: c.contact.name, company: c.contact.company, service: c.service, monthlyFee: c.monthlyFee, status: c.status, startedAt: day(c.startedAt), renewsAt: day(c.renewsAt), notes: c.notes ?? "" }))}
      />
    </>
  );
}
