import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

export const SESSION_COOKIE = "bos_session";

export type SessionPayload = { uid: string; role: string };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https") === true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: payload.uid as string, role: payload.role as string };
  } catch {
    return null;
  }
}

/** Current user from the session cookie (server components / route handlers). */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, email: true, role: true, title: true, avatarColor: true },
  });
}
