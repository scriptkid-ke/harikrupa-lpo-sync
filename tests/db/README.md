# Database tests (pgTAP)

`workflow.test.sql` exercises the LPO state machine and RLS directly
against Postgres, independent of the frontend.

## Prerequisites

```bash
supabase start
supabase db reset
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local service role> npx tsx supabase/seed/seed-users.ts
psql "$(supabase status -o json | jq -r '.DB_URL')" -f supabase/seed/seed.sql
```

## The `tests.authenticate_as()` helper

These tests assume the [`supabase_test_helpers`](https://github.com/usebasejump/supabase-test-helpers)
extension (or an equivalent local helper schema) is installed, providing:

```sql
create or replace function tests.authenticate_as(identifier text) returns void ...
```

which sets `request.jwt.claims`/`role` for the current session so
`auth.uid()` resolves the way it would for a real signed-in user. If you'd
rather not add that extension, replace each `select tests.authenticate_as(...)`
line with:

```sql
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from auth.users where email = 'employee@harikrupa.test'))::text,
  true);
set local role authenticated;
```

## Running

```bash
supabase test db
```

or directly with pgTAP's runner:

```bash
pg_prove --dbname postgres -h 127.0.0.1 -p 54322 -U postgres tests/db/*.sql
```
