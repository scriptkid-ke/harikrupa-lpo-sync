import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { PageHeader, EmptyState, TableSkeleton, Modal } from '@/components/ui';
import { EntityStatusBadge } from '@/components/StatusBadge';
import { SearchableSelect } from '@/components/SearchableSelect';
import { listVehicles, createVehicle, updateVehicle, listCustomers } from '@/services/masterDataService';
import { useAuth } from '@/hooks/useAuth';
import type { Vehicle, Customer } from '@/types/database';

export default function Vehicles() {
  const { hasPermission } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [reg, setReg] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = hasPermission('vehicles.manage');

  async function load() {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([listVehicles(), listCustomers({ status: 'active' })]);
      setVehicles(v);
      setCustomers(c);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setReg('');
    setCustomerId(null);
    setModalOpen(true);
  }

  async function save() {
    if (!reg.trim() || !customerId) {
      toast.error('Registration number and customer are required');
      return;
    }
    setSaving(true);
    try {
      await createVehicle({ registration_number: reg.trim().toUpperCase(), customer_id: customerId });
      toast.success('Vehicle registered');
      setModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message?.includes('duplicate') ? 'This registration number already exists' : err.message ?? 'Could not save vehicle');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(v: Vehicle) {
    try {
      await updateVehicle(v.id, { status: v.status === 'active' ? 'inactive' : 'active' });
      toast.success(`${v.registration_number} ${v.status === 'active' ? 'deactivated' : 'activated'}`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not update status');
    }
  }

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="Only active vehicles linked to a customer can be selected when creating an LPO."
        actions={
          canManage && (
            <button className="btn-accent" onClick={openCreate}>
              <Plus size={15} /> Register vehicle
            </button>
          )
        }
      />

      <div className="card">
        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : vehicles.length === 0 ? (
          <EmptyState title="No vehicles registered" description="Register a vehicle and link it to a customer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Customer</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="font-mono text-sm font-medium">{v.registration_number}</td>
                  <td className="text-sm">{v.customers?.name ?? '—'}</td>
                  <td><EntityStatusBadge status={v.status} /></td>
                  {canManage && (
                    <td className="text-right">
                      <button className="text-xs font-medium text-kiln-600" onClick={() => toggleStatus(v)}>
                        {v.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
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
        title="Register vehicle"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-accent" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Registration number</label>
            <input className="field-input font-mono" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="e.g. KAQ 188W" />
          </div>
          <div>
            <label className="field-label">Customer</label>
            <SearchableSelect
              placeholder="Select customer"
              value={customerId}
              onChange={setCustomerId}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
