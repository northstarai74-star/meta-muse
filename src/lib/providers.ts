import { ProviderError, withKey } from "./keys";
import { db } from "./db";
import type { Provider } from "./constants";

// Graph API version for WhatsApp Cloud API calls.
const GRAPH = "https://graph.facebook.com/v21.0";

/** Fetch that turns non-2xx responses into ProviderErrors carrying the HTTP status (so withKey can rotate keys). */
async function call<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | string | undefined;
    const message = typeof err === "string" ? err : err?.message ?? (data.message as string) ?? `HTTP ${res.status}`;
    throw new ProviderError(message, res.status);
  }
  return data as T;
}

// ---------- WhatsApp Cloud API (key format: PHONE_NUMBER_ID:ACCESS_TOKEN) ----------

export const isWhatsAppCredential = (s: string) => /^\d+:[^:\s]+$/.test(s);
const parseWhatsApp = (secret: string) => {
  const [phoneNumberId, token] = secret.split(":");
  return { phoneNumberId, token };
};

export async function testWhatsApp(secret: string) {
  const { phoneNumberId, token } = parseWhatsApp(secret);
  const d = await call<{ display_phone_number?: string; verified_name?: string }>(
    `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return `WhatsApp number ${d.display_phone_number ?? phoneNumberId}${d.verified_name ? ` (${d.verified_name})` : ""}`;
}

/** Sends a WhatsApp text message to a phone number (international format, digits only). */
export async function sendWhatsAppText(to: string, text: string) {
  return withKey("WHATSAPP", async (secret) => {
    const { phoneNumberId, token } = parseWhatsApp(secret);
    const d = await call<{ messages?: { id: string }[] }>(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    return d.messages?.[0]?.id ?? null;
  });
}

// ---------- Brevo (key = v3 API key) ----------

const BREVO = "https://api.brevo.com/v3";
const brevoHeaders = (key: string) => ({ "api-key": key, "Content-Type": "application/json", Accept: "application/json" });

export async function testBrevo(secret: string) {
  const a = await call<{ email?: string; companyName?: string }>(`${BREVO}/account`, { headers: brevoHeaders(secret) });
  return `Brevo account ${a.email ?? ""}${a.companyName ? ` (${a.companyName})` : ""}`.trim();
}

export type Sender = { email: string; name: string };

/** Sender identity used for outgoing mail, set on the Email page. */
export async function getSender(): Promise<Sender | null> {
  const rows = await db.setting.findMany({ where: { key: { in: ["email.senderEmail", "email.senderName"] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return map["email.senderEmail"] ? { email: map["email.senderEmail"], name: map["email.senderName"] || "" } : null;
}

export async function sendEmail(input: { to: string[]; subject: string; text: string }) {
  const sender = await getSender();
  if (!sender) throw new Error("Set a sender email on the Email page first");
  return withKey("BREVO", (secret) =>
    call(`${BREVO}/smtp/email`, {
      method: "POST",
      headers: brevoHeaders(secret),
      body: JSON.stringify({ sender, to: input.to.map((email) => ({ email })), subject: input.subject, textContent: input.text }),
    }),
  );
}

/** Adds or updates a contact in Brevo (and its list, if given). Used to keep Brevo in step with the CRM. */
export async function upsertBrevoContact(c: { email: string; name?: string; listId?: number }) {
  return withKey("BREVO", (secret) =>
    call(`${BREVO}/contacts`, {
      method: "POST",
      headers: brevoHeaders(secret),
      body: JSON.stringify({
        email: c.email,
        attributes: c.name ? { FIRSTNAME: c.name } : undefined,
        listIds: c.listId ? [c.listId] : undefined,
        updateEnabled: true,
      }),
    }),
  );
}

// ---------- LinkedIn (key = OAuth access token with openid/profile scope) ----------

export async function testLinkedIn(secret: string) {
  const u = await call<{ name?: string; email?: string }>("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${secret}` },
  });
  return `LinkedIn signed in as ${u.name ?? u.email ?? "member"}`;
}

// ---------- YouTube Data API (key = Google API key) ----------

export async function testYouTube(secret: string) {
  await call(`https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&key=${encodeURIComponent(secret)}`);
  return "YouTube Data API key accepted";
}

/** Runs the credential check for any provider with a stored key; returns a human-readable result. */
export async function testProviderKey(provider: Provider, secret: string): Promise<string> {
  switch (provider) {
    case "WHATSAPP":
      return testWhatsApp(secret);
    case "BREVO":
      return testBrevo(secret);
    case "LINKEDIN":
      return testLinkedIn(secret);
    case "YOUTUBE":
      return testYouTube(secret);
    default:
      throw new Error(`No connection test for ${provider}`);
  }
}
