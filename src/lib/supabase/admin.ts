import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server-side only: it bypasses Row Level Security and can manage auth users. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Creates a confirmed auth user, or resets the password of the existing one with that email. Returns the auth user id. */
export async function ensureAuthUser(email: string, password: string) {
  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.data.user) return created.data.user.id;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      const { error: upErr } = await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true });
      if (upErr) throw upErr;
      return found.id;
    }
    if (data.users.length < 200) break;
  }
  throw created.error ?? new Error(`Could not create auth user ${email}`);
}
