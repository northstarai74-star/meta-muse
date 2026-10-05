import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { json, route } from "@/lib/api";
import { testToken } from "@/lib/meta";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(
  async (_req, { params }) => {
    const { id } = await params;
    const key = await db.apiKey.findUnique({ where: { id } });
    if (!key) return json({ error: "Key not found" }, 404);
    const secret = decrypt(key.encryptedValue);

    try {
      let detail = "";
      if (key.provider === "OPENROUTER") {
        const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${secret}` } });
        if (!res.ok) throw new Error(`OpenRouter rejected the key (${res.status})`);
        detail = "OpenRouter API key is valid";
      } else if (key.provider === "META") {
        const me = await testToken(secret);
        detail = `Meta token valid for “${me.name}”`;
      } else {
        // Higgsfield: no verified public test endpoint is wired up yet, so we don't pretend to check it.
        return json({ ok: true, untested: true, detail: "Stored securely. Live verification isn't available for Higgsfield yet." });
      }
      await db.apiKey.update({ where: { id }, data: { status: "ACTIVE", lastError: null } });
      return json({ ok: true, detail });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test failed";
      await db.apiKey.update({ where: { id }, data: { lastError: message.slice(0, 300) } });
      return json({ ok: false, detail: message }, 200);
    }
  },
  { admin: true },
);
