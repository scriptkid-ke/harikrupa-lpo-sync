# Architecture

## Request flow

```
React (Vite, TS)
   │  supabase-js, using the user's session JWT
   ▼
Supabase Auth  ──────────────►  RLS-protected PostgreSQL
   │                                   │
   │                                   ├─ profiles / roles / permissions
   │                                   ├─ customers / vehicles
   │                                   ├─ cement_companies / cement_products
   │                                   ├─ lpos / lpo_items / lpo_status_history / lpo_approvals
   │                                   ├─ notifications
   │                                   ├─ audit_logs
   │                                   └─ system_settings / notification_templates
   │
   ▼
Edge Functions (Deno, service-role secrets never sent to the browser)
   ├─ generate-lpo-pdf   → renders PDF with pdf-lib, uploads to Storage (`lpo-pdfs`, private)
   ├─ send-lpo-email     → emails the PDF to the cement company (Resend by default)
   ├─ send-lpo-sms       → texts the LPO number + vehicle to the customer (Celcom Africa)
   └─ approve-lpo        → orchestrates: approve_lpo() → PDF → email → SMS → mark_lpo_issued()
```

## Why business logic lives in Postgres functions, not the frontend

Every LPO status transition (`create_lpo`, `submit_lpo`, `approve_lpo`,
`reject_lpo`, `cancel_lpo`, `mark_lpo_issued`, `mark_lpo_collected`) is a
`SECURITY DEFINER` PostgreSQL function in
`supabase/migrations/0006_lpo_workflow_functions.sql`. There is **no**
`UPDATE` grant on `lpos.status` for any client role — the only way to move
an LPO through its lifecycle is through these functions, and each one:

1. Re-checks the caller's permission with `auth_has_permission()`.
2. Re-validates the business rule (e.g. "only a pending LPO can be
   approved", "the creator can never approve their own LPO").
3. Recomputes and asserts the financial totals server-side (the
   `chk_financials` CHECK constraint on `lpos` makes it structurally
   impossible to store a subtotal/VAT/total that doesn't match
   `quantity × unit_price` and the snapshotted VAT rate).
4. Writes an audit log entry and a status-history row atomically, in the
   same transaction as the state change.

This means a compromised or buggy frontend cannot forge an approval,
change a price after approval, or skip the vehicle-ownership check — the
database is the real authorization boundary, matching section 31 of the
spec ("Never trust the frontend").

## LPO numbering

`lpo_number_seq` is a dedicated PostgreSQL sequence. `nextval()` is
concurrency-safe by construction (two simultaneous `create_lpo()` calls can
never receive the same number), numbers are never reused even if the LPO is
later cancelled, and the mapping from sequence value to display string
(`LPO-0001`) is centralized in `format_lpo_number()` so the prefix/padding
can change in Settings without touching already-issued numbers (existing
rows keep their already-formatted `lpo_number` — only future LPOs pick up a
new prefix).

## Snapshotting

`lpos` stores denormalized `*_snapshot` columns (customer name, vehicle
registration, cement company/product name, unit, VAT rate, terms &
conditions) captured at `create_lpo()` time. If a customer is renamed or
the VAT rate changes next quarter, every historical LPO's PDF and detail
page still shows exactly what was true when it was issued — this is what
section 19 ("VAT must be snapshotted") and section 13 ("PDF based on actual
LPO format") require in combination.

## Post-approval automation (section 23)

`approve-lpo` is the single Edge Function the "Approve" button calls. It:

1. Calls `approve_lpo()` using the **caller's own JWT** (not the service
   role), so the self-approval and `lpo.approve` permission checks run
   exactly as if the manager had called the RPC directly from the browser.
2. Calls `generate-lpo-pdf`, which independently re-checks the caller can
   see the LPO, renders the PDF, and uploads it to the private `lpo-pdfs`
   bucket.
3. Calls `send-lpo-email` and `send-lpo-sms` — **independently of each
   other**. A failed SMS never blocks the email, and vice versa; each
   result is written to `notifications` with `status = 'sent' | 'failed'`.
4. Calls `mark_lpo_issued()` regardless of notification outcomes. The LPO
   is valid the moment it's approved and PDF'd; a failed notification is
   surfaced in the Notification Center for retry (section 26/42) and never
   invalidates the underlying order.

## Replacement / traffic-reroute workflow (section 27)

`lpos.replaces_lpo_id` optionally points at a **cancelled** LPO. The
frontend's Create LPO flow accepts this when starting from an existing
LPO's detail page ("create replacement"). `create_lpo()` validates that the
referenced LPO is actually cancelled before allowing the link, so the
history chain always reads: original (cancelled, with a reason) → new LPO
(approved and issued) — nothing is ever deleted.

## Role/permission model

`roles` and `permissions` are tables, not just an enum, specifically so a
future role (e.g. "auditor" or "finance") or a new fine-grained permission
can be added with an `INSERT`, not a schema migration or a frontend
redeploy. `role_permissions` is the join table; `auth_has_permission(code)`
is the single function every RLS policy and workflow function calls to ask
"can the current user do X" — this keeps the authorization logic in one
place instead of duplicated across dozens of policies.
