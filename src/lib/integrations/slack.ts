import { db } from "@/lib/db";

export interface SlackConfig {
  webhookUrl: string;
  botToken?: string;
  channelId?: string;
  notifyOnLeadCreated?: boolean;
  notifyOnConversion?: boolean;
}

export async function sendSlackNotification(message: string, webhookUrl: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
        mrkdwn: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }
    return true;
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return false;
  }
}

export async function notifyNewLead(leadId: string, slackConfig: SlackConfig) {
  if (!slackConfig.notifyOnLeadCreated) return;

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { contact: true, assignedUser: true },
  });

  if (!lead) return;

  const message = `
🎯 *New Lead*
Name: ${lead.contact.name}
Service: ${lead.service}
Source: ${lead.source}
Assigned: ${lead.assignedUser?.name || "Unassigned"}
  `;

  await sendSlackNotification(message, slackConfig.webhookUrl);
}

export async function notifyConversion(dealId: string, slackConfig: SlackConfig) {
  if (!slackConfig.notifyOnConversion) return;

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: { lead: { include: { contact: true } } },
  });

  if (!deal) return;

  const message = `
🎉 *Conversion*
Customer: ${deal.lead.contact.name}
Service: ${deal.service}
Amount: $${deal.amount}
  `;

  await sendSlackNotification(message, slackConfig.webhookUrl);
}
