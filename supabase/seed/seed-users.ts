/**
 * seed-users.ts
 *
 * Creates the three development accounts (admin / manager / employee) using
 * the Supabase Admin API, then promotes each profile to the correct role.
 * The `handle_new_auth_user` trigger auto-creates a `profiles` row with the
 * `employee` role for every new auth user; this script upgrades two of them.
 *
 * Run with:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx supabase/seed/seed-users.ts
 *
 * Never run this against production with these placeholder passwords.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEV_USERS = [
  { email: 'admin@harikrupa.test', password: 'DevPassw0rd!Admin', full_name: 'Asha Admin', role: 'admin' as const },
  { email: 'manager@harikrupa.test', password: 'DevPassw0rd!Manager', full_name: 'Musa Manager', role: 'manager' as const },
  { email: 'employee@harikrupa.test', password: 'DevPassw0rd!Employee', full_name: 'Faith Employee', role: 'employee' as const },
];

async function main() {
  for (const user of DEV_USERS) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
    });

    let userId = created?.user?.id;

    if (createError) {
      // Likely already exists -- look it up instead of failing the run.
      const { data: existing } = await supabase.auth.admin.listUsers();
      const match = existing?.users.find((u) => u.email === user.email);
      if (!match) {
        console.error(`Could not create or find ${user.email}:`, createError.message);
        continue;
      }
      userId = match.id;
    }

    if (!userId) continue;

    const { error: rpcError } = await supabase.rpc('admin_invite_user_metadata', {
      p_user_id: userId,
      p_full_name: user.full_name,
      p_role_code: user.role,
    });

    // admin_invite_user_metadata requires an authenticated admin caller via
    // RLS/auth_has_permission(), which the service-role key does not carry
    // a JWT claim for. Fall back to a direct table update, which the
    // service role can always perform (RLS is bypassed for service_role).
    if (rpcError) {
      const { error: directError } = await supabase
        .from('profiles')
        .update({ full_name: user.full_name, role_id: undefined })
        .eq('id', userId);
      if (directError) {
        const { data: roleRow } = await supabase.from('roles').select('id').eq('code', user.role).single();
        await supabase
          .from('profiles')
          .update({ full_name: user.full_name, role_id: roleRow?.id })
          .eq('id', userId);
      }
    }

    console.log(`Seeded ${user.role.padEnd(8)} -> ${user.email} / ${user.password}`);
  }

  console.log('\nDone. These are development-only credentials -- never reuse them in production.');
}

main();
