import { z } from "zod";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { json, route } from "@/lib/api";
import { getConnection } from "@/lib/meta";

const Body = z.object({
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  pageId: z.string().optional(),
  igBusinessId: z.string().optional(),
  accessToken: z.string().optional(),
});

/** Saves Meta app credentials. Blank secret fields keep the existing stored value. */
export const PUT = route(
  async (req) => {
    const b = Body.parse(await req.json());
    await getConnection();
    await db.metaConnection.update({
      where: { id: "singleton" },
      data: {
        appId: b.appId?.trim() || undefined,
        pageId: b.pageId?.trim() || undefined,
        igBusinessId: b.igBusinessId?.trim() || undefined,
        appSecretEnc: b.appSecret?.trim() ? encrypt(b.appSecret.trim()) : undefined,
        accessTokenEnc: b.accessToken?.trim() ? encrypt(b.accessToken.trim()) : undefined,
      },
    });
    return json({ ok: true });
  },
  { admin: true },
);
