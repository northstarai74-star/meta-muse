import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import type { Provider } from "./constants";

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export async function addKey(provider: Provider, label: string, secret: string, priority = 0) {
  return db.apiKey.create({
    data: {
      provider,
      label,
      priority,
      encryptedValue: encrypt(secret),
      keyHint: secret.slice(-4),
    },
  });
}

/**
 * Runs `fn` with an API key for the provider, rotating round-robin across ACTIVE keys
 * (lowest priority number first, then least-recently-used). A 429 marks the key
 * RATE_LIMITED, a 401/403 disables it; the next key is then tried automatically.
 * RATE_LIMITED keys are retried again after a 5 minute cool-down.
 */
export async function withKey<T>(provider: Provider, fn: (secret: string, keyId: string) => Promise<T>): Promise<T> {
  const cooldown = new Date(Date.now() - 5 * 60_000);
  await db.apiKey.updateMany({
    where: { provider, status: "RATE_LIMITED", lastUsedAt: { lt: cooldown } },
    data: { status: "ACTIVE" },
  });

  const keys = await db.apiKey.findMany({
    where: { provider, status: "ACTIVE" },
    orderBy: [{ priority: "asc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }],
  });
  if (keys.length === 0) throw new ProviderError(`No active ${provider} API key configured`);

  let lastErr: unknown;
  for (const k of keys) {
    try {
      const result = await fn(decrypt(k.encryptedValue), k.id);
      await db.apiKey.update({
        where: { id: k.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date(), lastError: null },
      });
      return result;
    } catch (err) {
      lastErr = err;
      const status = err instanceof ProviderError ? err.status : (err as { status?: number })?.status;
      const message = err instanceof Error ? err.message : String(err);
      const patch: { lastError: string; lastUsedAt: Date; status?: string } = {
        lastError: message.slice(0, 300),
        lastUsedAt: new Date(),
      };
      if (status === 429) patch.status = "RATE_LIMITED";
      else if (status === 401 || status === 403) patch.status = "DISABLED";
      await db.apiKey.update({ where: { id: k.id }, data: patch });
      // Only rotate on key-specific failures; other errors surface immediately.
      if (status !== 429 && status !== 401 && status !== 403) throw err;
    }
  }
  throw lastErr;
}
