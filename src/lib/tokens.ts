import { createHash, randomBytes } from "crypto";
import { db } from "./db";

const PREFIX = "nsk_";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a token. The plaintext is returned once and never stored; only its SHA-256 hash is kept. */
export async function createApiToken(label: string) {
  const token = PREFIX + randomBytes(32).toString("base64url");
  const row = await db.apiToken.create({
    data: { label, tokenHash: hash(token), hint: token.slice(-4) },
    select: { id: true, label: true, hint: true, createdAt: true },
  });
  return { ...row, token };
}

/** True when the request carries a valid `Authorization: Bearer nsk_…` token. */
export async function hasValidToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(nsk_[A-Za-z0-9_-]+)$/.exec(header);
  if (!m) return false;
  const row = await db.apiToken.findUnique({ where: { tokenHash: hash(m[1]) }, select: { id: true } });
  if (!row) return false;
  await db.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return true;
}
