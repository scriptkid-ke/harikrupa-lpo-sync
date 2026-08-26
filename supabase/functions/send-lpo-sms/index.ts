// supabase/functions/send-lpo-sms/index.ts
//
// Sends the collection-authorization SMS to the customer via Celcom Africa.
// The SMS is deliberately minimal: LPO number, vehicle, and an
// authorization statement only. No quantity, price, VAT, or total is ever
// included in the SMS body, per the confidentiality requirement -- that
// information goes to the cement company by PDF email only.
//
// Celcom credentials are read from Supabase secrets and never touch the
// frontend or the anon/authenticated API roles.

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { userScopedClient, serviceRoleClient, getCallerId } from '../_shared/supabase-clients.ts';

const NOTIFICATION_MODE = Deno.env.get('NOTIFICATION_MODE') ?? 'development';
const CELCOM_API_URL = Deno.env.get('CELCOM_API_URL') ?? 'https://isms.celcomafrica.com/api/services/sendsms/';
const CELCOM_API_KEY = Deno.env.get('CELCOM_API_KEY') ?? '';
const CELCOM_PARTNER_ID = Deno.env.get('CELCOM_PARTNER_ID') ?? '';
const CELCOM_SHORTCODE = Deno.env.get('CELCOM_SHORTCODE') ?? 'HARIKRUPA';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { lpo_id, retry_of } = await req.json();
    if (!lpo_id) return jsonResponse({ error: 'lpo_id is required' }, 400);

    const scoped = userScopedClient(req);
    const callerId = await getCallerId(scoped);
    if (!callerId) return jsonResponse({ error: 'Not authenticated' }, 401);

    const { data: lpo, error: lpoError } = await scoped
      .from('lpos')
      .select('*, customers(sms_recipient, name)')
      .eq('id', lpo_id)
      .single();
    if (lpoError || !lpo) return jsonResponse({ error: 'LPO not found or not visible to you' }, 404);

    const recipient = lpo.customers?.sms_recipient;
    if (!recipient) return jsonResponse({ error: 'Customer has no configured SMS recipient number' }, 422);

    const admin = serviceRoleClient();
    const { data: templateRow } = await admin
      .from('notification_templates')
      .select('*')
      .eq('event', 'lpo_approved_sms')
      .single();

    const message = fillTemplate(
      templateRow?.body ?? 'Harikrupa {{lpo_number}} approved. Vehicle {{vehicle_registration}} is authorized for cement collection.',
      lpo
    );

    let providerReference: string | null = null;
    let sendError: string | null = null;

    if (NOTIFICATION_MODE === 'production') {
      try {
        const celcomResponse = await fetch(CELCOM_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apikey: CELCOM_API_KEY,
            partnerID: CELCOM_PARTNER_ID,
            shortcode: CELCOM_SHORTCODE,
            mobile: recipient,
            message,
          }),
        });
        const celcomJson = await celcomResponse.json();
        if (!celcomResponse.ok || celcomJson?.responses?.[0]?.['response-code'] !== 200) {
          throw new Error(celcomJson?.responses?.[0]?.['response-description'] ?? 'Celcom rejected the request');
        }
        providerReference = celcomJson?.responses?.[0]?.messageid ?? null;
      } catch (err) {
        sendError = err instanceof Error ? err.message : 'Unknown SMS provider error';
      }
    } else {
      providerReference = `MOCK-SMS-${Date.now()}`;
    }

    const status = sendError ? 'failed' : 'sent';
    const notification = await upsertNotification(admin, retry_of, {
      lpo_id: lpo.id,
      event: 'lpo_approved_sms',
      type: 'sms',
      recipient,
      subject: null,
      message,
      status,
      provider: NOTIFICATION_MODE === 'production' ? 'celcom' : 'mock',
      provider_reference: providerReference,
      failure_reason: sendError,
    });

    return jsonResponse({ notification, error: sendError ?? undefined });
  } catch (err) {
    console.error('send-lpo-sms error', err);
    return jsonResponse({ error: 'Unexpected error sending SMS' }, 500);
  }
});

async function upsertNotification(admin: any, retryOf: string | undefined, payload: any) {
  if (retryOf) {
    const { data } = await admin.rpc('mark_notification_retry_result', {
      p_notification_id: retryOf,
      p_status: payload.status,
      p_provider_reference: payload.provider_reference,
      p_failure_reason: payload.failure_reason ?? null,
    });
    return data;
  }
  const { data } = await admin.rpc('record_notification', {
    p_lpo_id: payload.lpo_id,
    p_event: payload.event,
    p_type: payload.type,
    p_recipient: payload.recipient,
    p_subject: payload.subject,
    p_message: payload.message,
    p_status: payload.status,
    p_provider: payload.provider,
    p_provider_reference: payload.provider_reference,
    p_failure_reason: payload.failure_reason ?? null,
  });
  return data;
}

function fillTemplate(template: string, lpo: any): string {
  return template
    .replaceAll('{{lpo_number}}', lpo.lpo_number)
    .replaceAll('{{vehicle_registration}}', lpo.vehicle_registration_snapshot);
}
