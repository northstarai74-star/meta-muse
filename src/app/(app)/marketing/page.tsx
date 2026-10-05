import { marketingStats } from "@/lib/ops";
import { PageHeader } from "@/components/shell";
import { MarketingView } from "@/components/marketing-view";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const s = await marketingStats();
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  return (
    <>
      <PageHeader title="Marketing" subtitle="Campaigns, what they cost per lead, and your content calendar" />
      <MarketingView
        kpis={s.kpis}
        byChannel={s.byChannel}
        campaigns={s.campaigns.map((c) => ({ id: c.id, name: c.name, channel: c.channel, service: c.service, status: c.status, budget: c.budget, spend: c.spend, leadsGenerated: c.leadsGenerated, startsAt: day(c.startsAt), endsAt: day(c.endsAt), notes: c.notes ?? "" }))}
        content={s.content.map((c) => ({ id: c.id, title: c.title, channel: c.channel, status: c.status, scheduledFor: day(c.scheduledFor), caption: c.caption ?? "" }))}
      />
    </>
  );
}
