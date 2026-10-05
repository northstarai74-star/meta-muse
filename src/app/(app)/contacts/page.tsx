import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { ContactsView } from "@/components/contacts-view";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await db.contact.findMany({
    orderBy: { createdAt: "desc" },
    include: { leads: { include: { assignedUser: { select: { name: true, avatarColor: true } }, deals: true } } },
  });

  return (
    <>
      <PageHeader title="Contacts" subtitle="Your CRM — everyone who has reached out or bought" />
      <ContactsView
        contacts={contacts.map((c) => {
          const owner = c.leads.find((l) => l.assignedUser)?.assignedUser ?? null;
          return {
            id: c.id,
            doNotContact: c.doNotContact,
            name: c.name,
            email: c.email,
            phone: c.phone,
            instagramHandle: c.instagramHandle,
            company: c.company,
            source: c.source,
            leadCount: c.leads.length,
            services: [...new Set(c.leads.map((l) => l.service))],
            lifetimeValue: c.leads.flatMap((l) => l.deals).reduce((s, d) => s + d.amount, 0),
            owner,
          };
        })}
      />
    </>
  );
}
