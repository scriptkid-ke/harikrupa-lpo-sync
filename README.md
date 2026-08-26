# Harikrupa LPO Management System

A production-oriented Local Purchase Order (LPO) system for Harikrupa, a
broker between customers (e.g. Chirex General Hardware) and cement
companies/factories (Ndovu, Simba, Savannah, Nyumba, and others).

Digitizes: create LPO → validate vehicle → submit → manager approval →
generate PDF → email full LPO to the cement company → SMS the LPO number
and vehicle to the customer → track everything, forever.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions, Row
  Level Security)
- **PDF:** generated server-side in an Edge Function with `pdf-lib`
- **Email:** provider-agnostic Edge Function (wired for Resend by default)
- **SMS:** Celcom Africa, called only from an Edge Function

## Repository layout

```
src/                    React app
  pages/                One folder per feature area
  services/              Thin wrappers around Supabase queries/RPCs
  components/            Shared UI (sidebar, tables, dialogs, badges…)
  hooks/useAuth.tsx       Session, profile, role, permission state
  utils/financial.ts      Pure VAT/total calculation, unit-tested

supabase/
  migrations/             Numbered, ordered SQL migrations (schema -> RLS -> storage)
  functions/               Edge Functions: PDF, email, SMS, approval orchestrator
  seed/                    Development seed data + auth user bootstrap script
  config.toml              Supabase CLI project config

docs/                    Architecture, deployment, and RLS notes
tests/                   Vitest unit tests + pgTAP database tests
```

## Getting started (local development)

### 1. Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`)
- Docker (for `supabase start`, which runs Postgres/Auth/Storage locally)

### 2. Start Supabase locally

```bash
supabase start
```

This applies every file in `supabase/migrations/` in order and prints your
local `API URL`, `anon key`, and `service_role key`.

### 3. Configure environment variables

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from `supabase start` output.
```

For Edge Functions, set secrets (never commit these):

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... CELCOM_API_KEY=... EMAIL_API_KEY=... NOTIFICATION_MODE=development
```

### 4. Seed development data

```bash
npm install
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<from supabase start> npx tsx supabase/seed/seed-users.ts
psql "$(supabase status -o json | jq -r '.DB_URL')" -f supabase/seed/seed.sql
```

This creates three accounts (passwords are placeholders — change before any
shared/staging use):

| Role     | Email                     | Password              |
|----------|----------------------------|------------------------|
| Admin    | admin@harikrupa.test       | DevPassw0rd!Admin      |
| Manager  | manager@harikrupa.test     | DevPassw0rd!Manager    |
| Employee | employee@harikrupa.test    | DevPassw0rd!Employee   |

### 5. Serve Edge Functions locally (separate terminal)

```bash
supabase functions serve --env-file .env
```

### 6. Run the frontend

```bash
npm run dev
```

Open http://localhost:5173 and sign in as one of the seeded accounts.

## Notification safety

`NOTIFICATION_MODE=development` (the default) never calls Celcom or the
email provider — it records a mock `sent` notification instead, so you can
exercise the full approval → PDF → email → SMS → issued flow without
spending SMS credits or emailing a real cement company. Switch to
`production` only once real `CELCOM_*` and `EMAIL_*` secrets are set.

## Testing

```bash
npm test                     # Vitest: financial calculations, LPO number formatting
supabase test db             # pgTAP: RLS, workflow transitions, self-approval rule
```

See `docs/DEPLOYMENT.md` for pushing migrations to a hosted Supabase
project and deploying the frontend, and `docs/ARCHITECTURE.md` for the
approval/notification data flow and the RLS design.
