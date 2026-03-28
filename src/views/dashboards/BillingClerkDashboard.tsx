import { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, X, Receipt } from 'lucide-react';
import { billingApi, Bill, Payment } from '../../api/billing';

function fmtKES(amount: number | undefined): string {
  return `KES ${(amount ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

function billStatusStyle(status: Bill['status']): { bg: string; text: string } {
  switch (status) {
    case 'open':
      return { bg: 'var(--status-warning-bg, rgba(245,158,11,0.1))', text: 'var(--sla-warning)' };
    case 'partially_paid':
      return { bg: 'var(--status-info-bg, rgba(59,130,246,0.1))', text: 'var(--status-info-text, #2563eb)' };
    case 'paid':
      return { bg: 'rgba(16,185,129,0.1)', text: 'var(--sla-safe)' };
    case 'finalized':
      return { bg: 'var(--bg-alert)', text: 'var(--sla-breached)' };
    case 'waived':
      return { bg: 'var(--bg-base)', text: 'var(--text-disabled)' };
    default:
      return { bg: 'var(--bg-base)', text: 'var(--text-muted)' };
  }
}

function StatTile({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      className="p-4 rounded-2xl border"
      style={{
        background: danger ? 'var(--bg-alert)' : 'var(--bg-card)',
        borderColor: danger ? 'var(--border-breach)' : 'var(--border-default)',
        boxShadow: 'var(--shadow-card)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <p className="text-label" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p
        className="text-time-card tabular-nums mt-1"
        style={{ color: danger ? 'var(--sla-breached)' : 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      className="h-14 rounded-xl animate-shimmer"
      style={{ borderRadius: 'var(--radius-card)' }}
    />
  );
}

interface PaymentModalProps {
  bill: Bill;
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentModal({ bill, onClose, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaid = bill.status === 'paid';

  const handleSubmit = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    setSaving(true);
    setError(null);
    try {
      await billingApi.addPayment(bill._id, {
        amount: parseFloat(amount),
        method: method as Payment['method'],
        received_at: new Date().toISOString(),
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Payment failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const patientLabel = bill.patient_name ?? 'Unknown Patient';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-modal)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div>
            <h2 className="text-h3" style={{ color: 'var(--text-primary)' }}>
              Bill  -  {patientLabel}
            </h2>
            <p className="text-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
              #{bill._id.slice(-8).toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-row-hover)] transition-colors"
          >
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'TOTAL', value: fmtKES(bill.total_amount) },
              { label: 'PAID', value: fmtKES(bill.paid_amount) },
              {
                label: 'BALANCE',
                value: fmtKES(bill.balance_due),
                danger: bill.balance_due > 0,
              },
            ].map(({ label, value, danger }) => (
              <div
                key={label}
                className="p-3 rounded-xl border text-center"
                style={{
                  background: danger ? 'var(--bg-alert)' : 'var(--bg-base)',
                  borderColor: danger ? 'var(--border-breach)' : 'var(--border-default)',
                  borderRadius: 'var(--radius-badge)',
                }}
              >
                <p className="text-label" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </p>
                <p
                  className="text-body-sm font-bold mt-0.5 tabular-nums"
                  style={{ color: danger ? 'var(--sla-breached)' : 'var(--text-primary)' }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {!isPaid && (
            <div className="space-y-4">
              <div>
                <label
                  className="block text-label mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  AMOUNT (KES)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Max: ${(bill.balance_due ?? 0).toLocaleString()}`}
                  className="w-full px-3 py-2 text-body-sm rounded-lg border outline-none transition-colors focus:border-[var(--clinical-600)]"
                  style={{
                    background: 'var(--bg-base)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-button)',
                  }}
                />
              </div>
              <div>
                <label
                  className="block text-label mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  PAYMENT METHOD
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 text-body-sm rounded-lg border outline-none transition-colors focus:border-[var(--clinical-600)]"
                  style={{
                    background: 'var(--bg-base)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-button)',
                  }}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="insurance">Insurance</option>
                  <option value="nhif">NHIF</option>
                  <option value="mpesa">M-Pesa</option>
                </select>
              </div>
              {error && (
                <p className="text-body-sm" style={{ color: 'var(--sla-breached)' }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        <div
          className="flex justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-body-sm font-semibold rounded-lg border hover:bg-[var(--bg-row-hover)] transition-colors"
            style={{
              color: 'var(--text-primary)',
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-button)',
            }}
          >
            {isPaid ? 'Close' : 'Cancel'}
          </button>
          {!isPaid && (
            <button
              onClick={handleSubmit}
              disabled={!amount || saving}
              className="px-4 py-2 text-body-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{
                background: 'var(--clinical-600)',
                borderRadius: 'var(--radius-button)',
              }}
            >
              {saving ? 'Saving' : 'Record Payment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BillingClerkDashboard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const loadBills = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await billingApi.getAllBills(100);
      setBills(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to load bills.');
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  const pendingCount = bills.filter((b) => b.status === 'open' || b.status === 'partially_paid').length;
  const totalBalance = bills.reduce((sum, b) => sum + (b.balance_due ?? 0), 0);

  const openModal = (bill: Bill) => {
    setSelectedBill(bill);
  };

  const handlePaymentSuccess = () => {
    setSelectedBill(null);
    loadBills();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
      >
        <div>
          <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>
            Billing Queue
          </h1>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Manage patient bills and payments
          </p>
        </div>
        <button
          onClick={loadBills}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-body-sm font-semibold rounded-lg border hover:bg-[var(--bg-row-hover)] transition-colors disabled:opacity-60"
          style={{
            color: 'var(--text-primary)',
            borderColor: 'var(--border-default)',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-button)',
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div
        className="flex-shrink-0 grid grid-cols-3 gap-3 px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)' }}
      >
        <StatTile label="TOTAL BILLS" value={loading ? ' - ' : bills.length} />
        <StatTile
          label="PENDING"
          value={loading ? ' - ' : pendingCount}
          danger={pendingCount > 0}
        />
        <StatTile label="TOTAL BALANCE" value={loading ? ' - ' : fmtKES(totalBalance)} />
      </div>

      {error && (
        <div
          className="flex-shrink-0 mx-6 mt-4 px-4 py-3 rounded-xl border text-body-sm"
          style={{
            background: 'var(--bg-alert)',
            borderColor: 'var(--border-breach)',
            color: 'var(--sla-breached)',
            borderRadius: 'var(--radius-badge)',
          }}
        >
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--clinical-100)' }}
            >
              <DollarSign size={32} style={{ color: 'var(--clinical-600)' }} />
            </div>
            <p className="text-h3 mb-1" style={{ color: 'var(--text-primary)' }}>
              No bills yet
            </p>
            <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
              Bills appear here when patient visits are completed.
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              borderColor: 'var(--border-default)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <table className="w-full text-body-sm">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-base)',
                  }}
                >
                  {['Patient', 'Total', 'Paid', 'Balance', 'Status', 'Date', ''].map(
                    (col, i) => (
                      <th
                        key={i}
                        className={`px-5 py-2.5 text-label ${
                          i === 0 || i === 4 || i === 5 || i === 6
                            ? 'text-left'
                            : 'text-right'
                        }`}
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody
                className="divide-y"
                style={{ borderColor: 'var(--border-default)' }}
              >
                {bills.map((bill) => {
                  const { bg, text } = billStatusStyle(bill.status);
                  return (
                    <tr
                      key={bill._id}
                      className="hover:bg-[var(--bg-row-hover)] transition-colors"
                    >
                      <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {bill.patient_name ?? 'Unknown Patient'}
                      </td>
                      <td
                        className="px-5 py-3 text-right font-semibold tabular-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {fmtKES(bill.total_amount)}
                      </td>
                      <td
                        className="px-5 py-3 text-right tabular-nums"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {fmtKES(bill.paid_amount)}
                      </td>
                      <td
                        className="px-5 py-3 text-right font-semibold tabular-nums"
                        style={{
                          color:
                            bill.balance_due > 0
                              ? 'var(--sla-breached)'
                              : 'var(--sla-safe)',
                        }}
                      >
                        {fmtKES(bill.balance_due)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-label capitalize font-semibold"
                          style={{
                            background: bg,
                            color: text,
                            borderRadius: 'var(--radius-badge)',
                          }}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td
                        className="px-5 py-3"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {new Date(bill.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => openModal(bill)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-body-sm font-semibold text-white hover:opacity-90 transition-opacity"
                          style={{
                            background: 'var(--clinical-600)',
                            borderRadius: 'var(--radius-badge)',
                          }}
                        >
                          <Receipt size={12} />
                          {bill.status === 'paid' ? 'View' : 'Pay'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedBill && (
        <PaymentModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
