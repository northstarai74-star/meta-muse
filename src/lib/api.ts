import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "./session";
import { hasValidToken } from "./tokens";

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Wraps a route handler: 401 if not signed in, maps zod/thrown errors to JSON. */
export function route<Ctx = unknown>(
  handler: (req: Request, ctx: Ctx, user: User) => Promise<Response>,
  opts: { admin?: boolean } = {},
) {
  return async (req: Request, ctx: Ctx) => {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (opts.admin && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admins only" }, { status: 403 });
    }
    return guarded(() => handler(req, ctx, user));
  };
}

/** Maps zod and thrown errors to JSON responses. */
async function guarded(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues.map((i) => i.message).join("; ") }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Like route(), but also accepts an automation token (`Authorization: Bearer nsk_…`), for n8n and other tools.
 * Use only on endpoints that are safe to expose to automation; everything else stays session-only.
 */
export function tokenRoute(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (!(await hasValidToken(req)) && !(await getCurrentUser())) {
      return NextResponse.json({ error: "Unauthorized: send a valid Bearer token" }, { status: 401 });
    }
    return guarded(() => handler(req));
  };
}

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init } : init);
