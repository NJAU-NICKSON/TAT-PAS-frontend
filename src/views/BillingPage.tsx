import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt,
  Loader2,
  RefreshCw,
  X,
  Banknote,
  ChevronRight,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Search,
  Filter,
} from 'lucide-react';
import { billingApi } from '../api/billing';
import { Bill, Payment, BillLineItem } from '../models/types';
import { useWebSocket } from '../context/WebSocketContext';
import { toast } from 'sonner';

function fmtKES(n: number | undefined | null) {
  return `KES ${(n ?? 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string | undefined | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(iso: string | undefined | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CATEGORY_LABEL: Record<string, string> = {
  consultation: 'Consultation',
  lab:          'Lab',
  radiology:    'Radiology',
  pharmacy:     'Pharmacy',
  ward:         'Ward',
  procedure:    'Procedure',
  other:        'Other',
};

const STATUS_STYLE: Record<string, {
  color:  string;
  bg:     string;
  border: string;
  icon:   typeof CheckCircle2;
  label:  string;
}> = {
  paid: {
    color:  '#059669',
    bg:     '#F0FDF4',
    border: '#BBF7D0',
    icon:   CheckCircle2,
    label:  'Paid',
  },
  partially_paid: {
    color:  '#2563EB',
    bg:     '#EFF6FF',
    border: '#BFDBFE',
    icon:   Clock,
    label:  'Partially Paid',
  },
  open: {
    color:  '#D97706',
    bg:     '#FFFBEB',
    border: '#FDE68A',
    icon:   Clock,
    label:  'Open',
  },
  finalized: {
    color:  '#7C3AED',
    bg:     '#F5F3FF',
    border: '#DDD6FE',
    icon:   CheckCircle2,
    label:  'Finalized',
  },
  waived: {
    color:  '#94A3B8',
    bg:     '#F8FAFC',
    border: '#E2E8F0',
    icon:   X,
    label:  'Waived',
  },
};

function printReceipt(bill: Bill) {
  const paid    = bill.paid_amount ?? 0;
  const balance = bill.balance_due ?? 0;

  const lineRows = bill.line_items.map((item: BillLineItem) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${CATEGORY_LABEL[item.category] ?? item.category}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${item.description}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${item.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${item.unit_price.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${item.total_price.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('');

  const payRows = bill.payments.map((p: Payment) => `
    <tr>
      <td style="padding:4px 8px">${fmtDateTime(p.received_at)}</td>
      <td style="padding:4px 8px;text-transform:capitalize">${p.method.replace('_', ' ')}</td>
      <td style="padding:4px 8px">${p.reference_number ?? '—'}</td>
      <td style="padding:4px 8px;text-align:right;color:#059669;font-weight:600">${p.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt — ${bill.bill_number ?? bill._id.slice(0, 8)}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0f172a; }
  .hospital-name { font-size: 20px; font-weight: 800; color: #0f172a; }
  .hospital-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .receipt-title { font-size: 14px; font-weight: 700; color: #0f172a; text-align: right; }
  .receipt-id { font-family: monospace; font-size: 11px; color: #64748b; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-item label { font-size: 10px; color: #94a3b8; display: block; }
  .info-item span { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { background: #f8fafc; }
  thead th { padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
  .totals { margin-left: auto; width: 280px; margin-top: 12px; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 8px; }
  .total-row.grand { font-weight: 800; font-size: 15px; background: #f1f5f9; padding: 8px; border-radius: 6px; margin-top: 4px; }
  .total-row.balance { color: ${balance > 0 ? '#dc2626' : '#059669'}; font-weight: 700; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: capitalize;
    background: ${STATUS_STYLE[bill.status]?.bg ?? '#f8fafc'}; color: ${STATUS_STYLE[bill.status]?.color ?? '#1e293b'}; border: 1px solid ${STATUS_STYLE[bill.status]?.border ?? '#e2e8f0'}; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 12px; } }
</style></head><body>
  <div class="header">
    <div>
      <div class="hospital-name">TAT-PAS Hospital</div>
      <div class="hospital-sub">Patient Administration System</div>
    </div>
    <div>
      <div class="receipt-title">OFFICIAL RECEIPT</div>
      <div class="receipt-id">Bill #${bill.bill_number ?? bill._id.slice(0, 16)}</div>
      <div style="margin-top:4px"><span class="status-badge">${STATUS_STYLE[bill.status]?.label ?? bill.status}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bill Information</div>
    <div class="info-grid">
      <div class="info-item"><label>Patient</label><span>${bill.patient_name ?? bill.patient_id}</span></div>
      <div class="info-item"><label>Visit</label><span>${bill.visit_number ?? bill.visit_id?.slice(0, 16) ?? '—'}</span></div>
      <div class="info-item"><label>Date Issued</label><span>${fmtDate(bill.created_at)}</span></div>
      <div class="info-item"><label>Last Updated</label><span>${fmtDate(bill.updated_at ?? bill.created_at)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Charges</div>
    <table>
      <thead><tr>
        <th>Category</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount (KES)</th>
      </tr></thead>
      <tbody>${lineRows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#94a3b8">No charges listed</td></tr>'}</tbody>
    </table>
    <div class="totals">
      ${bill.discount_amount > 0 ? `
        <div class="total-row"><span>Subtotal</span><span>${fmtKES(bill.subtotal)}</span></div>
        <div class="total-row" style="color:#059669"><span>Discount</span><span>-${fmtKES(bill.discount_amount)}</span></div>
        ${bill.discount_reason ? `<div style="font-size:10px;color:#94a3b8;text-align:right;padding:0 8px">${bill.discount_reason}</div>` : ''}
      ` : ''}
      ${bill.tax_amount > 0 ? `<div class="total-row"><span>Tax</span><span>${fmtKES(bill.tax_amount)}</span></div>` : ''}
      <div class="total-row grand"><span>TOTAL</span><span>${fmtKES(bill.total_amount)}</span></div>
    </div>
  </div>

  ${bill.payments.length > 0 ? `
  <div class="section">
    <div class="section-title">Payment History</div>
    <table>
      <thead><tr><th>Date/Time</th><th>Method</th><th>Reference</th><th>Amount (KES)</th></tr></thead>
      <tbody>${payRows}</tbody>
    </table>
    <div class="totals">
      <div class="total-row" style="color:#059669;font-weight:700"><span>Total Paid</span><span>${fmtKES(paid)}</span></div>
      <div class="total-row balance"><span>Balance Due</span><span>${fmtKES(balance)}</span></div>
    </div>
  </div>` : ''}

  <div class="footer">
    <p>Thank you for choosing TAT-PAS Hospital.</p>
    <p>This is a computer-generated receipt and requires no signature.</p>
    <p>Printed: ${new Date().toLocaleString('en-GB')}</p>
  </div>
</body></html>`;

  const win = window.open('', '_blank', 'width=780,height=900');
  if (!win) {
    toast.error('Allow popups to print receipts');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

function PaymentModal({ bill, onConfirm, onClose }: {
  bill:      Bill;
  onConfirm: (payment: Payment) => Promise<void>;
  onClose:   () => void;
}) {
  const balance = bill.balance_due ?? 0;

  const [amount,     setAmount]     = useState(balance);
  const [method,     setMethod]     = useState<Payment['method']>('cash');
  const [reference,  setRef]        = useState('');
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err,        setErr]        = useState('');

  const METHODS: { value: Payment['method']; label: string }[] = [
    { value: 'cash',         label: 'Cash'         },
    { value: 'card',         label: 'Card'         },
    { value: 'mpesa',        label: 'M-Pesa'       },
    { value: 'nhif',         label: 'NHIF'         },
    { value: 'insurance',    label: 'Insurance'    },
    { value: 'mobile_money', label: 'Mobile Money' },
  ];

  async function handlePay() {
    if (!amount || amount <= 0) {
      setErr('Amount must be greater than 0');
      return;
    }
    if (amount > balance + 0.01) {
      setErr(`Cannot exceed balance of ${fmtKES(balance)}`);
      return;
    }

    setErr('');
    setSubmitting(true);

    try {
      await onConfirm({
        amount,
        method,
        received_at:      new Date().toISOString(),
        reference_number: reference || undefined,
        notes:            notes || undefined,
      });
    } catch (e: unknown) {
      setErr((e as { detail?: string })?.detail ?? 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            background:   'linear-gradient(135deg,#0F172A,#064E3B)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <Banknote className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-body font-bold text-white">Record Payment</h2>
              <p className="text-caption" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {bill.patient_name ?? 'Patient'} · {bill.bill_number ?? 'Bill'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.5)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total',   value: fmtKES(bill.total_amount), color: 'var(--text-primary)' },
              { label: 'Paid',    value: fmtKES(bill.paid_amount),  color: '#059669' },
              { label: 'Balance', value: fmtKES(balance),           color: balance > 0 ? '#DC2626' : '#059669' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="text-center p-3 rounded-xl"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}
              >
                <p className="text-caption" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-body-sm font-extrabold tabular-nums mt-0.5" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p
                className="text-caption font-bold uppercase tracking-wider mb-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Amount (KES) *
              </p>
              <input
                type="number"
                min={0.01}
                max={balance}
                step="0.01"
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none text-right tabular-nums"
                style={{
                  background: 'var(--surface-1)',
                  border:     '1px solid var(--border-default)',
                  color:      'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <p
                className="text-caption font-bold uppercase tracking-wider mb-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Method *
              </p>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as Payment['method'])}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{
                  background: 'var(--surface-1)',
                  border:     '1px solid var(--border-default)',
                  color:      'var(--text-primary)',
                }}
              >
                {METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p
              className="text-caption font-bold uppercase tracking-wider mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Reference / Receipt No.
            </p>
            <input
              value={reference}
              onChange={e => setRef(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{
                background: 'var(--surface-1)',
                border:     '1px solid var(--border-default)',
                color:      'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <p
              className="text-caption font-bold uppercase tracking-wider mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Notes
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional"
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
              style={{
                background: 'var(--surface-1)',
                border:     '1px solid var(--border-default)',
                color:      'var(--text-primary)',
              }}
            />
          </div>

          {err && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {err}
            </div>
          )}
        </div>

        <div
          className="flex gap-3 px-5 py-4 justify-end"
          style={{ borderTop: '1px solid var(--border-default)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border"
            style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={!amount || amount <= 0 || submitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
            style={{ background: '#059669' }}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function BillDrawer({ bill, onClose, onPaymentAdded }: {
  bill:           Bill;
  onClose:        () => void;
  onPaymentAdded: (b: Bill) => void;
}) {
  const [showPayment, setShowPayment] = useState(false);

  const statusStyle = STATUS_STYLE[bill.status] ?? STATUS_STYLE.open;
  const Icon        = statusStyle.icon;
  const balance     = bill.balance_due ?? 0;

  const handlePayment = async (payment: Payment) => {
    const updated = await billingApi.addPayment(bill._id, payment);
    onPaymentAdded(updated);
    setShowPayment(false);
    toast.success(`Payment of ${fmtKES(payment.amount)} recorded`);
    if (updated.balance_due <= 0) {
      toast.success('Bill fully paid!', { description: 'Generating receipt…' });
      setTimeout(() => printReceipt(updated), 600);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.2)' }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-[500px] max-w-full flex flex-col"
        style={{
          background:  'var(--surface-0)',
          boxShadow:   'var(--shadow-modal)',
          zIndex:      41,
          borderLeft:  '1px solid var(--border-default)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <div>
            <p className="text-caption font-semibold" style={{ color: 'var(--text-muted)' }}>
              {bill.bill_number ?? '—'}
            </p>
            <h2 className="text-body font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {bill.patient_name ?? 'Patient Bill'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => printReceipt(bill)}
              title="Print Receipt"
              className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-bold rounded-xl border"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            {balance > 0 && (
              <button
                onClick={() => setShowPayment(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-bold text-white rounded-xl"
                style={{ background: '#059669' }}
              >
                <Banknote className="w-3.5 h-3.5" /> Pay
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total',   value: fmtKES(bill.total_amount), color: 'var(--text-primary)' },
              { label: 'Paid',    value: fmtKES(bill.paid_amount),  color: '#059669' },
              { label: 'Balance', value: fmtKES(balance),           color: balance > 0 ? '#DC2626' : '#059669' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="text-center p-3 rounded-xl"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}
              >
                <p className="text-caption" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-body font-extrabold tabular-nums mt-0.5" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="flex items-center gap-1.5 text-caption font-bold px-3 py-1 rounded-full"
              style={{
                background: statusStyle.bg,
                color:      statusStyle.color,
                border:     `1px solid ${statusStyle.border}`,
              }}
            >
              <Icon className="w-3 h-3" />
              {statusStyle.label}
            </span>
            <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
              Created {fmtDate(bill.created_at)}
            </span>
            {bill.visit_id && (
              <Link
                to={`/visits/${bill.visit_id}`}
                onClick={onClose}
                className="flex items-center gap-1 text-caption font-semibold"
                style={{ color: 'var(--clinical-600)' }}
              >
                View Visit <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {bill.discount_amount > 0 && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >
              <span className="font-semibold text-green-700">
                Discount Applied: {fmtKES(bill.discount_amount)}
              </span>
              {bill.discount_reason && (
                <span className="text-green-600"> — {bill.discount_reason}</span>
              )}
            </div>
          )}

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border-default)' }}
          >
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-default)' }}
            >
              <CreditCard className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
              <p
                className="text-caption font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Charges
              </p>
            </div>
            {bill.line_items.length === 0 ? (
              <p
                className="text-center py-6 text-body-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                No charges listed.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
                    {['Category', 'Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                      <th
                        key={h}
                        className={`px-4 py-2 text-caption font-semibold uppercase tracking-wider text-left ${['Qty', 'Unit Price', 'Total'].includes(h) ? 'text-right' : ''}`}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bill.line_items.map((item, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid var(--border-default)',
                        background:   i % 2 === 0 ? 'transparent' : 'var(--surface-1)',
                      }}
                    >
                      <td className="px-4 py-2.5">
                        <span
                          className="text-caption font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                        >
                          {CATEGORY_LABEL[item.category] ?? item.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
                        {item.description}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {item.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {item.unit_price.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {item.total_price.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border-default)' }}>
                    <td
                      colSpan={4}
                      className="px-4 py-2.5 text-right font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {fmtKES(bill.total_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {bill.payments.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border-default)' }}
            >
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-default)' }}
              >
                <Banknote className="w-3.5 h-3.5" style={{ color: '#059669' }} />
                <p
                  className="text-caption font-bold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Payment History
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                {bill.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p
                        className="text-body-sm font-semibold capitalize"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {p.method.replace('_', ' ')}
                      </p>
                      <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                        {fmtDateTime(p.received_at)}
                        {p.reference_number && ` · Ref: ${p.reference_number}`}
                      </p>
                      {p.notes && (
                        <p className="text-caption italic" style={{ color: 'var(--text-muted)' }}>
                          {p.notes}
                        </p>
                      )}
                    </div>
                    <span className="font-extrabold tabular-nums" style={{ color: '#059669' }}>
                      {fmtKES(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          bill={bill}
          onConfirm={handlePayment}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  );
}

export default function BillingPage() {
  const [bills,        setBills]        = useState<Bill[]>([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { subscribe } = useWebSocket();

  const loadBills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await billingApi.getAllBills(200);
      setBills(data);
    } catch (err: unknown) {
      setError((err as { detail?: string }).detail ?? 'Failed to load bills');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  useEffect(() => {
    const unsub = subscribe('payment_recorded', (evt) => {
      const { bill_id } = evt.data as { bill_id?: string };
      if (!bill_id) return;

      billingApi.getBill(bill_id)
        .then(updated => {
          setBills(prev => prev.map(b => b._id === bill_id ? updated : b));
          if (selectedBill?._id === bill_id) setSelectedBill(updated);
          toast.info(evt.message, { description: `${evt.triggered_by_role} recorded payment` });
        })
        .catch(() => {});
    });
    return unsub;
  }, [subscribe, selectedBill]);

  useEffect(() => {
    const unsub = subscribe('bill_created', () => {
      loadBills();
      toast.info('New bill created');
    });
    return unsub;
  }, [subscribe, loadBills]);

  const handlePaymentAdded = (updated: Bill) => {
    setBills(prev => prev.map(b => b._id === updated._id ? updated : b));
    setSelectedBill(updated);
  };

  const filtered = bills.filter(b => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const q           = search.toLowerCase();
    const matchSearch = !q
      || (b.patient_name ?? '').toLowerCase().includes(q)
      || b._id.toLowerCase().includes(q)
      || b.visit_id?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const total      = bills.reduce((s, b) => s + (b.total_amount ?? 0), 0);
  const totalPaid  = bills.reduce((s, b) => s + (b.paid_amount  ?? 0), 0);
  const totalBal   = bills.reduce((s, b) => s + (b.balance_due  ?? 0), 0);
  const openCnt    = bills.filter(b => b.status === 'open').length;
  const partialCnt = bills.filter(b => b.status === 'partially_paid').length;
  const paidCnt    = bills.filter(b => b.status === 'paid').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>Billing</h1>
          <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Patient bills and payment records
          </p>
        </div>
        <button
          onClick={loadBills}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border transition-colors hover:bg-[var(--bg-base)] disabled:opacity-50"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Billed',   value: fmtKES(total),     color: '#0F172A',                                   bg: 'var(--bg-card)' },
          { label: 'Total Received', value: fmtKES(totalPaid), color: '#059669',                                   bg: '#F0FDF4' },
          { label: 'Outstanding',    value: fmtKES(totalBal),  color: totalBal > 0 ? '#DC2626' : '#059669',        bg: totalBal > 0 ? '#FEF2F2' : '#F0FDF4' },
          { label: 'Open',           value: openCnt,            color: '#D97706',                                   bg: '#FFFBEB' },
          { label: 'Partial',        value: partialCnt,         color: '#2563EB',                                   bg: '#EFF6FF' },
          { label: 'Paid',           value: paidCnt,            color: '#059669',                                   bg: '#F0FDF4' },
        ].map(({ label, value, color, bg }) => (
          <div
            key={label}
            className="rounded-xl p-4 text-center"
            style={{ background: bg, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}
          >
            <p
              className="text-caption font-bold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {label}
            </p>
            <p className="text-lg font-extrabold tabular-nums mt-1 leading-none" style={{ color }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{
            background: 'var(--status-critical-bg)',
            border:     '1px solid var(--status-critical-border)',
            color:      'var(--status-critical-text)',
          }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={loadBills} className="ml-auto text-caption font-bold underline">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, bill ID, visit…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none"
            style={{
              background: 'var(--bg-card)',
              border:     '1px solid var(--border-default)',
              color:      'var(--text-primary)',
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl focus:outline-none"
            style={{
              background: 'var(--bg-card)',
              border:     '1px solid var(--border-default)',
              color:      'var(--text-primary)',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="finalized">Finalized</option>
            <option value="waived">Waived</option>
          </select>
        </div>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}
      >
        <div
          className="flex items-center gap-2.5 px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <Receipt className="w-4 h-4" style={{ color: '#2563EB' }} />
          <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>
            All Bills
          </p>
          <span
            className="text-caption font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}
          >
            {filtered.length}
          </span>
          {filtered.length !== bills.length && (
            <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
              of {bills.length}
            </span>
          )}
        </div>

        {isLoading && bills.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--clinical-600)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Receipt className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
            <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
              {bills.length === 0 ? 'No bills found' : 'No bills match your filters'}
            </p>
            {bills.length > 0 && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); }}
                className="text-caption font-semibold underline"
                style={{ color: 'var(--clinical-600)' }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
                  {['Bill ID', 'Patient', 'Visit', 'Total', 'Paid', 'Balance', 'Status', 'Date', ''].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-caption font-semibold uppercase tracking-wider text-left"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((bill, i) => {
                  const s       = STATUS_STYLE[bill.status] ?? STATUS_STYLE.open;
                  const Icon    = s.icon;
                  const balance = bill.balance_due ?? 0;

                  return (
                    <tr
                      key={bill._id}
                      onClick={() => setSelectedBill(bill)}
                      className="cursor-pointer transition-colors hover:bg-[var(--bg-row-hover)]"
                      style={{
                        borderBottom: '1px solid var(--border-default)',
                        background:   i % 2 === 0 ? 'transparent' : 'var(--surface-1)',
                      }}
                    >
                      <td className="px-5 py-3">
                        <span
                          className="text-caption font-semibold tabular-nums"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {bill.bill_number ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {bill.patient_name ?? bill.patient_id.slice(0, 8) + '…'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {bill.visit_id ? (
                          <Link
                            to={`/visits/${bill.visit_id}`}
                            onClick={e => e.stopPropagation()}
                            className="text-caption font-semibold flex items-center gap-1 hover:underline"
                            style={{ color: 'var(--clinical-600)' }}
                          >
                            {bill.visit_number ?? bill.visit_id.slice(0, 8)}
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-caption" style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fmtKES(bill.total_amount)}
                      </td>
                      <td className="px-5 py-3 tabular-nums" style={{ color: '#059669' }}>
                        {fmtKES(bill.paid_amount)}
                      </td>
                      <td className="px-5 py-3 tabular-nums font-semibold" style={{ color: balance > 0 ? '#DC2626' : '#059669' }}>
                        {fmtKES(balance)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="flex items-center gap-1.5 text-caption font-bold px-2.5 py-1 rounded-full w-fit"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                        >
                          <Icon className="w-3 h-3" />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-caption" style={{ color: 'var(--text-muted)' }}>
                        {fmtDate(bill.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); printReceipt(bill); }}
                            title="Print"
                            className="p-1.5 rounded-lg hover:bg-[var(--surface-1)]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {balance > 0 && (
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedBill(bill); }}
                              className="flex items-center gap-1 text-caption font-bold px-2.5 py-1 rounded-lg text-white"
                              style={{ background: '#059669' }}
                            >
                              <Banknote className="w-3 h-3" /> Pay
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        </div>
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
        <BillDrawer
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onPaymentAdded={handlePaymentAdded}
        />
      )}
    </div>
  );
}
