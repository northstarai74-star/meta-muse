import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Optimistic gate only: refreshes the Supabase session and redirects signed-out visitors to /login.
// Route handlers and server components still verify the user themselves.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const { response, signedIn } = await updateSession(req);

  // /login is never redirected away from: a Supabase session can outlive its app user row (e.g. after a reseed),
  // and bouncing to "/" would then loop with the layout's redirect back to /login.
  if (pathname === "/login") return response;
  if (!signedIn) {
    const redirect = NextResponse.redirect(new URL("/login", req.url));
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  // Everything except API (handlers self-authenticate; Meta webhook must stay public) and static assets
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
