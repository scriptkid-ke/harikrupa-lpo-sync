import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Pencil } from 'lucide-react';
import { PageHeader, EmptyState, TableSkeleton, Modal } from '@/components/ui';
import { EntityStatusBadge } from '@/components/StatusBadge';
import { SearchableSelect } from '@/components/SearchableSelect';
import { listCementProducts, createCementProduct, updateCementProduct, listCementCompanies } from '@/services/masterDataService';
import { formatMoney } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import type { CementProduct, CementCompany } from '@/types/database';

const emptyForm = { cement_company_id: '', name: '', description: '', unit: 'bags', default_unit_price: '' };

export default function CementProducts() {
  const { hasPermission } = useAuth();
  const [params] = useSearchParams();
  const [products, setProducts] = useState<CementProduct[]>([]);
  const [companies, setCompanies] = useState<CementCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CementProduct | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = hasPermission('cement_companies.manage');
  const companyFilter = params.get('company');

  async function load() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        listCementProducts(companyFilter ? { companyId: companyFilter } : {}),
        listCementCompanies({ status: 'active' }),
      ]);
      setProducts(p);
      setCompanies(c);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, cement_company_id: companyFilter ?? '' });
    setModalOpen(true);
  }

  function openEdit(p: CementProduct) {
    setEditing(p);
    setForm({
      cement_company_id: p.cement_company_id,
      name: p.name,
      description: p.description ?? '',
      unit: p.unit,
      default_unit_price: String(p.default_unit_price),
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.cement_company_id) {
      toast.error('Product name and cement company are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        cement_company_id: form.cement_company_id,
        name: form.name,
        description: form.description,
        unit: form.unit,
        default_unit_price: parseFloat(form.default_unit_price) || 0,
      };
      if (editing) {
        await updateCementProduct(editing.id, payload);
        toast.success('Product updated');
      } else {
        await createCementProduct(payload);
        toast.success('Product added');
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not save product');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(p: CementProduct) {
    try {
      await updateCementProduct(p.id, { status: p.status === 'active' ? 'inactive' : 'active' });
      toast.success(`${p.name} ${p.status === 'active' ? 'deactivated' : 'activated'}`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not update status');
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Cement products available for each company, with a default unit price."
        actions={
          canManage && (
            <button className="btn-accent" onClick={openCreate}>
              <Plus size={15} /> Add product
            </button>
          )
        }
      />

      <div className="card">
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : products.length === 0 ? (
          <EmptyState title="No products yet" description="Add a product under a cement company." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
            <thead>
              <tr>
                <th>Product</th>
                <th>Company</th>
                <th>Unit</th>
                <th>Default price</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-sm">{p.name}</td>
                  <td className="text-sm">{p.cement_companies?.name}</td>
                  <td className="text-sm">{p.unit}</td>
                  <td className="text-sm">{formatMoney(p.default_unit_price)}</td>
                  <td><EntityStatusBadge status={p.status} /></td>
                  {canManage && (
                    <td>
                      <div className="flex items-center gap-3 justify-end">
                        <button className="text-ink-muted hover:text-ink" onClick={() => openEdit(p)}>
                          <Pencil size={14} />
                        </button>
                        <button className="text-xs font-medium text-kiln-600" onClick={() => toggleStatus(p)}>
                          {p.status === 'active' ? 'Deactivate' : 'Activate'}
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
        title={editing ? 'Edit product' : 'Add product'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-accent" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Cement company</label>
            <SearchableSelect
              placeholder="Select company"
              value={form.cement_company_id || null}
              onChange={(v) => setForm({ ...form, cement_company_id: v })}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div>
            <label className="field-label">Product name</label>
            <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Simba Cement 50kg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Unit</label>
              <input className="field-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="bags" />
            </div>
            <div>
              <label className="field-label">Default unit price</label>
              <input type="number" step="0.01" className="field-input" value={form.default_unit_price} onChange={(e) => setForm({ ...form, default_unit_price: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Description</label>
            <input className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
