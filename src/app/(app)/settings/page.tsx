import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shell";
import { SettingsView } from "@/components/settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [me, settings, templates] = await Promise.all([getCurrentUser(), getSettings(), db.template.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, title: true, body: true } })]);
  return (
    <>
      <PageHeader title="Settings" subtitle="Workspace behaviour and AI configuration" />
      <SettingsView settings={settings} templates={templates} isAdmin={me?.role === "ADMIN"} />
    </>
  );
}
