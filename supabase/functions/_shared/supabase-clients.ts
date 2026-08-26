import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

/**
 * A client that carries the CALLER's JWT (from the Authorization header),
 * so every query and RPC call it makes is still subject to RLS and the
 * `auth.uid()` inside our SECURITY DEFINER functions resolves to the real
 * signed-in user -- not to the service role. Use this for anything that
 * should respect "who is doing this" (e.g. calling approve_lpo).
 */
export function userScopedClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

/**
 * A client using the service role key. Bypasses RLS entirely. Use ONLY for
 * operations that must run regardless of the caller's row-level
 * visibility -- e.g. writing the generated PDF to Storage, or recording a
 * notification result after the fact. Never send this client's results
 * back to the browser without re-checking the caller's permission first.
 */
export function serviceRoleClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export async function getCallerId(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}
