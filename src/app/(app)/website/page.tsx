import { getCurrentUser } from "@/lib/session";
import { getSite } from "@/lib/website";
import { PageHeader } from "@/components/shell";
import { WebsiteView } from "@/components/website-view";

export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  const [me, site] = await Promise.all([getCurrentUser(), getSite()]);
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return (
    <>
      <PageHeader title="Website" subtitle="Edit the public website's content and control when it is live" />
      <WebsiteView initial={site} isAdmin={me?.role === "ADMIN"} publicUrl={`${base}/api/public/site`} />
    </>
  );
}
