import { db } from "./db";
import { createClient } from "./supabase/server";

/** Current app user for the Supabase session (server components / route handlers), or null if signed out or not a team member. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const authId = data?.claims?.sub;
  if (!authId) return null;
  return db.user.findUnique({
    where: { authId },
    select: { id: true, name: true, email: true, role: true, title: true, avatarColor: true },
  });
}
