import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil } from 'lucide-react';
import { PageHeader, EmptyState, TableSkeleton, Modal } from '@/components/ui';
import { EntityStatusBadge } from '@/components/StatusBadge';
import { listCustomers, createCustomer, updateCustomer } from '@/services/masterDataService';
import { useAuth } from '@/hooks/useAuth';
import type { Customer } from '@/types/database';

const emptyForm = { name: '', phone: '', email: '', address: '', tax_pin: '', sms_recipient: '' };

export default function Customers() {
  const { hasPermission } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = hasPermission('customers.manage');

  async function load() {
    setLoading(true);
    try {
      setCustomers(await listCustomers());
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

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      tax_pin: c.tax_pin ?? '',
      sms_recipient: c.sms_recipient ?? '',
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCustomer(editing.id, form);
        toast.success('Customer updated');
      } else {
        await createCustomer(form);
        toast.success('Customer created');
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not save customer');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(c: Customer) {
    try {
      await updateCustomer(c.id, { status: c.status === 'active' ? 'inactive' : 'active' });
      toast.success(`${c.name} ${c.status === 'active' ? 'deactivated' : 'activated'}`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not update status');
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Registered customers who receive vehicles and collection notifications."
        actions={
          canManage && (
            <button className="btn-accent" onClick={openCreate}>
              <Plus size={15} /> Add customer
            </button>
          )
        }
      />

      <div className="card">
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : customers.length === 0 ? (
          <EmptyState title="No customers yet" description="Add your first customer to start creating LPOs." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone / SMS recipient</th>
                <th>Email</th>
                <th>Tax PIN</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-sm">{c.name}</td>
                  <td className="text-sm">{c.sms_recipient ?? c.phone ?? '—'}</td>
                  <td className="text-sm">{c.email ?? '—'}</td>
                  <td className="text-sm">{c.tax_pin ?? '—'}</td>
                  <td><EntityStatusBadge status={c.status} /></td>
                  {canManage && (
                    <td>
                      <div className="flex items-center gap-3 justify-end">
                        <button className="text-ink-muted hover:text-ink" onClick={() => openEdit(c)}>
                          <Pencil size={14} />
                        </button>
                        <button className="text-xs font-medium text-kiln-600" onClick={() => toggleStatus(c)}>
                          {c.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  )}
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
        title={editing ? 'Edit customer' : 'Add customer'}
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
            <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chirex General Hardware" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Phone</label>
              <input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 7xx xxx xxx" />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="accounts@customer.com" />
            </div>
          </div>
          <div>
            <label className="field-label">SMS recipient number</label>
            <input className="field-input" value={form.sms_recipient} onChange={(e) => setForm({ ...form, sms_recipient: e.target.value })} placeholder="Number that receives collection SMS" />
            <p className="text-xs text-ink-muted mt-1">Independent from the general phone number above — this is who gets texted when an LPO is approved.</p>
          </div>
          <div>
            <label className="field-label">Address</label>
            <input className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Tax PIN</label>
            <input className="field-input" value={form.tax_pin} onChange={(e) => setForm({ ...form, tax_pin: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
