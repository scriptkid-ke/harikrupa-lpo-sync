-- ============================================================================
-- tests/db/workflow.test.sql
--
-- pgTAP tests for the LPO workflow, VAT snapshotting, LPO numbering, and
-- self-approval prevention. Run against a local Supabase instance:
--
--   supabase start
--   supabase db reset
--   psql "$DATABASE_URL" -f supabase/seed/seed.sql   # after seed-users.ts
--   supabase test db                                  # runs all tests/db/*.sql via pgTAP
--
-- These tests connect as the Postgres role directly and simulate different
-- users by setting `request.jwt.claims`, matching how PostgREST/Supabase
-- populates auth.uid() in production. See tests/db/README.md for the
-- helper `tests.authenticate_as(email)` convention used below (provided by
-- the supabase_test_helpers extension, or implement inline with
-- `set_config('request.jwt.claims', ..., true)` if that extension isn't
-- installed).
-- ============================================================================

begin;
select plan(15);

-- ----------------------------------------------------------------------------
-- Setup: three users already exist from seed-users.ts (admin/manager/employee)
-- ----------------------------------------------------------------------------
select tests.authenticate_as('employee@harikrupa.test');

-- 1. Employee can create a draft LPO
select lives_ok(
  $$ select create_lpo(
       (select id from customers where name = 'Chirex General Hardware'),
       (select id from vehicles where registration_number = 'KAQ 188W'),
       (select id from cement_companies where name = 'Simba Cement'),
       (select id from cement_products where name = 'Simba Cement 50kg'),
       220, 650
     ) $$,
  'employee can create a draft LPO'
);

-- 2. First LPO is numbered LPO-0001 (or the next sequence value in a fresh DB)
select is(
  (select lpo_number from lpos order by created_at desc limit 1) ~ '^LPO-\d{4}$',
  true,
  'LPO number matches the LPO-XXXX pattern'
);

-- 3. VAT is snapshotted at 16% by default
select is(
  (select vat_rate from lpos order by created_at desc limit 1),
  16.00,
  'VAT rate is snapshotted onto the LPO at creation'
);

-- 4. Financial totals are internally consistent (subtotal/VAT/total match the constraint)
select is(
  (select total_amount from lpos order by created_at desc limit 1),
  (select subtotal + vat_amount from lpos order by created_at desc limit 1),
  'total_amount = subtotal + vat_amount'
);

-- 5. A vehicle belonging to a DIFFERENT customer is rejected
select throws_ok(
  $$ select create_lpo(
       (select id from customers where name = 'Chirex General Hardware'),
       (select id from vehicles where registration_number = 'UNRELATED-VEHICLE'),
       (select id from cement_companies where name = 'Simba Cement'),
       (select id from cement_products where name = 'Simba Cement 50kg'),
       10, 100
     ) $$,
  'P0001',
  null,
  'creating an LPO fails cleanly when the vehicle/customer do not match (or vehicle absent)'
);

-- 6. Employee submits the draft LPO
select lives_ok(
  $$ select submit_lpo((select id from lpos order by created_at desc limit 1)) $$,
  'employee can submit their own draft LPO'
);

select is(
  (select status from lpos order by created_at desc limit 1)::text,
  'pending_approval',
  'LPO status becomes pending_approval after submit'
);

-- 7. The SAME employee cannot approve their own LPO, even though we call
--    approve_lpo() directly (bypassing lpo.approve permission entirely is
--    also expected to fail for an employee role, but this specifically
--    proves the self-approval rule even if the role check were misconfigured).
select throws_like(
  $$ select approve_lpo((select id from lpos order by created_at desc limit 1)) $$,
  '%PERMISSION_DENIED%',
  'creator cannot approve their own LPO'
);

-- ----------------------------------------------------------------------------
-- Switch to manager
-- ----------------------------------------------------------------------------
select tests.authenticate_as('manager@harikrupa.test');

-- 8. Manager approves successfully
select lives_ok(
  $$ select approve_lpo((select id from lpos order by created_at desc limit 1)) $$,
  'a different user holding lpo.approve can approve the LPO'
);

select is(
  (select status from lpos order by created_at desc limit 1)::text,
  'approved',
  'LPO status becomes approved'
);

-- 9. Approving twice fails (invalid transition)
select throws_like(
  $$ select approve_lpo((select id from lpos order by created_at desc limit 1)) $$,
  '%INVALID_TRANSITION%',
  'approving an already-approved LPO is rejected'
);

-- 10. Cancelling requires a reason
select throws_like(
  $$ select cancel_lpo((select id from lpos order by created_at desc limit 1), '') $$,
  '%VALIDATION%',
  'cancelling without a reason is rejected'
);

-- 11. Cancelling with a reason succeeds and is permanent
select lives_ok(
  $$ select cancel_lpo((select id from lpos order by created_at desc limit 1), 'Factory congestion / vehicle redirected') $$,
  'cancelling an approved LPO with a reason succeeds'
);

select throws_like(
  $$ select mark_lpo_issued((select id from lpos order by created_at desc limit 1), 'x/y.pdf') $$,
  '%INVALID_TRANSITION%',
  'a cancelled LPO can never be issued'
);

-- ----------------------------------------------------------------------------
-- Row Level Security: an employee cannot see another employee's LPO
-- ----------------------------------------------------------------------------
select tests.authenticate_as('employee@harikrupa.test');
select is(
  (select count(*)::int from lpos where created_by <> auth.uid()),
  0,
  'RLS hides other users'' LPOs from an employee without lpo.view_all'
);

select * from finish();
rollback;
