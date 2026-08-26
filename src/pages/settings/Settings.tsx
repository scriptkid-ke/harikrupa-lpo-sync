import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/ui';
import { getSettings, updateSettings, listNotificationTemplates, updateNotificationTemplate } from '@/services/adminService';
import type { SystemSettings } from '@/types/database';

export default function Settings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, t] = await Promise.all([getSettings(), listNotificationTemplates()]);
      setSettings(s);
      setTemplates(t);
      setLoading(false);
    })();
  }, []);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err.message ?? 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate(t: any) {
    try {
      await updateNotificationTemplate(t.id, { subject: t.subject, body: t.body });
      toast.success('Template updated');
    } catch (err: any) {
      toast.error(err.message ?? 'Could not save template');
    }
  }

  if (loading || !settings) return <div className="animate-pulse h-96 card" />;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Company information, VAT, LPO numbering, and notification templates." />

      <div className="card p-6 mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-4">Company information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company name" value={settings.company_name} onChange={(v) => setSettings({ ...settings, company_name: v })} />
          <Field label="Tax PIN" value={settings.company_tax_pin ?? ''} onChange={(v) => setSettings({ ...settings, company_tax_pin: v })} />
          <Field label="Phone" value={settings.company_phone ?? ''} onChange={(v) => setSettings({ ...settings, company_phone: v })} />
          <Field label="Email" value={settings.company_email ?? ''} onChange={(v) => setSettings({ ...settings, company_email: v })} />
          <div className="sm:col-span-2">
            <Field label="Address" value={settings.company_address ?? ''} onChange={(v) => setSettings({ ...settings, company_address: v })} />
          </div>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-4">Financial &amp; numbering</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Currency</label>
            <input className="field-input" value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
          </div>
          <div>
            <label className="field-label">VAT rate (%)</label>
            <input type="number" step="0.01" className="field-input" value={settings.vat_rate} onChange={(e) => setSettings({ ...settings, vat_rate: parseFloat(e.target.value) })} />
            <p className="text-xs text-ink-muted mt-1">Changing this only affects LPOs created after the change — existing LPOs keep their original VAT rate.</p>
          </div>
          <div>
            <label className="field-label">LPO prefix</label>
            <input className="field-input" value={settings.lpo_prefix} onChange={(e) => setSettings({ ...settings, lpo_prefix: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-4">Terms &amp; conditions</p>
        <textarea
          className="field-input"
          rows={4}
          value={settings.terms_and_conditions}
          onChange={(e) => setSettings({ ...settings, terms_and_conditions: e.target.value })}
        />
        <p className="text-xs text-ink-muted mt-1">Printed on every future LPO PDF. Existing LPOs keep the terms that were in effect when they were created.</p>
      </div>

      <div className="flex justify-end mb-8">
        <button className="btn-accent" onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div className="card p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-4">Notification templates</p>
        <div className="space-y-6">
          {templates.map((t, i) => (
            <div key={t.id} className="border-t border-line pt-5 first:border-0 first:pt-0">
              <p className="text-sm font-medium text-ink capitalize mb-2">{t.event.replaceAll('_', ' ')} ({t.channel})</p>
              {t.channel === 'email' && (
                <input
                  className="field-input mb-2"
                  value={t.subject ?? ''}
                  onChange={(e) => {
                    const next = [...templates];
                    next[i] = { ...t, subject: e.target.value };
                    setTemplates(next);
                  }}
                  placeholder="Subject"
                />
              )}
              <textarea
                className="field-input"
                rows={2}
                value={t.body}
                onChange={(e) => {
                  const next = [...templates];
                  next[i] = { ...t, body: e.target.value };
                  setTemplates(next);
                }}
              />
              <div className="flex justify-end mt-2">
                <button className="btn-secondary text-xs" onClick={() => saveTemplate(templates[i])}>Save template</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input className="field-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
