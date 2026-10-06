import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { json, route } from "@/lib/api";
import { testToken } from "@/lib/meta";
import { testHiggsfieldKey } from "@/lib/higgsfield";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(
  async (_req, { params }) => {
    const { id } = await params;
    const key = await db.apiKey.findUnique({ where: { id } });
    if (!key) return json({ error: "Key not found" }, 404);
    const secret = decrypt(key.encryptedValue);

    try {
      let detail = "";
      if (key.provider === "CLAUDE") {
        await new Anthropic({ apiKey: secret }).models.list({ limit: 1 });
        detail = "Claude API key is valid";
      } else if (key.provider === "META") {
        const me = await testToken(secret);
        detail = `Meta token valid for “${me.name}”`;
      } else {
        await testHiggsfieldKey(secret);
        detail = "Higgsfield credentials accepted";
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
