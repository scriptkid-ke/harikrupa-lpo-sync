import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Boxes } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, EmptyState, TableSkeleton, Modal } from '@/components/ui';
import { EntityStatusBadge } from '@/components/StatusBadge';
import { listCementCompanies, createCementCompany, updateCementCompany } from '@/services/masterDataService';
import { useAuth } from '@/hooks/useAuth';
import type { CementCompany } from '@/types/database';

const emptyForm = { name: '', email: '', additional_emails: '', phone: '', address: '' };

export default function CementCompanies() {
  const { hasPermission } = useAuth();
  const [companies, setCompanies] = useState<CementCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CementCompany | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = hasPermission('cement_companies.manage');

  async function load() {
    setLoading(true);
    try {
      setCompanies(await listCementCompanies());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: CementCompany) {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email ?? '',
      additional_emails: (c.additional_emails ?? []).join(', '),
      phone: c.phone ?? '',
      address: c.address ?? '',
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        additional_emails: form.additional_emails.split(',').map((e) => e.trim()).filter(Boolean),
        phone: form.phone,
        address: form.address,
      };
      if (editing) {
        await updateCementCompany(editing.id, payload);
        toast.success('Cement company updated');
      } else {
        await createCementCompany(payload);
        toast.success('Cement company added');
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not save cement company');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(c: CementCompany) {
    try {
      await updateCementCompany(c.id, { status: c.status === 'active' ? 'inactive' : 'active' });
      toast.success(`${c.name} ${c.status === 'active' ? 'deactivated' : 'activated'}`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not update status');
    }
  }

  return (
    <div>
      <PageHeader
        title="Cement Companies"
        description="Factories that receive the full LPO PDF by email once a manager approves an order."
        actions={
          canManage && (
            <button className="btn-accent" onClick={openCreate}>
              <Plus size={15} /> Add company
            </button>
          )
        }
      />

      <div className="card">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : companies.length === 0 ? (
          <EmptyState title="No cement companies yet" description="Add Ndovu, Simba, Savannah, Nyumba, or others." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
            <thead>
              <tr>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-sm">{c.name}</td>
                  <td className="text-sm">{c.email ?? '—'}</td>
                  <td className="text-sm">{c.phone ?? '—'}</td>
                  <td><EntityStatusBadge status={c.status} /></td>
                  <td>
                    <div className="flex items-center gap-3 justify-end">
                      <Link to={`/products?company=${c.id}`} className="text-ink-muted hover:text-ink" title="View products">
                        <Boxes size={14} />
                      </Link>
                      {canManage && (
                        <>
                          <button className="text-ink-muted hover:text-ink" onClick={() => openEdit(c)}>
                            <Pencil size={14} />
                          </button>
                          <button className="text-xs font-medium text-kiln-600" onClick={() => toggleStatus(c)}>
                            {c.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit cement company' : 'Add cement company'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-accent" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Name</label>
            <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Simba Cement" />
          </div>
          <div>
            <label className="field-label">Primary email</label>
            <input className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="orders@company.com" />
          </div>
          <div>
            <label className="field-label">Additional emails</label>
            <input className="field-input" value={form.additional_emails} onChange={(e) => setForm({ ...form, additional_emails: e.target.value })} placeholder="comma-separated, e.g. dispatch@company.com" />
            <p className="text-xs text-ink-muted mt-1">The LPO PDF is emailed to every address listed here in addition to the primary email.</p>
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Address</label>
            <input className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
