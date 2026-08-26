import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True once real Supabase credentials are present. The rest of the app
 * (main.tsx) checks this before rendering the real router, so a missing
 * .env produces a clear "Configure Supabase" screen instead of a blank
 * white page — createClient() throws synchronously on an invalid URL,
 * and that throw happens at module-import time, before React has a DOM
 * node to render an error into.
 */
export const isSupabaseConfigured = Boolean(
  rawUrl && rawAnonKey && /^https?:\/\//.test(rawUrl)
);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your project values, then restart `npm run dev`.'
  );
}

// Fall back to a syntactically valid placeholder URL when unconfigured so
// createClient() never throws at import time. Every real request against
// this placeholder will fail at the network layer (caught and surfaced by
// normal try/catch in services), which is fine — the app has already
// rendered its "Configure Supabase" screen by then.
export const supabase = createClient<Database>(
  isSupabaseConfigured ? rawUrl! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? rawAnonKey! : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

const supabaseUrl = rawUrl ?? '';
const supabaseAnonKey = rawAnonKey ?? '';

/**
 * Invoke a Supabase Edge Function with the current session's access token
 * attached, and return the parsed JSON body regardless of status code so
 * callers can inspect partial-success (207) responses from approve-lpo.
 */
export async function invokeFunction<T = any>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
    
  });

  const json = await res.json();
  if (!res.ok && res.status !== 207) {
    throw new Error(json?.error ?? `${name} failed with status ${res.status}`);
  }
  return json as T;
}
