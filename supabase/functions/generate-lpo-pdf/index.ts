// supabase/functions/generate-lpo-pdf/index.ts
//
// Renders the official Harikrupa LPO PDF for an approved (or later) LPO and
// stores it in the private `lpo-pdfs` bucket. Returns the storage path.
//
// Called internally by `approve-lpo`, and can also be called directly by an
// authorized user (e.g. to regenerate a PDF) -- so it independently
// re-checks that the caller is allowed to see the LPO before doing anything.

import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { userScopedClient, serviceRoleClient, getCallerId } from '../_shared/supabase-clients.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { lpo_id } = await req.json();
    if (!lpo_id) return jsonResponse({ error: 'lpo_id is required' }, 400);

    const scoped = userScopedClient(req);
    const callerId = await getCallerId(scoped);
    if (!callerId) return jsonResponse({ error: 'Not authenticated' }, 401);

    // This select is subject to RLS: it will return null if the caller
    // isn't the creator and doesn't hold lpo.view_all.
    const { data: lpo, error: lpoError } = await scoped.from('lpos').select('*').eq('id', lpo_id).single();
    if (lpoError || !lpo) return jsonResponse({ error: 'LPO not found or not visible to you' }, 404);

    const admin = serviceRoleClient();
    const { data: settings } = await admin.from('system_settings').select('*').single();

    const pdfBytes = await renderLpoPdf(lpo, settings);
    const storagePath = `${lpo.lpo_number}/${lpo.lpo_number}-${Date.now()}.pdf`;

    const { error: uploadError } = await admin.storage
      .from('lpo-pdfs')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) return jsonResponse({ error: `Storage upload failed: ${uploadError.message}` }, 500);

    return jsonResponse({ storage_path: storagePath });
  } catch (err) {
    console.error('generate-lpo-pdf error', err);
    return jsonResponse({ error: 'Unexpected error generating PDF' }, 500);
  }
});

async function renderLpoPdf(lpo: any, settings: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.09, 0.1, 0.13);
  const muted = rgb(0.42, 0.45, 0.5);
  const accent = rgb(0.72, 0.45, 0.16);
  const line = rgb(0.89, 0.87, 0.86);

  let y = 800;
  const left = 48;
  const right = 547;

  page.drawText(settings?.company_name ?? 'Harikrupa', { x: left, y, size: 22, font: bold, color: ink });
  page.drawText('LOCAL PURCHASE ORDER', { x: left, y: y - 20, size: 10, font, color: muted });

  page.drawText(lpo.lpo_number, { x: right - 140, y, size: 20, font: bold, color: accent });
  page.drawText(new Date(lpo.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }), {
    x: right - 140, y: y - 18, size: 10, font, color: muted,
  });

  y -= 50;
  if (settings?.company_address) {
    page.drawText(settings.company_address, { x: left, y, size: 9, font, color: muted });
    y -= 12;
  }
  const contactLine = [settings?.company_phone, settings?.company_email, settings?.company_tax_pin ? `PIN: ${settings.company_tax_pin}` : null]
    .filter(Boolean).join('   |   ');
  if (contactLine) {
    page.drawText(contactLine, { x: left, y, size: 9, font, color: muted });
    y -= 12;
  }

  y -= 20;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 24;

  const col2 = 320;
  page.drawText('BILL TO / CUSTOMER', { x: left, y, size: 8, font: bold, color: muted });
  page.drawText('CEMENT COMPANY', { x: col2, y, size: 8, font: bold, color: muted });
  y -= 14;
  page.drawText(lpo.customer_name_snapshot, { x: left, y, size: 12, font: bold, color: ink });
  page.drawText(lpo.cement_company_name_snapshot, { x: col2, y, size: 12, font: bold, color: ink });
  y -= 16;
  page.drawText(`Vehicle: ${lpo.vehicle_registration_snapshot}`, { x: left, y, size: 10, font, color: ink });
  page.drawText(`Product: ${lpo.cement_product_name_snapshot}`, { x: col2, y, size: 10, font, color: ink });

  y -= 40;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 20;

  // Table header
  const colProduct = left, colQty = 330, colPrice = 400, colTotal = 480;
  page.drawText('DESCRIPTION', { x: colProduct, y, size: 8, font: bold, color: muted });
  page.drawText('QTY', { x: colQty, y, size: 8, font: bold, color: muted });
  page.drawText('UNIT PRICE', { x: colPrice, y, size: 8, font: bold, color: muted });
  page.drawText('AMOUNT', { x: colTotal, y, size: 8, font: bold, color: muted });
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: line });
  y -= 18;

  page.drawText(lpo.cement_product_name_snapshot, { x: colProduct, y, size: 10, font, color: ink });
  page.drawText(`${Number(lpo.quantity).toLocaleString()} ${lpo.unit_snapshot}`, { x: colQty, y, size: 10, font, color: ink });
  page.drawText(formatMoney(lpo.unit_price, lpo.currency), { x: colPrice, y, size: 10, font, color: ink });
  page.drawText(formatMoney(lpo.subtotal, lpo.currency), { x: colTotal, y, size: 10, font, color: ink });

  y -= 40;
  page.drawLine({ start: { x: 330, y }, end: { x: right, y }, thickness: 0.5, color: line });
  y -= 20;

  const drawTotalRow = (label: string, value: string, isBold = false) => {
    page.drawText(label, { x: 330, y, size: 10, font: isBold ? bold : font, color: isBold ? ink : muted });
    page.drawText(value, { x: colTotal, y, size: 10, font: isBold ? bold : font, color: ink });
    y -= 18;
  };
  drawTotalRow('Subtotal', formatMoney(lpo.subtotal, lpo.currency));
  drawTotalRow(`VAT (${Number(lpo.vat_rate)}%)`, formatMoney(lpo.vat_amount, lpo.currency));
  y -= 4;
  page.drawLine({ start: { x: 330, y }, end: { x: right, y }, thickness: 1, color: ink });
  y -= 16;
  drawTotalRow('TOTAL', formatMoney(lpo.total_amount, lpo.currency), true);

  y -= 30;
  page.drawText('TERMS & CONDITIONS', { x: left, y, size: 8, font: bold, color: muted });
  y -= 14;
  const wrapped = wrapText(lpo.terms_snapshot ?? '', 95);
  for (const lineText of wrapped) {
    page.drawText(lineText, { x: left, y, size: 8, font, color: muted });
    y -= 11;
  }

  y = 110;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 20;
  page.drawText('Authorized by Harikrupa', { x: left, y, size: 9, font, color: muted });
  page.drawText('This document is system-generated and requires no physical signature.', {
    x: left, y: y - 14, size: 8, font, color: muted,
  });

  return doc.save();
}

function formatMoney(value: number, currency = 'KES'): string {
  return `${currency} ${Number(value).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      lines.push(current.trim());
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}
