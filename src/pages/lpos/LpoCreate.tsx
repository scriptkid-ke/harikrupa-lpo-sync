import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { SearchableSelect } from '@/components/SearchableSelect';
import { listCustomers, listVehicles, listCementCompanies, listCementProducts } from '@/services/masterDataService';
import { createLpo, submitLpo } from '@/services/lpoService';
import { getSettings } from '@/services/adminService';
import { formatMoney } from '@/utils/format';
import { calculateLpoTotals } from '@/utils/financial';
import type { Customer, Vehicle, CementCompany, CementProduct, SystemSettings } from '@/types/database';

const STEPS = ['Customer & Vehicle', 'Cement & Quantity', 'Review & Submit'];

export default function LpoCreate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<CementCompany[]>([]);
  const [products, setProducts] = useState<CementProduct[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<string>('');

  useEffect(() => {
    (async () => {
      const [c, comp, s] = await Promise.all([
        listCustomers({ status: 'active' }),
        listCementCompanies({ status: 'active' }),
        getSettings(),
      ]);
      setCustomers(c);
      setCompanies(comp);
      setSettings(s);
    })();
  }, []);

  useEffect(() => {
    if (!customerId) {
      setVehicles([]);
      setVehicleId(null);
      return;
    }
    listVehicles({ status: 'active', customerId }).then(setVehicles);
    setVehicleId(null);
  }, [customerId]);

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      setProductId(null);
      return;
    }
    listCementProducts({ status: 'active', companyId }).then(setProducts);
    setProductId(null);
  }, [companyId]);

  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    if (selectedProduct && !unitPrice) {
      setUnitPrice(String(selectedProduct.default_unit_price));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  const qtyNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(unitPrice) || 0;
  const vatRate = settings?.vat_rate ?? 16;
  const { subtotal, vatAmount, total } = calculateLpoTotals(qtyNum, priceNum, vatRate);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const selectedCompany = companies.find((c) => c.id === companyId);

  const step1Valid = !!customerId && !!vehicleId;
  const step2Valid = !!companyId && !!productId && qtyNum > 0 && priceNum >= 0;

  async function handleSubmit() {
    if (!customerId || !vehicleId || !companyId || !productId) return;
    setSubmitting(true);
    try {
      const lpo = await createLpo({
        customer_id: customerId,
        vehicle_id: vehicleId,
        cement_company_id: companyId,
        cement_product_id: productId,
        quantity: qtyNum,
        unit_price: priceNum,
      });
      await submitLpo(lpo.id);
      toast.success(`${lpo.lpo_number} submitted for approval`);
      navigate(`/lpos/${lpo.id}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Could not create LPO');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Create LPO" description="Follow the steps below to raise a new Local Purchase Order." />

      <Stepper current={step} />

      <div className="card p-6 mt-6">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="field-label">Customer</label>
              <SearchableSelect
                placeholder="Select a registered customer"
                value={customerId}
                onChange={setCustomerId}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
                emptyMessage="No active customers. Add one under Customers."
              />
            </div>
            <div>
              <label className="field-label">Vehicle</label>
              <SearchableSelect
                placeholder={customerId ? 'Select a registered vehicle' : 'Select a customer first'}
                value={vehicleId}
                onChange={setVehicleId}
                disabled={!customerId}
                options={vehicles.map((v) => ({ value: v.id, label: v.registration_number }))}
                emptyMessage="No active vehicles registered for this customer."
              />
              <p className="text-xs text-ink-muted mt-1.5">Only active vehicles linked to the selected customer appear here.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="field-label">Cement company</label>
                <SearchableSelect
                  placeholder="Select cement company"
                  value={companyId}
                  onChange={setCompanyId}
                  options={companies.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div>
                <label className="field-label">Product</label>
                <SearchableSelect
                  placeholder={companyId ? 'Select product' : 'Select a company first'}
                  value={productId}
                  onChange={setProductId}
                  disabled={!companyId}
                  options={products.map((p) => ({ value: p.id, label: p.name, sublabel: p.unit }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="field-label">Quantity {selectedProduct ? `(${selectedProduct.unit})` : ''}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 220"
                />
              </div>
              <div>
                <label className="field-label">Unit price ({settings?.currency ?? 'KES'})</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field-input"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="e.g. 650.00"
                />
              </div>
            </div>

            {step2Valid && (
              <div className="rounded-md bg-surface-sunken p-4 space-y-1.5">
                <Row label="Subtotal" value={formatMoney(subtotal, settings?.currency)} />
                <Row label={`VAT (${vatRate}%)`} value={formatMoney(vatAmount, settings?.currency)} />
                <div className="border-t border-line pt-1.5 mt-1.5">
                  <Row label="Total" value={formatMoney(total, settings?.currency)} bold />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-3">LPO Preview</p>
            <div className="border border-line rounded-card p-6 bg-surface-sunken/40">
              <div className="flex justify-between items-start pb-4 border-b border-line mb-4">
                <div>
                  <p className="font-display font-semibold text-ink">{settings?.company_name ?? 'Harikrupa'}</p>
                  <p className="text-xs text-ink-muted">Local Purchase Order</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-kiln-600">Assigned on submit</p>
                  <p className="text-xs text-ink-muted">{new Date().toLocaleDateString('en-KE')}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-ink-muted mb-0.5">Customer</p>
                  <p className="text-sm font-medium text-ink">{selectedCustomer?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted mb-0.5">Cement company</p>
                  <p className="text-sm font-medium text-ink">{selectedCompany?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted mb-0.5">Vehicle</p>
                  <p className="text-sm font-medium text-ink">{selectedVehicle?.registration_number}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted mb-0.5">Product</p>
                  <p className="text-sm font-medium text-ink">{selectedProduct?.name}</p>
                </div>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-line">
                <Row label={`Quantity (${selectedProduct?.unit ?? ''})`} value={String(qtyNum)} />
                <Row label="Unit price" value={formatMoney(priceNum, settings?.currency)} />
                <Row label="Subtotal" value={formatMoney(subtotal, settings?.currency)} />
                <Row label={`VAT (${vatRate}%)`} value={formatMoney(vatAmount, settings?.currency)} />
                <div className="border-t border-line pt-1.5 mt-1.5">
                  <Row label="TOTAL" value={formatMoney(total, settings?.currency)} bold />
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-muted mt-3">
              Submitting will assign the next sequential LPO number and send this LPO to a manager for approval.
              You will not be able to approve your own LPO.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-5 border-t border-line">
          <button className="btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft size={15} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              className="btn-accent"
              disabled={step === 0 ? !step1Valid : !step2Valid}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue <ChevronRight size={15} />
            </button>
          ) : (
            <button className="btn-accent" disabled={submitting} onClick={handleSubmit}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Submit for Approval
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                i < current
                  ? 'bg-kiln-500 text-white'
                  : i === current
                  ? 'bg-ink text-white'
                  : 'bg-surface-sunken text-ink-muted'
              }`}
            >
              {i < current ? <Check size={13} /> : i + 1}
            </div>
            <span className={`text-sm ${i === current ? 'text-ink font-medium' : 'text-ink-muted'} hidden sm:inline`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && <div className="flex-1 h-px bg-line mx-3" />}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={bold ? 'font-semibold text-ink' : 'text-ink-muted'}>{label}</span>
      <span className={bold ? 'font-semibold text-ink' : 'text-ink'}>{value}</span>
    </div>
  );
}

