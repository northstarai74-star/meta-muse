import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { json, route } from "@/lib/api";
import { testToken } from "@/lib/meta";
import { ELEVENLABS_BASE, OPENROUTER_BASE } from "@/lib/assistant";

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
      } else if (key.provider === "OPENROUTER") {
        const res = await fetch(`${OPENROUTER_BASE}/auth/key`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15_000) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error?.message ?? `OpenRouter said ${res.status} — the key looks invalid`);
        const d = body?.data ?? {};
        detail = `OpenRouter key valid${d.label ? ` (“${d.label}”)` : ""}${typeof d.limit_remaining === "number" ? ` · $${d.limit_remaining.toFixed(2)} credit left` : ""}`;
      } else if (key.provider === "ELEVENLABS") {
        const res = await fetch(`${ELEVENLABS_BASE}/user`, { headers: { "xi-api-key": secret }, signal: AbortSignal.timeout(15_000) });
        const body = await res.json().catch(() => ({}));
        if (res.status === 401 && body?.detail?.status === "missing_permissions") {
          // A restricted key can speak but isn't allowed to read the account — accepted, just not fully verifiable.
          return json({ ok: true, untested: true, detail: "Key accepted, but it's restricted so it can't be fully verified. Try the voice in the assistant." });
        }
        if (!res.ok) throw new Error(body?.detail?.message ?? `ElevenLabs said ${res.status} — the key looks invalid`);
        detail = "ElevenLabs key valid";
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
