import { PageHeader } from "@/components/shell";
import { FinanceView } from "@/components/finance-view";

export const dynamic = "force-dynamic";

export default function FinancePage() {
  return (
    <>
      <PageHeader title="Finance" subtitle="Track income and expenses for the business" />
      <FinanceView />
    </>
  );
}
