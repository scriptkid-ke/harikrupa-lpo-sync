-- ============================================================================
-- 0009_storage.sql
-- Supabase Storage buckets. `lpo-pdfs` is private -- PDFs are only ever
-- served through short-lived signed URLs requested by the frontend for a
-- user who already passes the `lpos` RLS select policy. `company-assets`
-- is public and holds only the company logo used on the PDF/login screen.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lpo-pdfs', 'lpo-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-assets', 'company-assets', true, 5242880, array['image/png','image/jpeg','image/svg+xml','image/webp'])
on conflict (id) do nothing;

-- lpo-pdfs: no client INSERT/UPDATE policy -- only the Edge Function
-- (service role) writes PDFs. Authenticated users may only SELECT (read/
-- generate a signed URL for) a PDF belonging to an LPO they're allowed to
-- see, mirroring the `lpos` RLS policy exactly.
create policy "lpo_pdfs_select_permitted"
  on storage.objects for select
  using (
    bucket_id = 'lpo-pdfs'
    and exists (
      select 1 from public.lpos l
      where l.pdf_storage_path = storage.objects.name
      and (l.created_by = auth.uid() or public.auth_has_permission('lpo.view_all'))
    )
  );

-- company-assets: readable by everyone (bucket is public); only admins can
-- upload/replace the logo.
create policy "company_assets_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'company-assets' and public.auth_has_permission('settings.manage'));

create policy "company_assets_admin_update"
  on storage.objects for update
  using (bucket_id = 'company-assets' and public.auth_has_permission('settings.manage'));
