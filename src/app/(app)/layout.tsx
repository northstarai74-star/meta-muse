import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { dueNowWhere } from "@/lib/followups";
import { assistantStatus } from "@/lib/assistant";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [inbox, comments, tasks, settings, assistant] = await Promise.all([
    db.conversation.aggregate({ _sum: { unread: true } }),
    db.comment.count({ where: { handled: false } }),
    db.task.count({ where: dueNowWhere() }),
    getSettings(),
    assistantStatus(),
  ]);

  return (
    <Shell user={user} counts={{ inbox: inbox._sum.unread ?? 0, comments, tasks }} demoMode={settings.demoMode} assistant={assistant}>
      {children}
    </Shell>
  );
}
