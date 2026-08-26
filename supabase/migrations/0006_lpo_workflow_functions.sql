-- ============================================================================
-- 0006_lpo_workflow_functions.sql
-- All controlled LPO status transitions live here as SECURITY DEFINER
-- functions. This is the ONLY sanctioned way to change an LPO's status --
-- there is intentionally no UPDATE grant on lpos.status for any role, so
-- the frontend (or a compromised anon key) cannot forge a transition.
-- Each function re-validates the caller's permission and the business rule
-- itself; it does not trust the caller to have already checked.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CREATE LPO (status = draft)
-- ----------------------------------------------------------------------------
create or replace function create_lpo(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_cement_company_id uuid,
  p_cement_product_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_replaces_lpo_id uuid default null
) returns lpos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lpo lpos;
  v_settings system_settings;
  v_customer customers;
  v_vehicle vehicles;
  v_company cement_companies;
  v_product cement_products;
  v_seq bigint;
  v_subtotal numeric(14,2);
  v_vat numeric(14,2);
  v_total numeric(14,2);
begin
  if not auth_has_permission('lpo.create') then
    raise exception 'PERMISSION_DENIED: you are not permitted to create LPOs';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'VALIDATION: quantity must be greater than zero';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'VALIDATION: unit price cannot be negative';
  end if;

  select * into v_customer from customers where id = p_customer_id and status = 'active';
  if not found then
    raise exception 'VALIDATION: customer not found or inactive';
  end if;

  select * into v_vehicle from vehicles where id = p_vehicle_id and status = 'active';
  if not found then
    raise exception 'VALIDATION: vehicle not found or inactive';
  end if;
  if v_vehicle.customer_id <> p_customer_id then
    raise exception 'VALIDATION: vehicle does not belong to the selected customer';
  end if;

  select * into v_company from cement_companies where id = p_cement_company_id and status = 'active';
  if not found then
    raise exception 'VALIDATION: cement company not found or inactive';
  end if;

  select * into v_product from cement_products where id = p_cement_product_id and status = 'active';
  if not found then
    raise exception 'VALIDATION: cement product not found or inactive';
  end if;
  if v_product.cement_company_id <> p_cement_company_id then
    raise exception 'VALIDATION: product does not belong to the selected cement company';
  end if;

  if p_replaces_lpo_id is not null then
    if not exists (
      select 1 from lpos
      where id = p_replaces_lpo_id
      and status = 'cancelled'
    ) then
      raise exception 'VALIDATION: replaced LPO must exist and be cancelled';
    end if;
  end if;

  select * into v_settings from system_settings;

  v_subtotal := round(p_quantity * p_unit_price, 2);
  v_vat := round(v_subtotal * v_settings.vat_rate / 100.0, 2);
  v_total := round(v_subtotal + v_vat, 2);

  v_seq := nextval('lpo_number_seq');

  insert into lpos (
    lpo_number, sequence_number,
    customer_id, vehicle_id, cement_company_id, cement_product_id,
    quantity, unit_price, subtotal, vat_rate, vat_amount, total_amount, currency,
    status,
    customer_name_snapshot, vehicle_registration_snapshot,
    cement_company_name_snapshot, cement_product_name_snapshot,
    unit_snapshot, terms_snapshot,
    replaces_lpo_id, created_by
  ) values (
    format_lpo_number(v_seq), v_seq,
    p_customer_id, p_vehicle_id, p_cement_company_id, p_cement_product_id,
    p_quantity, p_unit_price, v_subtotal, v_settings.vat_rate, v_vat, v_total, v_settings.currency,
    'draft',
    v_customer.name, v_vehicle.registration_number,
    v_company.name, v_product.name,
    v_product.unit, v_settings.terms_and_conditions,
    p_replaces_lpo_id, auth.uid()
  ) returning * into v_lpo;

  insert into lpo_items (lpo_id, cement_product_id, product_name_snapshot, unit_snapshot, quantity, unit_price, line_subtotal)
  values (v_lpo.id, p_cement_product_id, v_product.name, v_product.unit, p_quantity, p_unit_price, v_subtotal);

  insert into lpo_status_history (lpo_id, from_status, to_status, changed_by)
  values (v_lpo.id, null, 'draft', auth.uid());

  perform write_audit_log('LPO_CREATED', 'lpo', v_lpo.id, jsonb_build_object(
    'lpo_number', v_lpo.lpo_number, 'customer', v_customer.name, 'vehicle', v_vehicle.registration_number
  ));

  return v_lpo;
end;
$$;

-- ----------------------------------------------------------------------------
-- SUBMIT FOR APPROVAL (draft -> pending_approval)
-- ----------------------------------------------------------------------------
create or replace function submit_lpo(p_lpo_id uuid)
returns lpos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lpo lpos;
begin
  select * into v_lpo from lpos where id = p_lpo_id for update;
  if not found then
    raise exception 'NOT_FOUND: LPO does not exist';
  end if;

  if not (auth_has_permission('lpo.submit') and v_lpo.created_by = auth.uid())
     and not auth_has_permission('lpo.view_all') then
    raise exception 'PERMISSION_DENIED: you cannot submit this LPO';
  end if;

  if v_lpo.status <> 'draft' then
    raise exception 'INVALID_TRANSITION: only a draft LPO can be submitted (current status: %)', v_lpo.status;
  end if;

  update lpos
  set status = 'pending_approval', submitted_by = auth.uid(), submitted_at = now()
  where id = p_lpo_id
  returning * into v_lpo;

  insert into lpo_status_history (lpo_id, from_status, to_status, changed_by)
  values (p_lpo_id, 'draft', 'pending_approval', auth.uid());

  perform write_audit_log('LPO_SUBMITTED', 'lpo', p_lpo_id, jsonb_build_object('lpo_number', v_lpo.lpo_number));

  return v_lpo;
end;
$$;

-- ----------------------------------------------------------------------------
-- APPROVE (pending_approval -> approved)
-- The creator may never approve their own LPO, even if they also hold the
-- manager role.
-- ----------------------------------------------------------------------------
create or replace function approve_lpo(p_lpo_id uuid)
returns lpos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lpo lpos;
begin
  if not auth_has_permission('lpo.approve') then
    raise exception 'PERMISSION_DENIED: you are not permitted to approve LPOs';
  end if;

  select * into v_lpo from lpos where id = p_lpo_id for update;
  if not found then
    raise exception 'NOT_FOUND: LPO does not exist';
  end if;

  if v_lpo.created_by = auth.uid() then
    raise exception 'PERMISSION_DENIED: you cannot approve an LPO you created yourself';
  end if;

  if v_lpo.status <> 'pending_approval' then
    raise exception 'INVALID_TRANSITION: only a pending LPO can be approved (current status: %)', v_lpo.status;
  end if;

  update lpos
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_lpo_id
  returning * into v_lpo;

  insert into lpo_approvals (lpo_id, decided_by, decision) values (p_lpo_id, auth.uid(), 'approved');
  insert into lpo_status_history (lpo_id, from_status, to_status, changed_by)
  values (p_lpo_id, 'pending_approval', 'approved', auth.uid());

  perform write_audit_log('LPO_APPROVED', 'lpo', p_lpo_id, jsonb_build_object('lpo_number', v_lpo.lpo_number));

  return v_lpo;
end;
$$;

-- ----------------------------------------------------------------------------
-- REJECT (pending_approval -> rejected)
-- ----------------------------------------------------------------------------
create or replace function reject_lpo(p_lpo_id uuid, p_reason text)
returns lpos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lpo lpos;
begin
  if not auth_has_permission('lpo.approve') then
    raise exception 'PERMISSION_DENIED: you are not permitted to reject LPOs';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'VALIDATION: a rejection reason is required';
  end if;

  select * into v_lpo from lpos where id = p_lpo_id for update;
  if not found then
    raise exception 'NOT_FOUND: LPO does not exist';
  end if;
  if v_lpo.created_by = auth.uid() then
    raise exception 'PERMISSION_DENIED: you cannot decide on an LPO you created yourself';
  end if;
  if v_lpo.status <> 'pending_approval' then
    raise exception 'INVALID_TRANSITION: only a pending LPO can be rejected (current status: %)', v_lpo.status;
  end if;

  update lpos
  set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejection_reason = p_reason
  where id = p_lpo_id
  returning * into v_lpo;

  insert into lpo_approvals (lpo_id, decided_by, decision, reason) values (p_lpo_id, auth.uid(), 'rejected', p_reason);
  insert into lpo_status_history (lpo_id, from_status, to_status, changed_by, reason)
  values (p_lpo_id, 'pending_approval', 'rejected', auth.uid(), p_reason);

  perform write_audit_log('LPO_REJECTED', 'lpo', p_lpo_id, jsonb_build_object('lpo_number', v_lpo.lpo_number, 'reason', p_reason));

  return v_lpo;
end;
$$;

-- ----------------------------------------------------------------------------
-- MARK ISSUED (approved -> issued)
-- Called by the approve-lpo Edge Function once the PDF has been generated
-- and notification attempts have been recorded. Not exposed for direct
-- frontend use in normal operation, but protected by the same permission
-- check regardless (the Edge Function acts using the manager's session,
-- not a blanket service-role bypass, wherever practical).
-- ----------------------------------------------------------------------------
create or replace function mark_lpo_issued(p_lpo_id uuid, p_pdf_storage_path text)
returns lpos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lpo lpos;
begin
  select * into v_lpo from lpos where id = p_lpo_id for update;
  if not found then
    raise exception 'NOT_FOUND: LPO does not exist';
  end if;
  if v_lpo.status <> 'approved' then
    raise exception 'INVALID_TRANSITION: only an approved LPO can be issued (current status: %)', v_lpo.status;
  end if;

  update lpos
  set status = 'issued', pdf_storage_path = p_pdf_storage_path, pdf_generated_at = now()
  where id = p_lpo_id
  returning * into v_lpo;

  insert into lpo_status_history (lpo_id, from_status, to_status, changed_by)
  values (p_lpo_id, 'approved', 'issued', auth.uid());

  perform write_audit_log('LPO_ISSUED', 'lpo', p_lpo_id, jsonb_build_object('lpo_number', v_lpo.lpo_number));

  return v_lpo;
end;
$$;

-- ----------------------------------------------------------------------------
-- MARK COLLECTED (issued -> collected)
-- ----------------------------------------------------------------------------
create or replace function mark_lpo_collected(p_lpo_id uuid)
returns lpos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lpo lpos;
begin
  if not (auth_has_permission('lpo.approve') or auth_has_permission('lpo.view_all')) then
    raise exception 'PERMISSION_DENIED: you are not permitted to mark an LPO as collected';
  end if;

  select * into v_lpo from lpos where id = p_lpo_id for update;
  if not found then
    raise exception 'NOT_FOUND: LPO does not exist';
  end if;
  if v_lpo.status <> 'issued' then
    raise exception 'INVALID_TRANSITION: only an issued LPO can be marked collected (current status: %)', v_lpo.status;
  end if;

  update lpos set status = 'collected', collected_at = now(), collected_by = auth.uid()
  where id = p_lpo_id
  returning * into v_lpo;

  insert into lpo_status_history (lpo_id, from_status, to_status, changed_by)
  values (p_lpo_id, 'issued', 'collected', auth.uid());

  perform write_audit_log('LPO_COLLECTED', 'lpo', p_lpo_id, jsonb_build_object('lpo_number', v_lpo.lpo_number));

  return v_lpo;
end;
$$;

-- ----------------------------------------------------------------------------
-- CANCEL (approved | issued -> cancelled)
-- ----------------------------------------------------------------------------
create or replace function cancel_lpo(p_lpo_id uuid, p_reason text)
returns lpos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lpo lpos;
  v_previous_status lpo_status;
begin
  if not auth_has_permission('lpo.cancel') then
    raise exception 'PERMISSION_DENIED: you are not permitted to cancel LPOs';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'VALIDATION: a cancellation reason is required';
  end if;

  select * into v_lpo from lpos where id = p_lpo_id for update;
  if not found then
    raise exception 'NOT_FOUND: LPO does not exist';
  end if;
  if v_lpo.status not in ('approved', 'issued') then
    raise exception 'INVALID_TRANSITION: only an approved or issued LPO can be cancelled (current status: %)', v_lpo.status;
  end if;
  v_previous_status := v_lpo.status;

  update lpos
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancellation_reason = p_reason
  where id = p_lpo_id
  returning * into v_lpo;

  insert into lpo_status_history (lpo_id, from_status, to_status, changed_by, reason)
  values (p_lpo_id, v_previous_status, 'cancelled', auth.uid(), p_reason);

  perform write_audit_log('LPO_CANCELLED', 'lpo', p_lpo_id, jsonb_build_object('lpo_number', v_lpo.lpo_number, 'reason', p_reason));

  return v_lpo;
end;
$$;
