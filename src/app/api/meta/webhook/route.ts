import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getConnection, verifySignature } from "@/lib/meta";
import { enqueue } from "@/lib/jobs";
import { kick } from "@/lib/worker";
import type { MetaEntry } from "@/lib/meta-events";

// Public endpoint (excluded from the login proxy). Protected by Meta's verify token + HMAC signature.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const conn = await getConnection();
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === conn.verifyToken
  ) {
    await db.metaConnection.update({ where: { id: "singleton" }, data: { connected: true } });
    return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const conn = await getConnection();
  const secret = conn.appSecretEnc ? decrypt(conn.appSecretEnc) : null;

  if (!secret || !verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let payload: { object?: string; entry?: MetaEntry[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Persist first, process second: Meta gets its 200 immediately and the job queue retries failures.
  for (const entry of payload.entry ?? []) await enqueue("META_EVENT", { entry });
  after(kick);
  return NextResponse.json({ received: true });
}
