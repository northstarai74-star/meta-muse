import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { InboxView } from "@/components/inbox-view";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const [templates, convos] = await Promise.all([
    db.template.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, title: true, body: true } }),
    db.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      messages: { orderBy: { sentAt: "asc" } },
      contact: { include: { leads: { orderBy: { createdAt: "desc" }, take: 1, include: { assignedUser: { select: { name: true } } } } } },
    },
  }),
  ]);

  return (
    <>
      <PageHeader title="Instagram Inbox" subtitle="Direct messages from your connected Instagram business account" />
      <InboxView
        templates={templates}
        initialId={c ?? convos[0]?.id ?? null}
        convos={convos.map((v) => ({
          id: v.id,
          unread: v.unread,
          lastMessageAt: v.lastMessageAt.toISOString(),
          contact: { id: v.contact.id, name: v.contact.name, handle: v.contact.instagramHandle, email: v.contact.email, phone: v.contact.phone },
          lead: v.contact.leads[0]
            ? { id: v.contact.leads[0].id, service: v.contact.leads[0].service, stage: v.contact.leads[0].stage, score: v.contact.leads[0].score, owner: v.contact.leads[0].assignedUser?.name ?? null }
            : null,
          messages: v.messages.map((m) => ({ id: m.id, direction: m.direction, text: m.text, sentAt: m.sentAt.toISOString() })),
        }))}
      />
    </>
  );
}
