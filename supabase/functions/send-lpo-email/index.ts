// supabase/functions/send-lpo-email/index.ts
//
// Emails the full LPO PDF to the cement company. Credentials for the email
// provider live only in this function's environment (Supabase secrets) and
// are never sent to or readable by the frontend.
//
// Body: { lpo_id: string, retry_of?: string }  (retry_of = existing notification id)

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { userScopedClient, serviceRoleClient, getCallerId } from '../_shared/supabase-clients.ts';

const NOTIFICATION_MODE = Deno.env.get('NOTIFICATION_MODE') ?? 'development';
const EMAIL_API_KEY = Deno.env.get('EMAIL_API_KEY') ?? '';
const EMAIL_FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'lpo@harikrupa.co.ke';
const EMAIL_FROM_NAME = Deno.env.get('EMAIL_FROM_NAME') ?? 'Harikrupa LPO Desk';

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
      .select('*, cement_companies(email, additional_emails)')
      .eq('id', lpo_id)
      .single();
    if (lpoError || !lpo) return jsonResponse({ error: 'LPO not found or not visible to you' }, 404);
    if (!lpo.pdf_storage_path) return jsonResponse({ error: 'LPO PDF has not been generated yet' }, 409);

    const admin = serviceRoleClient();
    const { data: templateRow } = await admin
      .from('notification_templates')
      .select('*')
      .eq('event', 'lpo_approved_email')
      .single();

    const recipients = [lpo.cement_companies?.email, ...(lpo.cement_companies?.additional_emails ?? [])].filter(Boolean);
    if (recipients.length === 0) {
      return jsonResponse({ error: 'Cement company has no configured email address' }, 422);
    }

    const subject = fillTemplate(templateRow?.subject ?? 'Harikrupa {{lpo_number}}', lpo);
    const body = fillTemplate(templateRow?.body ?? 'LPO {{lpo_number}} attached.', lpo);

    const { data: signedUrlData, error: signedUrlError } = await admin.storage
      .from('lpo-pdfs')
      .createSignedUrl(lpo.pdf_storage_path, 60 * 10);
    if (signedUrlError || !signedUrlData) {
      return await recordFailure(admin, lpo, retry_of, subject, body, recipients, 'Could not create signed URL for PDF');
    }

    let providerReference: string | null = null;
    let sendError: string | null = null;

    if (NOTIFICATION_MODE === 'production') {
      try {
        const pdfResponse = await fetch(signedUrlData.signedUrl);
        const pdfBuffer = new Uint8Array(await pdfResponse.arrayBuffer());
        const pdfBase64 = btoa(String.fromCharCode(...pdfBuffer));

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`,
            to: recipients,
            subject,
            text: body,
            attachments: [{ filename: `${lpo.lpo_number}.pdf`, content: pdfBase64 }],
          }),
        });
        const resendJson = await resendResponse.json();
        if (!resendResponse.ok) throw new Error(resendJson?.message ?? 'Email provider rejected the request');
        providerReference = resendJson?.id ?? null;
      } catch (err) {
        sendError = err instanceof Error ? err.message : 'Unknown email provider error';
      }
    } else {
      // Development / mock mode: never actually send email.
      providerReference = `MOCK-EMAIL-${Date.now()}`;
    }

    if (sendError) {
      return await recordFailure(admin, lpo, retry_of, subject, body, recipients, sendError);
    }

    const notification = await upsertNotification(admin, retry_of, {
      lpo_id: lpo.id,
      event: 'lpo_approved_email',
      type: 'email',
      recipient: recipients.join(', '),
      subject,
      message: body,
      status: 'sent',
      provider: NOTIFICATION_MODE === 'production' ? 'resend' : 'mock',
      provider_reference: providerReference,
    });

    return jsonResponse({ notification });
  } catch (err) {
    console.error('send-lpo-email error', err);
    return jsonResponse({ error: 'Unexpected error sending email' }, 500);
  }
});

async function recordFailure(admin: any, lpo: any, retryOf: string | undefined, subject: string, body: string, recipients: string[], reason: string) {
  const notification = await upsertNotification(admin, retryOf, {
    lpo_id: lpo.id,
    event: 'lpo_approved_email',
    type: 'email',
    recipient: recipients.join(', '),
    subject,
    message: body,
    status: 'failed',
    provider: NOTIFICATION_MODE === 'production' ? 'resend' : 'mock',
    provider_reference: null,
    failure_reason: reason,
  });
  return jsonResponse({ notification, error: reason }, 200);
}

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
    .replaceAll('{{customer_name}}', lpo.customer_name_snapshot)
    .replaceAll('{{vehicle_registration}}', lpo.vehicle_registration_snapshot)
    .replaceAll('{{product_name}}', lpo.cement_product_name_snapshot)
    .replaceAll('{{quantity}}', String(lpo.quantity))
    .replaceAll('{{unit}}', lpo.unit_snapshot);
}
