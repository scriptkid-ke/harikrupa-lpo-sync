// supabase/functions/approve-lpo/index.ts
//
// The single entry point the frontend calls when a manager approves an LPO.
// Orchestrates the full post-approval automation from section 23 of the
// spec:
//
//   approve_lpo() [DB, permission + ownership checked]
//     -> generate-lpo-pdf
//     -> send-lpo-email   (independent -- failure does not block SMS)
//     -> send-lpo-sms     (independent -- failure does not block issuing)
//     -> mark_lpo_issued() [DB]
//
// The LPO remains valid even if a notification fails; failures are simply
// recorded with status=failed so they show up in the Notification Center
// for retry. This function always runs with the CALLER's JWT (not the
// service role) for the approve_lpo/mark_lpo_issued calls, so RLS/ownership
// rules are enforced exactly as if the manager had called them directly.

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { userScopedClient, getCallerId } from '../_shared/supabase-clients.ts';

const FUNCTIONS_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { lpo_id } = await req.json();
    if (!lpo_id) return jsonResponse({ error: 'lpo_id is required' }, 400);

    const scoped = userScopedClient(req);
    const callerId = await getCallerId(scoped);
    if (!callerId) return jsonResponse({ error: 'Not authenticated' }, 401);

    const authHeader = req.headers.get('Authorization') ?? '';

    // 1. Approve (DB-level permission + self-approval checks happen inside)
    const { data: approvedLpo, error: approveError } = await scoped.rpc('approve_lpo', { p_lpo_id: lpo_id });
    if (approveError) return jsonResponse({ error: approveError.message }, 400);

    const result: Record<string, unknown> = { lpo: approvedLpo, steps: {} as Record<string, unknown> };

    // 2. Generate PDF
    const pdfRes = await fetch(`${FUNCTIONS_BASE}/generate-lpo-pdf`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lpo_id }),
    });
    const pdfJson = await pdfRes.json();
    (result.steps as any).pdf = pdfJson;
    if (!pdfRes.ok) {
      // The LPO is approved but not yet issued; the manager can retry PDF
      // generation from the LPO detail page. We stop the chain here since
      // email/SMS need the PDF.
      return jsonResponse(result, 207);
    }

    // 3. Email to cement company (independent of SMS outcome)
    const emailRes = await fetch(`${FUNCTIONS_BASE}/send-lpo-email`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lpo_id }),
    });
    (result.steps as any).email = await emailRes.json();

    // 4. SMS to customer (independent of email outcome)
    const smsRes = await fetch(`${FUNCTIONS_BASE}/send-lpo-sms`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lpo_id }),
    });
    (result.steps as any).sms = await smsRes.json();

    // 5. Mark issued regardless of notification outcomes -- the LPO is
    // valid the moment it's approved and PDF'd; notifications can be
    // retried independently forever without changing the LPO's validity.
    const { data: issuedLpo, error: issueError } = await scoped.rpc('mark_lpo_issued', {
      p_lpo_id: lpo_id,
      p_pdf_storage_path: pdfJson.storage_path,
    });
    if (issueError) {
      return jsonResponse({ ...result, error: issueError.message }, 207);
    }
    result.lpo = issuedLpo;

    return jsonResponse(result, 200);
  } catch (err) {
    console.error('approve-lpo error', err);
    return jsonResponse({ error: 'Unexpected error during approval workflow' }, 500);
  }
});
