import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/shell";
import { TasksView } from "@/components/tasks-view";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const me = await getCurrentUser();
  const include = {
    lead: { select: { id: true, service: true, contact: { select: { name: true } } } },
    assignedUser: { select: { name: true } },
  };
  const [open, done] = await Promise.all([
    db.task.findMany({ where: { done: false }, orderBy: { dueAt: "asc" }, take: 500, include }),
    db.task.findMany({ where: { done: true }, orderBy: { doneAt: "desc" }, take: 15, include }),
  ]);
  const shape = (t: (typeof open)[number]) => ({
    id: t.id,
    title: t.title,
    dueAt: t.dueAt.toISOString().slice(0, 10),
    done: t.done,
    assignedUserId: t.assignedUserId,
    assignee: t.assignedUser?.name ?? null,
    lead: { id: t.lead.id, name: t.lead.contact.name, service: t.lead.service },
  });

  return (
    <>
      <PageHeader title="Follow-ups" subtitle="Reminders to chase leads — add them from any lead" />
      <TasksView today={new Date().toISOString().slice(0, 10)} meId={me?.id ?? ""} open={open.map(shape)} done={done.map(shape)} />
    </>
  );
}
