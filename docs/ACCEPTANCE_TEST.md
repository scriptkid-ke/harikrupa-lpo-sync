# Acceptance Test Walkthrough

Mirrors the end-to-end scenario from the build spec. Run this once against
a freshly seeded local environment (`supabase db reset`, then re-seed) to
confirm the whole system works together.

1. **Sign in as Employee** (`employee@harikrupa.test`).
2. Go to **Customers → Add customer** — create *Chirex General Hardware*
   with an SMS recipient number.
3. Go to **Vehicles → Register vehicle** — register *KAQ 188W* against
   Chirex.
4. Go to **Cement Companies → Add company** — add *Simba Cement* with a
   real-looking email (or your own test inbox).
5. Go to **Products → Add product** — add *Simba Cement 50kg* under Simba,
   default price 660.
6. Go to **Create LPO**:
   - Step 1: select Chirex → KAQ 188W.
   - Step 2: select Simba Cement → Simba Cement 50kg, quantity 220, price
     650. Confirm the VAT panel shows 16% automatically.
   - Step 3: review the preview, click **Submit for Approval**.
   - Confirm you land on the LPO detail page with status **Pending
     approval** and the number is `LPO-0001` (or the next sequence value).
7. Confirm you (the Employee) do **not** see Approve/Reject buttons — a
   banner explains you created this LPO.
8. **Sign out. Sign in as Manager** (`manager@harikrupa.test`).
9. Open the LPO from the dashboard's Approval queue. Click **Approve**.
   - Confirm the toast confirms PDF generation, email, and SMS.
   - Confirm status moves to **Issued**.
   - Confirm a **Download PDF** button appears and opens a real PDF.
   - Confirm the **Notifications** panel shows one `email` row and one
     `sms` row, both `sent` (or intentionally `failed` if a required field
     like the company email was left blank — try both).
10. Go to **Notification Center**; confirm both notifications appear there
    too, and Retry is available for anything marked failed.
11. Back on the LPO detail page, click **Cancel LPO**, provide a reason
    ("Factory congestion / vehicle redirected"). Confirm status becomes
    **Cancelled** and the reason is displayed.
12. **Sign in as Employee again.** Create a second LPO for the same
    vehicle (KAQ 188W) but a different cement company (e.g. Ndovu Cement —
    add it first if not already seeded). Submit it.
13. **Sign in as Manager.** Approve LPO-0002.
    - Confirm the PDF/email reflect *Ndovu*, not Simba.
    - Confirm the SMS still only mentions the LPO number and vehicle — no
      price, quantity, or total.
14. Go to **Audit Logs** (as Admin or Manager) and confirm entries exist
    for: `LPO_CREATED`, `LPO_SUBMITTED`, `LPO_APPROVED`, `LPO_ISSUED`,
    `EMAIL_SENT`, `SMS_SENT`, `LPO_CANCELLED` for LPO-0001, and the
    corresponding entries for LPO-0002. Confirm LPO-0001 is still visible
    in **All LPOs** with status Cancelled — never deleted.
15. **Sign in as Admin.** Go to **Settings**, change the VAT rate to 15%,
    save. Open LPO-0001 or LPO-0002 again and confirm they still show
    16% — the snapshot is unaffected by the settings change. Create a
    third LPO and confirm the new one now uses 15%.
16. As Admin, go to **Users**, confirm all three seeded accounts are
    listed with the correct roles, and that you cannot change your own
    role or deactivate yourself.

If every step above holds, the system satisfies the acceptance scenario in
section 49 of the build spec.
