import { PageHeader } from "@/components/shell";
import { CustomerServiceView } from "@/components/customer-service-view";

export const dynamic = "force-dynamic";

export default function CustomerServicePage() {
  return (
    <>
      <PageHeader title="Customer Service" subtitle="Automated follow-up for new enquiries: Airtable, Vapi voice calls and Gmail." />
      <CustomerServiceView />
    </>
  );
}
