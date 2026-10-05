import { PageHeader } from "@/components/shell";
import { ImportView } from "@/components/import-view";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Import prospects" subtitle="Load a cold-email or outreach list from a CSV. Each row becomes a contact and a lead you can track and follow up." />
      <ImportView />
    </>
  );
}
