import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shell";
import { SettingsView } from "@/components/settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [me, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  return (
    <>
      <PageHeader title="Settings" subtitle="Workspace behaviour and AI configuration" />
      <SettingsView settings={settings} isAdmin={me?.role === "ADMIN"} email={me?.email ?? ""} />
    </>
  );
}
