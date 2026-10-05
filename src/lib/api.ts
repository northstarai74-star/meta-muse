import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "./session";

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
    try {
      return await handler(req, ctx, user);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ error: err.issues.map((i) => i.message).join("; ") }, { status: 400 });
      }
      const message = err instanceof Error ? err.message : "Server error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init } : init);
