import { db } from "./db";
import { decrypt } from "./crypto";
import { ProviderError, withKey } from "./keys";

// Higgsfield API (https://docs.higgsfield.ai): async jobs, `Authorization: Key KEY_ID:KEY_SECRET`.
// Submit to a model endpoint → get a request_id → poll /requests/{id}/status until completed/failed/nsfw.
export const HIGGSFIELD_API = "https://api.higgsfield.ai";
export const HIGGSFIELD_IMAGE_MODEL = "flux-pro/kontext/max/text-to-image";
export const ASPECTS = ["1:1", "4:5", "9:16", "16:9"] as const;
export const FINAL_STATUSES = ["completed", "failed", "nsfw"];

export type HiggsfieldJob = {
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw";
  request_id: string;
  images?: { url: string }[];
  video?: { url: string };
};

/** Higgsfield credentials are a single "KEY_ID:KEY_SECRET" string. */
export const isHiggsfieldCredential = (s: string) => /^[^:\s]+:[^:\s]+$/.test(s);

function detailOf(body: unknown) {
  const d = (body as { detail?: unknown })?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => (x as { msg?: string })?.msg).filter(Boolean).join("; ");
  return "";
}

async function hf<T>(path: string, credentials: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HIGGSFIELD_API}${path}`, {
    ...init,
    headers: { Authorization: `Key ${credentials}`, "Content-Type": "application/json", Accept: "application/json" },
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON answers come from something in between (proxy, firewall, CDN), not from Higgsfield.
    if (!res.ok) throw new ProviderError(`Couldn't reach Higgsfield (HTTP ${res.status}): ${text.slice(0, 160)}`, 502);
  }
  if (!res.ok) {
    const msg =
      res.status === 401
        ? "Invalid Higgsfield credentials"
        : res.status === 403
          ? "Not enough Higgsfield credits"
          : detailOf(body) || `Higgsfield error ${res.status}`;
    // 401 disables the key and 403 (no credits) takes it out of rotation, so withKey tries the next one.
    throw new ProviderError(msg, res.status);
  }
  return body as T;
}

/** Starts an image generation. Returns the job plus the vault key that owns it (needed to poll it). */
export async function submitImage(prompt: string, aspect: string) {
  return withKey("HIGGSFIELD", async (credentials, keyId) => {
    const job = await hf<HiggsfieldJob>(`/${HIGGSFIELD_IMAGE_MODEL}`, credentials, {
      method: "POST",
      body: JSON.stringify({ prompt, aspect_ratio: aspect, safety_tolerance: 2 }),
    });
    return { job, keyId };
  });
}

/** Polls a job with the same key that submitted it (requests belong to that Higgsfield account). */
export async function fetchJob(requestId: string, apiKeyId: string | null) {
  const key = apiKeyId ? await db.apiKey.findUnique({ where: { id: apiKeyId } }) : null;
  if (!key) throw new Error("The Higgsfield key that started this job was deleted");
  return hf<HiggsfieldJob>(`/requests/${encodeURIComponent(requestId)}/status`, decrypt(key.encryptedValue));
}

/**
 * Verifies credentials without spending credits: asks for the status of a request that can't exist.
 * Bad credentials get 401; good ones get past auth to "not found" (404, or 400/422 for the made-up ID).
 */
export async function testHiggsfieldKey(credentials: string) {
  if (!isHiggsfieldCredential(credentials)) throw new Error("Higgsfield keys are entered as KEY_ID:KEY_SECRET");
  try {
    await hf("/requests/00000000-0000-0000-0000-000000000000/status", credentials);
  } catch (err) {
    if (err instanceof ProviderError && [400, 404, 422].includes(err.status ?? 0)) return;
    throw err;
  }
}
