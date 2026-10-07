import { db } from "@/lib/db";

export interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  notifyOnLeadCreated?: boolean;
  notifyOnConversion?: boolean;
  recipientEmail: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  smtpConfig: Omit<EmailConfig, "recipientEmail" | "enabled">
) {
  try {
    // In production, use nodemailer or similar
    // For now, log the email
    console.log("Email would be sent:", { to, subject });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function notifyNewLead(leadId: string, emailConfig: EmailConfig) {
  if (!emailConfig.notifyOnLeadCreated) return;

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { contact: true },
  });

  if (!lead) return;

  const html = `
    <h2>New Lead: ${lead.contact.name}</h2>
    <p><strong>Service:</strong> ${lead.service}</p>
    <p><strong>Source:</strong> ${lead.source}</p>
    <p><strong>Email:</strong> ${lead.contact.email || "N/A"}</p>
    <p><strong>Phone:</strong> ${lead.contact.phone || "N/A"}</p>
  `;

  return sendEmail(
    emailConfig.recipientEmail,
    `New Lead: ${lead.contact.name}`,
    html,
    emailConfig
  );
}

export async function notifyConversion(dealId: string, emailConfig: EmailConfig) {
  if (!emailConfig.notifyOnConversion) return;

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: { lead: { include: { contact: true } } },
  });

  if (!deal) return;

  const html = `
    <h2>Conversion: ${deal.lead.contact.name}</h2>
    <p><strong>Service:</strong> ${deal.service}</p>
    <p><strong>Amount:</strong> $${deal.amount}</p>
    <p><strong>Date:</strong> ${deal.paidAt?.toLocaleDateString()}</p>
  `;

  return sendEmail(
    emailConfig.recipientEmail,
    `Conversion: ${deal.lead.contact.name} - $${deal.amount}`,
    html,
    emailConfig
  );
}
