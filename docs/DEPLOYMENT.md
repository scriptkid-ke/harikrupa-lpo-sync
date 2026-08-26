# Deployment

## 1. Create the hosted Supabase project

1. Create a project at https://supabase.com/dashboard.
2. Note the **Project URL**, **anon public key**, and **service_role key**
   (Project Settings → API).

## 2. Push the database schema

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push        # applies every file in supabase/migrations/, in order
```

Verify in the Supabase dashboard (Table Editor) that `lpos`, `profiles`,
`audit_logs`, etc. exist, and that RLS is enabled on all of them
(Authentication → Policies, or `select * from pg_tables where rowsecurity`).

## 3. Create the first admin account

Sign-up is disabled (`enable_signup = false` in `supabase/config.toml`) —
accounts are provisioned by an admin, matching section 6/48 of the spec.
Bootstrap the very first admin from the CLI:

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npx tsx supabase/seed/seed-users.ts
```

Then, in the Supabase SQL editor, promote the account you'll actually use
day-to-day (the script seeds admin/manager/employee test accounts — replace
their emails/passwords for anything beyond a demo):

```sql
update profiles set role_id = (select id from roles where code = 'admin')
where email = 'you@harikrupa.co.ke';
```

From then on, use the in-app **Users** page (admin only) to invite and
manage further accounts.

## 4. Deploy Edge Functions and set secrets

```bash
supabase functions deploy generate-lpo-pdf send-lpo-email send-lpo-sms approve-lpo

supabase secrets set \
  SUPABASE_URL=https://<ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
  CELCOM_API_URL=https://isms.celcomafrica.com/api/services/sendsms/ \
  CELCOM_API_KEY=<key> \
  CELCOM_PARTNER_ID=<partner-id> \
  CELCOM_SHORTCODE=HARIKRUPA \
  EMAIL_PROVIDER=resend \
  EMAIL_API_KEY=<resend-key> \
  EMAIL_FROM_ADDRESS=lpo@harikrupa.co.ke \
  EMAIL_FROM_NAME="Harikrupa LPO Desk" \
  NOTIFICATION_MODE=development \
  APP_URL=https://your-app-domain.com
```

Leave `NOTIFICATION_MODE=development` until you're ready to send real SMS
and email — it mocks both providers and still exercises the entire
approval → issued flow. Flip to `production` only after confirming Celcom
and the email provider are correctly configured.

## 5. Build and deploy the frontend

The app is a static Vite build — deploy it to any static host (Vercel,
Netlify, Cloudflare Pages, or Supabase-adjacent hosting).

```bash
cp .env.example .env.production
# Fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY for the hosted project.
npm run build
```

Deploy the resulting `dist/` folder. Set the same two `VITE_` variables as
environment variables in your hosting provider's dashboard (never put the
service role key here — it's server-only).

Update `supabase/config.toml`'s `auth.site_url` / `additional_redirect_urls`
and re-run `supabase db push` (or set them directly in the dashboard under
Authentication → URL Configuration) to match your production domain.

## 6. Company logo and letterhead

Upload the logo through the `company-assets` public bucket (Storage →
company-assets in the dashboard, or build the small upload control into
Settings later) and paste the resulting public URL into
Settings → Company information → `company_logo_url`. The PDF renderer in
`generate-lpo-pdf` can be extended to embed it once uploaded — see the
`renderLpoPdf` function's header section for where to add `doc.embedPng`.

## 7. Smoke test against production

Run through the acceptance scenario end-to-end (see
`docs/ACCEPTANCE_TEST.md`) with `NOTIFICATION_MODE=development` first, then
again with `production` once Celcom/email credentials are confirmed live —
using a real test customer and a cement company inbox you control.
