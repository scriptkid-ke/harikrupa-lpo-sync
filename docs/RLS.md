# Row Level Security Notes

All tables have RLS **enabled** (`supabase/migrations/0007_row_level_security.sql`).
Summary of the effective access model:

| Table                    | Read                                              | Write                                                                 |
|---------------------------|----------------------------------------------------|------------------------------------------------------------------------|
| `profiles`                | self, or `users.manage`                            | self (limited fields), or `users.manage` via `admin_update_user()`     |
| `customers`                | any authenticated user                             | `customers.manage`                                                     |
| `vehicles`                 | any authenticated user                             | `vehicles.manage`                                                      |
| `cement_companies`/`products` | any authenticated user                          | `cement_companies.manage`                                              |
| `system_settings`          | any authenticated user                             | `settings.manage`                                                      |
| `lpos`                     | creator, or `lpo.view_all`                         | **no direct INSERT/UPDATE policy** — only via workflow functions       |
| `lpo_items`/`lpo_status_history`/`lpo_approvals` | via parent `lpos` visibility | same as `lpos` — functions only |
| `notifications`             | via parent `lpos` visibility                       | Edge Functions only (service role)                                     |
| `audit_logs`                | `audit_logs.view`                                  | `write_audit_log()` only — no UPDATE/DELETE policy exists for anyone   |
| Storage `lpo-pdfs`          | matches `lpos` visibility, keyed on `pdf_storage_path` | Edge Functions only (service role)                                 |
| Storage `company-assets`    | public                                              | `settings.manage`                                                      |

## Why `lpos` has no INSERT/UPDATE policy

`create_lpo`, `submit_lpo`, `approve_lpo`, `reject_lpo`, `cancel_lpo`,
`mark_lpo_issued`, and `mark_lpo_collected` are all `SECURITY DEFINER`
functions. Postgres `SECURITY DEFINER` functions execute with the
privileges of the function's **owner**, which bypasses RLS on the tables
they touch — this is the standard, intentional pattern for "controlled
state machine" tables. It means:

- The `authenticated` role's grant on `lpos` is `SELECT` only (see the
  `grant select on ... lpos ...` line in
  `0008_admin_and_notifications_functions.sql`).
- Even a malicious or buggy frontend that tries
  `supabase.from('lpos').update({ status: 'approved' })` directly is
  rejected outright — there's no grant for it, regardless of RLS.
- All the real business-rule enforcement (self-approval, valid
  transitions, vehicle/customer ownership, VAT snapshotting) is
  centralized in one place per action, not duplicated across policies.

## Testing RLS

`tests/db/workflow.test.sql` is a pgTAP suite that authenticates as each
seeded user in turn (via `tests.authenticate_as()`, using the
`supabase_test_helpers` extension) and asserts:

- An employee cannot see another user's LPOs (`lpo.view_all` absent).
- An employee cannot approve their own LPO, even calling `approve_lpo()`
  directly.
- A manager who did not create the LPO can approve it.
- Invalid transitions (double-approve, issue-after-cancel) are rejected
  with a clear error class.

Run it with `supabase test db` after `supabase start` and seeding.

## What is intentionally NOT covered by RLS alone

RLS governs *rows a role can see or touch*, not *values in flight through a
request*. That's why financial correctness is enforced by a `CHECK`
constraint (`chk_financials` on `lpos`) rather than only by trusting
`create_lpo()`'s own arithmetic, and why the two rejection/cancellation
reasons are enforced by `CHECK` constraints too (`chk_rejection_reason`,
`chk_cancellation_reason`) — defense in depth, not a single layer.
