import { db } from "@/lib/db";

export interface WebhookConfig {
  url: string;
  events: ("lead:created" | "lead:converted" | "lead:assigned" | "deal:created")[];
  active: boolean;
}

export async function deliverWebhook(event: string, payload: unknown, webhookUrl: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vanita-Event": event,
        "X-Vanita-Timestamp": new Date().toISOString(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.statusText}`);
    }
    return true;
  } catch (error) {
    console.error("Failed to deliver webhook:", error);
    return false;
  }
}

export async function notifyLeadCreated(leadId: string, webhookUrl: string) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { contact: true },
  });

  if (!lead) return;

  const payload = {
    event: "lead:created",
    timestamp: new Date().toISOString(),
    data: {
      leadId: lead.id,
      contactName: lead.contact.name,
      email: lead.contact.email,
      service: lead.service,
      source: lead.source,
      stage: lead.stage,
    },
  };

  return deliverWebhook("lead:created", payload, webhookUrl);
}

export async function notifyLeadConverted(dealId: string, webhookUrl: string) {
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: { lead: { include: { contact: true } } },
  });

  if (!deal) return;

  const payload = {
    event: "deal:created",
    timestamp: new Date().toISOString(),
    data: {
      dealId: deal.id,
      leadId: deal.leadId,
      contactName: deal.lead.contact.name,
      service: deal.service,
      amount: deal.amount,
      paidAt: deal.paidAt,
    },
  };

  return deliverWebhook("deal:created", payload, webhookUrl);
}
