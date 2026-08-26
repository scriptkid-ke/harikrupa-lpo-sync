-- ============================================================================
-- seed.sql
-- Development seed data for business entities. Run AFTER seed-users.ts has
-- created the three auth accounts (admin/manager/employee), because
-- customers/vehicles/etc. reference profiles.id via created_by.
--
--   supabase db reset          # applies migrations fresh
--   npm run seed:users         # creates auth users + profiles (see seed-users.ts)
--   psql "$DATABASE_URL" -f supabase/seed/seed.sql
--
-- No real personal phone numbers, emails, or credentials are used here.
-- ============================================================================

do $$
declare
  v_admin_id uuid;
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_ndovu_id uuid;
  v_simba_id uuid;
  v_savannah_id uuid;
  v_nyumba_id uuid;
begin
  select id into v_admin_id from profiles where email = 'admin@harikrupa.test';

  if v_admin_id is null then
    raise notice 'Seed users not found -- run seed-users.ts first. Skipping business seed.';
    return;
  end if;

  -- Customer -----------------------------------------------------------------
  insert into customers (name, phone, email, address, tax_pin, sms_recipient, status, created_by)
  values ('Chirex General Hardware', '+254700000001', 'accounts@chirex.test',
          'Industrial Area, Nairobi', 'P000000000A', '+254700000001', 'active', v_admin_id)
  returning id into v_customer_id;

  -- Vehicle --------------------------------------------------------------------
  insert into vehicles (registration_number, customer_id, status, created_by)
  values ('KAQ 188W', v_customer_id, 'active', v_admin_id)
  returning id into v_vehicle_id;

  insert into vehicles (registration_number, customer_id, status, created_by)
  values ('KDB 442T', v_customer_id, 'active', v_admin_id);

  -- Cement companies -----------------------------------------------------------
  insert into cement_companies (name, email, additional_emails, phone, address, status, created_by)
  values ('Ndovu Cement', 'orders@ndovucement.test', '{}', '+254700000010', 'Athi River, Kenya', 'active', v_admin_id)
  returning id into v_ndovu_id;

  insert into cement_companies (name, email, additional_emails, phone, address, status, created_by)
  values ('Simba Cement', 'orders@simbacement.test', array['dispatch@simbacement.test']::citext[], '+254700000011', 'Mombasa Road, Kenya', 'active', v_admin_id)
  returning id into v_simba_id;

  insert into cement_companies (name, email, additional_emails, phone, address, status, created_by)
  values ('Savannah Cement', 'orders@savannahcement.test', '{}', '+254700000012', 'Athi River, Kenya', 'active', v_admin_id)
  returning id into v_savannah_id;

  insert into cement_companies (name, email, additional_emails, phone, address, status, created_by)
  values ('Nyumba Cement', 'orders@nyumbacement.test', '{}', '+254700000013', 'Nairobi, Kenya', 'active', v_admin_id)
  returning id into v_nyumba_id;

  -- Products --------------------------------------------------------------------
  insert into cement_products (cement_company_id, name, description, unit, default_unit_price, status, created_by) values
    (v_ndovu_id,    'Ndovu Cement 50kg',    'Ordinary Portland Cement, 42.5N', 'bags', 650.00, 'active', v_admin_id),
    (v_simba_id,    'Simba Cement 50kg',    'Ordinary Portland Cement, 42.5N', 'bags', 660.00, 'active', v_admin_id),
    (v_simba_id,    'Simba Duracem 50kg',   'Blended cement for masonry work', 'bags', 640.00, 'active', v_admin_id),
    (v_savannah_id, 'Savannah Cement 50kg', 'Ordinary Portland Cement, 42.5N', 'bags', 655.00, 'active', v_admin_id),
    (v_nyumba_id,   'Nyumba Cement 50kg',   'Ordinary Portland Cement, 42.5N', 'bags', 645.00, 'active', v_admin_id);

  raise notice 'Business seed data inserted successfully.';
end $$;
