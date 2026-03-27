import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Bed, UserCheck, Stethoscope, FlaskConical,
  CreditCard, ClipboardCheck, Clock, CheckCircle2, Circle,
  AlertCircle, Loader2, RefreshCw, X, User, FilePlus,
  ChevronRight, Pill, MapPin, Activity, Receipt,
  PlusCircle, Banknote, Building2, Calendar, Thermometer,
} from 'lucide-react';
import { toast } from 'sonner';
import { visitsApi, Visit, JourneySummary, JourneyStageSummary, UpdateVisitPayload, VitalSigns, TriagePayload } from '../api/visits';
import { bedsApi, Bed as BedType } from '../api/beds';
import { departmentsApi, Department } from '../api/departments';
import { consultationRoomsApi, ConsultationRoom } from '../api/consultationRooms';
import { prescriptionsApi } from '../api/prescriptions';
import { billingApi } from '../api/billing';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { Prescription, Bill, BillLineItem, Payment, User as UserType } from '../models/types';

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registered', triaged: 'Triaged',
  waiting_for_doctor: 'Waiting for Doctor', in_consultation: 'In Consultation',
  awaiting_results: 'Awaiting Results', treatment_in_progress: 'Treatment in Progress',
  admitted: 'Admitted', in_ward: 'In Ward',
  ready_for_discharge: 'Ready for Discharge', discharged: 'Discharged', cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  registered:           { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
  triaged:              { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  waiting_for_doctor:   { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  in_consultation:      { color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
  awaiting_results:     { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  treatment_in_progress:{ color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  admitted:             { color: '#059669', bg: '#F0FDF4', border: '#BBF7D0' },
  in_ward:              { color: '#059669', bg: '#F0FDF4', border: '#BBF7D0' },
  ready_for_discharge:  { color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
  discharged:           { color: '#059669', bg: '#F0FDF4', border: '#BBF7D0' },
  cancelled:            { color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' },
};

const RX_STATUS_COLORS: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  draft:        { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8' },
  submitted:    { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', dot: '#2563EB' },
  flagged:      { color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF', dot: '#7C3AED' },
  verified:     { color: '#059669', bg: '#F0FDF4', border: '#BBF7D0', dot: '#059669' },
  dispensed:    { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', dot: '#D97706' },
  administered: { color: '#059669', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  archived:     { color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0', dot: '#CBD5E1' },
};

const BILL_STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  open:          { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  partially_paid:{ color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  paid:          { color: '#059669', bg: '#F0FDF4', border: '#BBF7D0' },
  finalized:     { color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
  waived:        { color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' },
};

const STAGE_ICONS = [UserCheck, Stethoscope, Stethoscope, FlaskConical, CreditCard, ClipboardCheck];

function fmtTime(iso?: string) {
  if (!iso) return 'â€”';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso?: string) {
  if (!iso) return 'â€”';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtKES(n: number) {
  return `KES ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
      <div className="flex items-center gap-2.5">
        {icon}
        <div>
          <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
          {sub && <p className="text-caption" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MODALS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function AdmitModal({
  departmentId, doctors, onConfirm, onClose,
}: {
  departmentId: string;
  doctors: UserType[];
  onConfirm: (bedId: string, notes: string, doctorId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [beds, setBeds]             = useState<BedType[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(true);
  const [selectedBed, setSelectedBed] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    bedsApi.list({ department_id: departmentId, status: 'available' })
      .then(r => setBeds(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Failed to load available beds'))
      .finally(() => setLoadingBeds(false));
  }, [departmentId]);

  const bedTypeColors: Record<string, string> = {
    icu: '#DC2626', hdu: '#D97706', nicu: '#DB2777', isolation: '#7C3AED',
    general: '#2563EB', maternity: '#EC4899', birthing: '#EC4899',
    paediatric: '#059669', day_case: '#475569',
  };

  async function handleSubmit() {
    if (!selectedBed) { setError('Please select a bed'); return; }
    setSubmitting(true); setError('');
    try { await onConfirm(selectedBed, notes, selectedDoctor || undefined); }
    catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Admission failed'); setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden animate-slide-up" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Bed className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-body font-bold text-white">Admit Patient</h2>
              <p className="text-caption" style={{ color: 'rgba(255,255,255,0.5)' }}>Assign bed and attending doctor</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Select Bed *</p>
            {loadingBeds ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--clinical-600)' }} /></div>
            ) : beds.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                <AlertCircle className="w-4 h-4" /> No available beds in this department.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {beds.map(bed => {
                  const accentColor = bedTypeColors[bed.bed_type] ?? '#2563EB';
                  const selected = selectedBed === bed.id;
                  return (
                    <label
                      key={bed.id}
                      className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: selected ? `${accentColor}10` : 'var(--surface-1)',
                        border: `1px solid ${selected ? accentColor : 'var(--border-default)'}`,
                      }}
                    >
                      <input type="radio" name="bed" value={bed.id} checked={selected} onChange={() => setSelectedBed(bed.id)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{bed.bed_label}</span>
                          <span className="text-caption font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: `${accentColor}18`, color: accentColor }}>
                            {bed.bed_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-caption flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <Building2 className="w-3 h-3" /> Ward: <strong>{bed.ward_name}</strong>
                          </span>
                          <span className="text-caption flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <MapPin className="w-3 h-3" /> Room {bed.room_number}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Assign Attending Doctor (optional)</p>
            <select
              value={selectedDoctor}
              onChange={e => setSelectedDoctor(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              <option value="">â€” Not assigned yet â€”</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Admission Notes</p>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes about the admission..."
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 justify-end" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border transition-colors" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || beds.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-opacity"
            style={{ background: '#1D4ED8' }}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Admission
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignDoctorModal({
  doctors, currentDoctorId, onConfirm, onClose,
}: {
  doctors: UserType[];
  currentDoctorId?: string;
  onConfirm: (doctorId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(currentDoctorId ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try { await onConfirm(selected); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-slide-up" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: '#2563EB' }} />
            <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Assign Doctor</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Select the attending doctor for this patient.</p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {doctors.map(d => (
              <label key={d.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors" style={{ background: selected === d.id ? 'rgba(37,99,235,0.08)' : 'var(--surface-1)', border: `1px solid ${selected === d.id ? '#2563EB' : 'var(--border-default)'}` }}>
                <input type="radio" name="doctor" value={d.id} checked={selected === d.id} onChange={() => setSelected(d.id)} />
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--clinical-100)', color: 'var(--clinical-700)' }}>
                  {d.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dr. {d.full_name}</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>{d.email}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 justify-end" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!selected || submitting} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50" style={{ background: '#2563EB' }}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

const CHARGE_PRESETS = [
  { label: 'Consultation Fee',       description: 'Consultation', unit_price: 1500, category: 'consultation' as const },
  { label: 'Bed Charge â€” General',   description: 'Bed (General)', unit_price: 2000, category: 'ward' as const },
  { label: 'Bed Charge â€” ICU',       description: 'Bed (ICU)', unit_price: 8000, category: 'ward' as const },
  { label: 'Bed Charge â€” HDU',       description: 'Bed (HDU)', unit_price: 5000, category: 'ward' as const },
  { label: 'Bed Charge â€” NICU',      description: 'Bed (NICU)', unit_price: 6000, category: 'ward' as const },
  { label: 'Nursing Care',           description: 'Nursing Care', unit_price: 1000, category: 'ward' as const },
  { label: 'Lab / Diagnostics',      description: 'Lab Tests', unit_price: 800, category: 'lab' as const },
  { label: 'Radiology / Imaging',    description: 'Radiology', unit_price: 3000, category: 'radiology' as const },
  { label: 'Medication',             description: 'Medication', unit_price: 0, category: 'pharmacy' as const },
  { label: 'Procedure / Surgery',    description: 'Procedure', unit_price: 0, category: 'procedure' as const },
  { label: 'Other',                  description: '', unit_price: 0, category: 'other' as const },
];

function AddLineItemModal({ onConfirm, onClose }: {
  onConfirm: (item: BillLineItem) => Promise<void>;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState(0);
  const [description, setDescription] = useState(CHARGE_PRESETS[0].description);
  const [category, setCategory] = useState(CHARGE_PRESETS[0].category);
  const [qty, setQty]       = useState(1);
  const [unitPrice, setUnitPrice] = useState(CHARGE_PRESETS[0].unit_price);
  const [submitting, setSubmitting] = useState(false);

  function applyPreset(i: number) {
    setPreset(i);
    setDescription(CHARGE_PRESETS[i].description);
    setCategory(CHARGE_PRESETS[i].category);
    setUnitPrice(CHARGE_PRESETS[i].unit_price);
  }

  const totalPrice = qty * unitPrice;

  async function handleAdd() {
    if (!description.trim() || unitPrice <= 0) return;
    setSubmitting(true);
    try { await onConfirm({ description: description.trim(), quantity: qty, unit_price: unitPrice, total_price: totalPrice, category }); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden animate-slide-up" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" style={{ color: '#059669' }} />
            <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Add Charge</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Quick Select</p>
            <select
              value={preset}
              onChange={e => applyPreset(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              {CHARGE_PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
            </select>
          </div>

          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Procedure / Description *</p>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              placeholder="e.g. Consultation, Lab Test..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Quantity</p>
              <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none text-right tabular-nums"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Unit Price (KES)</p>
              <input type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none text-right tabular-nums"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
            <span className="text-body-sm font-semibold" style={{ color: '#059669' }}>Total Amount</span>
            <span className="text-xl font-extrabold tabular-nums" style={{ color: '#059669' }}>{fmtKES(totalPrice)}</span>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 justify-end" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>Cancel</button>
          <button onClick={handleAdd} disabled={!description.trim() || unitPrice <= 0 || submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
            style={{ background: '#059669' }}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Add to Bill
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({ balance, onConfirm, onClose }: {
  balance: number;
  onConfirm: (payment: Payment) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount]   = useState(balance);
  const [method, setMethod]   = useState<Payment['method']>('cash');
  const [receipt, setReceipt] = useState('');
  const [notes, setNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const METHODS: { value: Payment['method']; label: string }[] = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'mpesa', label: 'M-Pesa' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'nhif', label: 'NHIF' },
  ];

  async function handlePay() {
    if (!amount || amount <= 0) return;
    setSubmitting(true);
    try {
      await onConfirm({ amount, method, received_at: new Date().toISOString(), reference_number: receipt || undefined, notes: notes || undefined });
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-slide-up" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4" style={{ color: '#059669' }} />
            <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Record Payment</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="text-center py-3 rounded-xl" style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
            <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Balance Due</p>
            <p className="text-2xl font-extrabold tabular-nums mt-1" style={{ color: balance > 0 ? '#DC2626' : '#059669' }}>{fmtKES(balance)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Amount (KES) *</p>
              <input type="number" min={1} max={balance} value={amount} onChange={e => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none text-right tabular-nums"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Method *</p>
              <select value={method} onChange={e => setMethod(e.target.value as Payment['method'])}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Receipt / Reference No.</p>
            <input value={receipt} onChange={e => setReceipt(e.target.value)} placeholder="Optional"
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          </div>

          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional"
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 justify-end" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>Cancel</button>
          <button onClick={handlePay} disabled={!amount || amount <= 0 || submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
            style={{ background: '#059669' }}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function StageCard({ stage, isLast }: { stage: JourneyStageSummary; isLast: boolean }) {
  const Icon = STAGE_ICONS[stage.stage - 1] ?? Circle;
  const done   = stage.completed_at != null;
  const active = stage.started_at != null && !done;
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
          done ? 'bg-green-100 text-green-600' : active ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-400' : 'bg-gray-100 text-gray-400'
        }`}>
          {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
        </div>
        {!isLast && <div className={`w-0.5 flex-1 mt-1 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />}
      </div>
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{stage.name}</p>
            <p className="text-caption capitalize" style={{ color: 'var(--text-muted)' }}>{stage.role}</p>
          </div>
          {stage.tat_min != null ? (
            <span className={`text-caption font-semibold px-2 py-0.5 rounded-full ${
              stage.tat_min <= stage.target_min ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {stage.tat_min} min {stage.tat_min > stage.target_min ? 'âš  over' : 'âœ“'}
            </span>
          ) : active ? (
            <span className="text-caption font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">In Progress</span>
          ) : (
            <span className="text-caption px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Pending</span>
          )}
        </div>
        <div className="mt-1.5 flex gap-4 text-caption" style={{ color: 'var(--text-muted)' }}>
          <span>Start: {fmtTime(stage.started_at)}</span>
          <span>End: {fmtTime(stage.completed_at)}</span>
          <span>Target: {stage.target_min} min</span>
        </div>
      </div>
    </div>
  );
}

function ConsultationNoteModal({
  visit, nurses, onConfirm, onClose,
}: {
  visit: Visit;
  nurses: UserType[];
  onConfirm: (data: UpdateVisitPayload) => Promise<void>;
  onClose: () => void;
}) {
  const [room, setRoom]           = useState(visit.consultation_room ?? '');
  const [nurseId, setNurseId]     = useState(visit.consultation_nurse_id ?? '');
  const [findings, setFindings]   = useState(visit.clinical_findings ?? '');
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis ?? '');
  const [recs, setRecs]           = useState(visit.recommendations ?? '');
  const [followUp, setFollowUp]   = useState(visit.follow_up_instructions ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      await onConfirm({
        consultation_room: room.trim() || undefined,
        consultation_nurse_id: nurseId || undefined,
        clinical_findings: findings.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        recommendations: recs.trim() || undefined,
        follow_up_instructions: followUp.trim() || undefined,
      });
    } finally { setSubmitting(false); }
  }

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder: string, rows = 3) => (
    <div>
      <p className="text-caption font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden animate-slide-up" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(135deg,#4C1D95,#7C3AED)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-body font-bold text-white">Consultation Notes</h2>
              <p className="text-caption" style={{ color: 'rgba(255,255,255,0.5)' }}>{visit.patient_name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.5)' }}><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Consultation Room</p>
              <input
                type="text" value={room} onChange={e => setRoom(e.target.value)}
                placeholder="e.g. Room 3A, OPD-2, Consultation 1..."
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Assisting Nurse</p>
              <select
                value={nurseId} onChange={e => setNurseId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                <option value="">None / Not applicable</option>
                {nurses.filter(u => u.role === 'nurse').map(n => (
                  <option key={n.id} value={n.id}>{n.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {field('Clinical Findings / Examination', findings, setFindings, 'Document examination findings, observations, patient presentation...', 4)}
          {field('Diagnosis', diagnosis, setDiagnosis, 'Working or confirmed diagnosis...', 2)}
          {field('Recommendations / Plan of Care', recs, setRecs, 'Treatment plan, interventions, referrals...', 3)}
          {field('Follow-up Instructions', followUp, setFollowUp, 'Patient instructions, review date, warning signs to watch for...', 2)}
        </div>

        <div className="flex gap-3 px-6 py-4 justify-end" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>Cancel</button>
          <button onClick={handleSave} disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
            style={{ background: '#7C3AED' }}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Consultation Notes
          </button>
        </div>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN PAGE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
type Tab = 'overview' | 'triage' | 'care' | 'consultation' | 'prescriptions' | 'billing';

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [visit, setVisit]               = useState<Visit | null>(null);
  const [journey, setJourney]           = useState<JourneySummary | null>(null);
  const [department, setDepartment]     = useState<Department | null>(null);
  const [bed, setBed]                   = useState<BedType | null>(null);
  const [assignedDoctor, setAssignedDoctor] = useState<UserType | null>(null);
  const [doctors, setDoctors]           = useState<UserType[]>([]);
  const [rooms, setRooms]               = useState<ConsultationRoom[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [bill, setBill]                 = useState<Bill | null>(null);

  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'overview';
  const [activeTab, setActiveTab]       = useState<Tab>(initialTab);

  const [showAdmit, setShowAdmit]       = useState(false);
  const [showAssignDoc, setShowAssignDoc] = useState(false);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showPayment, setShowPayment]   = useState(false);
  const [showConsultForm, setShowConsultForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Triage form state
  const [triageVitals, setTriageVitals] = useState<VitalSigns>({});
  const [triageDoctorId, setTriageDoctorId] = useState('');
  const [triageRoomId, setTriageRoomId] = useState('');
  const [triageLoading, setTriageLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const [vRes, jRes] = await Promise.all([visitsApi.getById(id), visitsApi.journey(id)]);
      const v = vRes.data;
      setVisit(v);
      setJourney(jRes.data);

      // parallel secondary loads
      const [deptRes, docsRes, roomsRes, rxRes, billsRes, bedRes, docRes] = await Promise.allSettled([
        departmentsApi.getById(v.department_id).catch(async () => {
          const all = await departmentsApi.list();
          const items = Array.isArray(all.data) ? all.data : (all.data as unknown as { items: Department[] }).items ?? [];
          const match = items.find((d: Department) => d.id === v.department_id);
          if (!match) throw new Error('not found');
          return { data: match };
        }),
        usersApi.listDoctors(),
        consultationRoomsApi.list({ department_id: v.department_id }),
        prescriptionsApi.list({ patient_id: v.patient_id, limit: 20 }),
        billingApi.getBillsByVisit(id),
        v.bed_id ? bedsApi.getById(v.bed_id) : Promise.resolve(null),
        v.assigned_doctor_id ? usersApi.getById(v.assigned_doctor_id) : Promise.resolve(null),
      ]);

      if (deptRes.status === 'fulfilled') setDepartment(deptRes.value.data as Department);
      if (docsRes.status === 'fulfilled') {
        const d = docsRes.value.data;
        const items: UserType[] = Array.isArray(d) ? d : (d as { items: UserType[] }).items ?? [];
        setDoctors(items.filter((u: UserType) => u.role === 'doctor'));
      }
      if (roomsRes.status === 'fulfilled') {
        const r = roomsRes.value.data;
        setRooms(Array.isArray(r) ? r : (r as { items: ConsultationRoom[] }).items ?? []);
      }
      if (rxRes.status === 'fulfilled') setPrescriptions(Array.isArray(rxRes.value.data) ? rxRes.value.data : []);
      if (billsRes.status === 'fulfilled' && billsRes.value != null) setBill(billsRes.value);
      if (bedRes.status === 'fulfilled' && bedRes.value) setBed((bedRes.value as { data: BedType }).data);
      if (docRes.status === 'fulfilled' && docRes.value) setAssignedDoctor((docRes.value as { data: UserType }).data);
    } catch {
      setError('Failed to load visit data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAdmit = async (bedId: string, notes: string, doctorId?: string) => {
    if (!id) return;
    await visitsApi.admit(id, { bed_id: bedId, notes });
    if (doctorId) {
      await visitsApi.update(id, { assigned_doctor_id: doctorId });
    }
    setShowAdmit(false);
    toast.success('Patient admitted successfully');
    await load();
  };

  const handleAssignDoctor = async (doctorId: string) => {
    if (!id) return;
    await visitsApi.update(id, { assigned_doctor_id: doctorId });
    setShowAssignDoc(false);
    toast.success('Doctor assigned');
    await load();
  };

  const handleDischarge = async () => {
    if (!id || !window.confirm('Confirm discharge? The assigned bed will be released.')) return;
    setActionLoading(true);
    try { await visitsApi.discharge(id); toast.success('Patient discharged'); await load(); }
    catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Discharge failed'); }
    finally { setActionLoading(false); }
  };

  const handleAddCharge = async (item: BillLineItem) => {
    if (!visit) return;
    let currentBill = bill;

    if (!currentBill) {
      // create the bill first
      const newBill = await billingApi.createBill(id!, [item]);
      setBill(newBill);
    } else {
      const updatedItems = [...currentBill.line_items, item];
      const updated = await billingApi.updateBill(currentBill._id, { line_items: updatedItems });
      setBill(updated);
    }
    setShowAddCharge(false);
    toast.success('Charge added to bill');
  };

  const handlePayment = async (payment: Payment) => {
    if (!bill) return;
    const updated = await billingApi.addPayment(bill._id, payment);
    setBill(updated);
    setShowPayment(false);
    toast.success(`Payment of ${fmtKES(payment.amount)} recorded`);
  };

  const handleGenerateBill = async () => {
    if (!visit) return;
    const lineItems: BillLineItem[] = [
      { description: 'Consultation Fee', quantity: 1, unit_price: 1500, total_price: 1500, category: 'consultation' },
    ];
    if (bed) {
      const bedRates: Record<string, number> = { icu: 8000, hdu: 5000, nicu: 6000, general: 2000, isolation: 3000, maternity: 3500, paediatric: 2500, day_case: 1500, birthing: 4000 };
      const bedRate = bedRates[bed.bed_type] ?? 2000;
      lineItems.push({ description: `Bed Charge (${bed.bed_type.toUpperCase()}) â€” ${bed.bed_label}`, quantity: 1, unit_price: bedRate, total_price: bedRate, category: 'ward' });
    }
    const newBill = await billingApi.createBill(id!, lineItems);
    setBill(newBill);
    toast.success('Bill generated');
  };

  const handleTriage = async () => {
    if (!id) return;
    setTriageLoading(true);
    try {
      const payload: TriagePayload = { vitals: triageVitals };
      if (triageDoctorId) payload.assigned_doctor_id = triageDoctorId;
      if (triageRoomId) payload.consultation_room = triageRoomId;
      await visitsApi.triage(id, payload);
      toast.success('Triage recorded');
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Triage failed');
    } finally {
      setTriageLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--clinical-600)' }} />
      </div>
    );
  }
  if (error || !visit) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-10 h-10" style={{ color: 'var(--status-critical-icon)' }} />
        <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>{error || 'Visit not found'}</p>
        <p className="text-caption" style={{ color: 'var(--text-muted)' }}>The visit may no longer exist or you may be using a stale link.</p>
        <div className="flex items-center gap-3 mt-1">
          <button onClick={() => load()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90" style={{ background: 'var(--clinical-600)' }}>
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
          <button onClick={() => navigate('/visits')} className="text-body-sm font-medium" style={{ color: 'var(--clinical-600)' }}>Back to visits</button>
        </div>
      </div>
    );
  }

  const canAdmit     = ['nurse', 'admin', 'doctor'].includes(user?.role ?? '');
  const canDischarge = ['nurse', 'admin', 'doctor', 'auditor'].includes(user?.role ?? '');
  const canBill      = ['billing', 'admin', 'nurse'].includes(user?.role ?? '');
  const canTriage    = ['nurse', 'admin'].includes(user?.role ?? '');
  const isAdmitted   = ['admitted', 'in_ward'].includes(visit.status);
  const isDischarged = visit.status === 'discharged';
  const statusStyle  = STATUS_COLORS[visit.status] ?? STATUS_COLORS.registered;
  const needsTriage  = visit.status === 'registered';

  const TABS: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'overview',      label: 'Overview',      icon: Activity },
    ...(canTriage ? [{ key: 'triage' as Tab,        label: 'Triage',         icon: Thermometer,  badge: needsTriage ? 1 : undefined }] : []),
    { key: 'care',          label: 'Care Team',      icon: UserCheck, badge: isAdmitted ? undefined : 1 },
    { key: 'consultation',  label: 'Consultation',   icon: Stethoscope },
    { key: 'prescriptions', label: 'Prescriptions',  icon: Pill,      badge: prescriptions.length || undefined },
    { key: 'billing',       label: 'Billing',        icon: Receipt,   badge: bill ? undefined : 1 },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E3A8A 60%,#2563EB 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div className="px-6 py-5">
          <button onClick={() => navigate('/visits')} className="flex items-center gap-1.5 text-caption font-semibold mb-3 transition-opacity hover:opacity-80" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Visits
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-caption font-bold mb-1" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {visit.visit_type.replace(/_/g, ' ')}
              </p>
              <h1 className="text-xl font-bold text-white">
                {visit.patient_name ?? `Patient ${visit.patient_id.slice(0, 8)}`}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="font-mono text-caption" style={{ color: 'rgba(255,255,255,0.5)' }}>{visit.visit_number}</span>
                <span className="text-caption font-bold px-2.5 py-0.5 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                  {STATUS_LABELS[visit.status] ?? visit.status}
                </span>
                <span className={`text-caption font-bold px-2.5 py-0.5 rounded-full capitalize ${
                  visit.priority === 'critical' ? 'bg-red-100 text-red-700' :
                  visit.priority === 'urgent'   ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>{visit.priority}</span>
                {department && (
                  <span className="text-caption flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <MapPin className="w-3 h-3" />{department.name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={load} className="p-2 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link
                to={`/visits/${visit.id}/journey`}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <MapPin className="w-3.5 h-3.5" /> Full Journey
              </Link>
              {canAdmit && !isAdmitted && !isDischarged && visit.status !== 'registered' && (
                <button onClick={() => setShowAdmit(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Bed className="w-4 h-4" /> Admit & Assign Bed
                </button>
              )}
              {canDischarge && (isAdmitted || visit.status === 'ready_for_discharge') && (
                <button onClick={handleDischarge} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-opacity disabled:opacity-50" style={{ background: '#059669', color: '#fff' }}>
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Discharge
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex px-6 gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-3 text-caption font-semibold relative flex-shrink-0 transition-colors"
                style={{
                  color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                  borderBottom: active ? '2px solid #fff' : '2px solid transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.badge != null && (
                  <span className="w-4 h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center" style={{ background: '#DC2626', color: '#fff' }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        {activeTab === 'triage' && (
          <div className="max-w-2xl mx-auto px-6 py-5 space-y-5">
            {visit.triaged_at && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--status-ok-bg)', border: '1px solid var(--status-ok-border)' }}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--status-ok-icon)' }} />
                <p className="text-body-sm font-semibold" style={{ color: 'var(--status-ok-icon)' }}>
                  Patient already triaged{visit.triaged_at ? ` â€” ${fmtDateTime(visit.triaged_at)}` : ''}.
                  {visit.triage_nurse_name ? ` By ${visit.triage_nurse_name}.` : ''}
                </p>
              </div>
            )}

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}><Activity className="w-3.5 h-3.5" style={{ color: '#DC2626' }} /></div>}
                title="Vital Signs"
              />
              <div className="px-5 py-4 grid grid-cols-2 gap-4">
                {[
                  { label: 'BP Systolic (mmHg)',  key: 'blood_pressure_systolic'  as keyof VitalSigns, type: 'number', placeholder: 'e.g. 120' },
                  { label: 'BP Diastolic (mmHg)', key: 'blood_pressure_diastolic' as keyof VitalSigns, type: 'number', placeholder: 'e.g. 80' },
                  { label: 'Temperature (Â°C)',    key: 'temperature_celsius'      as keyof VitalSigns, type: 'number', placeholder: 'e.g. 37.2', step: '0.1' },
                  { label: 'Pulse Rate (bpm)',    key: 'pulse_rate'               as keyof VitalSigns, type: 'number', placeholder: 'e.g. 72' },
                  { label: 'SpOâ‚‚ (%)',            key: 'oxygen_saturation'        as keyof VitalSigns, type: 'number', placeholder: 'e.g. 98' },
                  { label: 'Respiratory Rate',    key: 'respiratory_rate'         as keyof VitalSigns, type: 'number', placeholder: 'e.g. 16' },
                  { label: 'Weight (kg)',         key: 'weight_kg'                as keyof VitalSigns, type: 'number', placeholder: 'e.g. 70', step: '0.1' },
                  { label: 'Height (cm)',         key: 'height_cm'                as keyof VitalSigns, type: 'number', placeholder: 'e.g. 170' },
                ].map(({ label, key, type, placeholder, step }) => (
                  <div key={key}>
                    <label className="text-caption font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                    <input
                      type={type}
                      step={step}
                      placeholder={placeholder}
                      value={triageVitals[key] as number ?? ''}
                      onChange={e => setTriageVitals(v => ({ ...v, [key]: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full px-3 py-2 rounded-lg text-body-sm"
                      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-caption font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Triage Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Clinical observations, presenting symptomsâ€¦"
                    value={triageVitals.triage_notes ?? ''}
                    onChange={e => setTriageVitals(v => ({ ...v, triage_notes: e.target.value || undefined }))}
                    className="w-full px-3 py-2 rounded-lg text-body-sm resize-none"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}><UserCheck className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /></div>}
                title="Assign Doctor"
                sub="Optional â€” can be assigned later"
              />
              <div className="px-5 py-4">
                <select
                  value={triageDoctorId}
                  onChange={e => setTriageDoctorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-body-sm"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="">â€” No doctor assigned yet â€”</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name || d.username}</option>
                  ))}
                </select>
              </div>
            </Card>

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)' }}><MapPin className="w-3.5 h-3.5" style={{ color: '#059669' }} /></div>}
                title="Consultation Room"
                sub="Direct patient to a room after triage"
              />
              <div className="px-5 py-4">
                {visit.consultation_room && (
                  <p className="text-caption font-semibold mb-2" style={{ color: '#059669' }}>
                    Currently assigned: <span className="font-bold">{visit.consultation_room}</span>
                  </p>
                )}
                <select
                  value={triageRoomId}
                  onChange={e => setTriageRoomId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-body-sm"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="">â€” No room assigned yet â€”</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.room_name}>
                      {r.room_name} ({r.room_number}){r.status !== 'available' ? ` â€” ${r.status}` : ''}
                    </option>
                  ))}
                </select>
                {rooms.length === 0 && (
                  <p className="text-caption mt-2" style={{ color: 'var(--text-muted)' }}>
                    No consultation rooms configured for this department.
                  </p>
                )}
              </div>
            </Card>

            <div className="flex justify-end">
              <button
                onClick={handleTriage}
                disabled={triageLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-body-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--clinical-600)' }}
              >
                {triageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Thermometer className="w-4 h-4" />}
                {visit.triaged_at ? 'Update Triage' : 'Complete Triage'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="max-w-5xl mx-auto px-6 py-5 grid grid-cols-1 lg:grid-cols-3 gap-5">

            <div className="lg:col-span-2">
              <Card>
                <CardHeader
                  icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}><Clock className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /></div>}
                  title="Patient Journey"
                  sub={journey ? `Total: ${journey.total_tat_min?.toFixed(0) ?? 'â€”'} / ${journey.target_total_min} min` : undefined}
                />
                <div className="px-5 py-5">
                  {journey ? (
                    journey.stages.map((stage, i) => (
                      <StageCard key={stage.stage} stage={stage} isLast={i === journey.stages.length - 1} />
                    ))
                  ) : (
                    <p className="text-body-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Journey data unavailable</p>
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader
                  icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}><ClipboardCheck className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /></div>}
                  title="Visit Details"
                />
                <div className="px-5 py-4 space-y-2.5">
                  {[
                    { label: 'Visit No.', value: visit.visit_number },
                    { label: 'Type', value: <span className="capitalize">{visit.visit_type.replace(/_/g, ' ')}</span> },
                    { label: 'Department', value: department?.name ?? visit.department_id },
                    { label: 'Registered', value: fmtDateTime(visit.registered_at) },
                    visit.chief_complaint && { label: 'Complaint', value: visit.chief_complaint },
                    visit.admission_notes && { label: 'Admission Notes', value: visit.admission_notes },
                    isDischarged && { label: 'Discharged', value: fmtDateTime(visit.discharged_at) },
                  ].filter(Boolean).map((row, i) => {
                    const { label, value } = row as { label: string; value: React.ReactNode };
                    return (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="text-caption flex-shrink-0 pt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
                        <span className="text-caption font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{value}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {visit.vitals && (
                <Card>
                  <CardHeader
                    icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}><Activity className="w-3.5 h-3.5" style={{ color: '#DC2626' }} /></div>}
                    title="Triage Vitals"
                  />
                  <div className="px-5 py-4 grid grid-cols-2 gap-3">
                    {[
                      visit.vitals.blood_pressure_systolic && { label: 'BP', value: `${visit.vitals.blood_pressure_systolic}/${visit.vitals.blood_pressure_diastolic} mmHg` },
                      visit.vitals.temperature_celsius     && { label: 'Temp', value: `${visit.vitals.temperature_celsius} Â°C` },
                      visit.vitals.pulse_rate               && { label: 'Pulse', value: `${visit.vitals.pulse_rate} bpm` },
                      visit.vitals.oxygen_saturation        && { label: 'SpOâ‚‚', value: `${visit.vitals.oxygen_saturation}%` },
                      visit.vitals.weight_kg                && { label: 'Weight', value: `${visit.vitals.weight_kg} kg` },
                      visit.vitals.respiratory_rate         && { label: 'RR', value: `${visit.vitals.respiratory_rate}/min` },
                    ].filter(Boolean).map((item, i) => {
                      const { label, value } = item as { label: string; value: string };
                      return (
                        <div key={i} className="px-3 py-2 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
                          <p className="text-meta" style={{ color: 'var(--text-muted)' }}>{label}</p>
                          <p className="text-body-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
                        </div>
                      );
                    })}
                    {visit.vitals.triage_notes && (
                      <div className="col-span-2 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
                        <p className="text-meta" style={{ color: 'var(--text-muted)' }}>Triage Notes</p>
                        <p className="text-caption mt-0.5" style={{ color: 'var(--text-secondary)' }}>{visit.vitals.triage_notes}</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'care' && (
          <div className="max-w-3xl mx-auto px-6 py-5 space-y-5">

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}><Bed className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /></div>}
                title="Bed & Room Assignment"
                sub={bed ? `${bed.ward_name} â€” Room ${bed.room_number}` : isAdmitted ? 'Assigned' : 'Not yet admitted'}
                action={
                  canAdmit && !isAdmitted && !isDischarged && visit.status !== 'registered' ? (
                    <button onClick={() => setShowAdmit(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-bold text-white rounded-lg" style={{ background: '#2563EB' }}>
                      <Bed className="w-3 h-3" /> Admit
                    </button>
                  ) : undefined
                }
              />
              {bed ? (
                <div className="px-5 py-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Bed',       value: bed.bed_label,   icon: Bed,       color: '#2563EB' },
                      { label: 'Ward',      value: bed.ward_name,   icon: Building2, color: '#7C3AED' },
                      { label: 'Room',      value: `Room ${bed.room_number}`, icon: MapPin, color: '#059669' },
                      { label: 'Type',      value: bed.bed_type.toUpperCase(), icon: Activity, color: '#D97706' },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="p-4 rounded-xl flex flex-col items-center gap-2 text-center" style={{ background: `${color}0D`, border: `1px solid ${color}30` }}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <p className="text-caption font-bold uppercase tracking-wider" style={{ color }}>{label}</p>
                        <p className="text-body-sm font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {visit.admission_notes && (
                    <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
                      <p className="text-caption font-bold mb-1" style={{ color: 'var(--text-muted)' }}>ADMISSION NOTES</p>
                      <p className="text-body-sm italic" style={{ color: 'var(--text-secondary)' }}>"{visit.admission_notes}"</p>
                    </div>
                  )}
                </div>
              ) : isDischarged ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckCircle2 className="w-8 h-8" style={{ color: '#059669' }} />
                  <p className="text-body-sm font-semibold" style={{ color: '#059669' }}>Patient Discharged</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>{fmtDateTime(visit.discharged_at)}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.08)' }}>
                    <Bed className="w-7 h-7" style={{ color: '#2563EB' }} />
                  </div>
                  <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>No bed assigned yet</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                    {visit.status === 'registered' ? 'Patient must be triaged before admission.' : 'Click "Admit" to assign a bed.'}
                  </p>
                </div>
              )}
            </Card>

            {visit.consultation_room && (
              <Card>
                <CardHeader
                  icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)' }}><MapPin className="w-3.5 h-3.5" style={{ color: '#059669' }} /></div>}
                  title="Consultation Room"
                  sub="Assigned during triage"
                />
                <div className="px-5 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(5,150,105,0.1)' }}>
                    <MapPin className="w-5 h-5" style={{ color: '#059669' }} />
                  </div>
                  <div>
                    <p className="text-h3" style={{ color: 'var(--text-primary)' }}>{visit.consultation_room}</p>
                    <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Update via the Triage tab</p>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)' }}><Stethoscope className="w-3.5 h-3.5" style={{ color: '#059669' }} /></div>}
                title="Attending Doctor"
                sub={assignedDoctor ? `Dr. ${assignedDoctor.full_name}` : 'Not yet assigned'}
                action={
                  !isDischarged ? (
                    <button onClick={() => setShowAssignDoc(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-bold rounded-lg border transition-colors hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
                      <User className="w-3 h-3" /> {assignedDoctor ? 'Change' : 'Assign'}
                    </button>
                  ) : undefined
                }
              />
              {assignedDoctor ? (
                <div className="px-5 py-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-extrabold flex-shrink-0" style={{ background: 'var(--clinical-100)', color: 'var(--clinical-700)' }}>
                    {assignedDoctor.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-h3" style={{ color: 'var(--text-primary)' }}>Dr. {assignedDoctor.full_name}</p>
                    <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{assignedDoctor.email}</p>
                    <span className="inline-flex mt-1.5 text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}>
                      Attending Physician
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.08)' }}>
                    <UserCheck className="w-7 h-7" style={{ color: '#059669' }} />
                  </div>
                  <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>No doctor assigned</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Assign an attending doctor to this visit.</p>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)' }}><Pill className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} /></div>}
                title="Prescription Flow"
                sub="Order â†’ Pharmacist â†’ Administration"
              />
              <div className="px-5 py-5">
                <div className="flex items-center gap-2">
                  {[
                    { label: 'Doctor Orders',  icon: FilePlus,     color: '#2563EB', desc: 'Prescription written' },
                    { label: 'Pharmacist',      icon: FlaskConical, color: '#7C3AED', desc: 'Verify & dispense' },
                    { label: 'Administration',  icon: UserCheck,    color: '#059669', desc: 'Nurse administers' },
                  ].map(({ label, icon: Icon, color, desc }, i) => (
                    <React.Fragment key={label}>
                      <div className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl text-center" style={{ background: `${color}0D`, border: `1px solid ${color}20` }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <p className="text-caption font-bold" style={{ color }}>{label}</p>
                        <p className="text-meta" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                      </div>
                      {i < 2 && <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-caption text-center mt-4" style={{ color: 'var(--text-muted)' }}>
                  {prescriptions.length > 0 ? `${prescriptions.length} prescription(s) on record for this patient.` : 'No prescriptions yet.'}
                  {' '}
                  <button onClick={() => setActiveTab('prescriptions')} className="font-semibold" style={{ color: 'var(--clinical-600)' }}>
                    View prescriptions â†’
                  </button>
                </p>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'consultation' && (
          <div className="max-w-3xl mx-auto px-6 py-5 space-y-5">

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)' }}><Stethoscope className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} /></div>}
                title="Consultation Record"
                sub={visit.consultation_started_at ? `Started: ${fmtDateTime(visit.consultation_started_at)}` : 'Not yet started'}
                action={
                  ['doctor', 'admin'].includes(user?.role ?? '') ? (
                    <button
                      onClick={() => setShowConsultForm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white rounded-xl"
                      style={{ background: '#7C3AED' }}
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                      {visit.diagnosis ? 'Update Notes' : 'Add Notes'}
                    </button>
                  ) : null
                }
              />
              <div className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#7C3AED20' }}>
                      <User className="w-4 h-4" style={{ color: '#7C3AED' }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7C3AED' }}>Doctor</p>
                      <p className="text-sm font-semibold text-gray-800">{visit.assigned_doctor_name ?? assignedDoctor?.full_name ?? 'â€”'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#9A341220' }}>
                      <User className="w-4 h-4" style={{ color: '#9A3412' }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9A3412' }}>Assisting Nurse</p>
                      <p className="text-sm font-semibold text-gray-800">{visit.consultation_nurse_name ?? 'â€”'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  {[
                    { label: 'Consultation Room', value: visit.consultation_room },
                    { label: 'Started', value: visit.consultation_started_at ? fmtDateTime(visit.consultation_started_at) : undefined },
                    { label: 'Ended', value: visit.consultation_ended_at ? fmtDateTime(visit.consultation_ended_at) : undefined },
                  ].map(({ label, value }) => value && (
                    <div key={label}>
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className="font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>

                {visit.chief_complaint && (
                  <div className="p-3 rounded-xl" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Chief Complaint</p>
                    <p className="text-sm text-blue-800">{visit.chief_complaint}</p>
                  </div>
                )}

                {(visit.clinical_findings || visit.diagnosis || visit.recommendations || visit.follow_up_instructions) ? (
                  <div className="space-y-3">
                    {visit.clinical_findings && (
                      <div className="p-3 rounded-xl" style={{ background: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1">Clinical Findings / Examination</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{visit.clinical_findings}</p>
                      </div>
                    )}
                    {visit.diagnosis && (
                      <div className="p-3 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Diagnosis</p>
                        <p className="text-sm font-semibold text-gray-800">{visit.diagnosis}</p>
                      </div>
                    )}
                    {visit.recommendations && (
                      <div className="p-3 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Recommendations / Plan of Care</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{visit.recommendations}</p>
                      </div>
                    )}
                    {visit.follow_up_instructions && (
                      <div className="p-3 rounded-xl" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 mb-1">Follow-up Instructions</p>
                        <p className="text-sm text-gray-700">{visit.follow_up_instructions}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(124,58,237,0.1)' }}>
                      <FileText className="w-6 h-6" style={{ color: '#7C3AED' }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">No consultation notes yet</p>
                    <p className="text-xs text-gray-400 mb-3">
                      {['doctor', 'admin'].includes(user?.role ?? '') ? 'Document your findings, diagnosis and recommendations.' : 'The doctor has not yet recorded consultation notes.'}
                    </p>
                    {['doctor', 'admin'].includes(user?.role ?? '') && (
                      <button
                        onClick={() => setShowConsultForm(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl"
                        style={{ background: '#7C3AED' }}
                      >
                        <FilePlus className="w-4 h-4" />
                        Record Consultation Notes
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Link
              to={`/visits/${visit.id}/journey`}
              className="flex items-center justify-between px-5 py-4 rounded-2xl border border-blue-200 hover:border-blue-400 transition-colors"
              style={{ background: '#EFF6FF' }}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">View Full Patient Journey</p>
                  <p className="text-xs text-blue-600 mt-0.5">Complete timeline from arrival to discharge â€” all actors, times, vitals, prescriptions</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
            </Link>
          </div>
        )}

        {activeTab === 'prescriptions' && (
          <div className="max-w-3xl mx-auto px-6 py-5 space-y-4">

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { status: 'submitted',    label: 'Submitted',    color: '#2563EB' },
                { status: 'flagged',      label: 'Flagged',      color: '#7C3AED' },
                { status: 'verified',     label: 'Verified',     color: '#059669' },
                { status: 'dispensed',    label: 'Dispensed',    color: '#D97706' },
                { status: 'administered', label: 'Administered', color: '#22C55E' },
                { status: 'draft',        label: 'Draft',        color: '#94A3B8' },
              ].map(({ status, label, color }) => {
                const count = prescriptions.filter(p => p.status === status).length;
                return (
                  <div key={status} className="flex flex-col items-center p-2.5 rounded-xl" style={{ background: `${color}0D`, border: `1px solid ${color}25` }}>
                    <span className="text-xl font-extrabold tabular-nums" style={{ color }}>{count}</span>
                    <span className="text-meta mt-0.5 text-center" style={{ color }}>{label}</span>
                  </div>
                );
              })}
            </div>

            {['doctor', 'admin'].includes(user?.role ?? '') && (
              <Link
                to={`/prescriptions/new?patient_id=${visit.patient_id}&visit_id=${id}`}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 w-fit"
                style={{ background: '#2563EB' }}
              >
                <FilePlus className="w-4 h-4" />
                Write New Prescription
              </Link>
            )}

            {prescriptions.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)' }}>
                    <Pill className="w-7 h-7" style={{ color: '#7C3AED' }} />
                  </div>
                  <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>No prescriptions yet</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>The doctor hasn't written a prescription for this patient.</p>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                  {prescriptions.map(rx => {
                    const s = RX_STATUS_COLORS[rx.status] ?? RX_STATUS_COLORS.draft;
                    return (
                      <Link
                        key={rx.id}
                        to={`/prescriptions/${rx.id}`}
                        className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--bg-row-hover)]"
                      >
                        <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-caption font-semibold" style={{ color: 'var(--text-secondary)' }}>
                              {rx.rx_number ?? rx.id.slice(0, 8) + 'â€¦'}
                            </span>
                            <span className="text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                              {rx.status}
                            </span>
                            {rx.priority && (
                              <span className="text-caption font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                                {rx.priority}
                              </span>
                            )}
                          </div>
                          <p className="text-caption mt-1" style={{ color: 'var(--text-muted)' }}>
                            {rx.medications.map(m => `${m.name} ${m.dose}`).join(' Â· ').slice(0, 80) || 'No medications listed'}
                          </p>
                          <p className="text-caption mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <Calendar className="w-3 h-3" />
                            {fmtDateTime(rx.ordered_at ?? rx.created_at)}
                            {rx.doctor_name && ` Â· Dr. ${rx.doctor_name}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {['submitted', 'verified', 'dispensed', 'administered'].map((st, i) => {
                            const order = ['draft', 'submitted', 'verified', 'dispensed', 'administered', 'archived'];
                            const rxIdx = order.indexOf(rx.status);
                            const stIdx = order.indexOf(st);
                            const passed = rxIdx >= stIdx;
                            return (
                              <React.Fragment key={st}>
                                <div className="w-2 h-2 rounded-full" style={{ background: passed ? '#2563EB' : 'var(--surface-3)' }} />
                                {i < 3 && <div className="w-3 h-0.5" style={{ background: passed ? '#2563EB' : 'var(--surface-3)' }} />}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
                      </Link>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="max-w-3xl mx-auto px-6 py-5 space-y-5">
            {!bill ? (
              <Card>
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.08)' }}>
                    <Receipt className="w-8 h-8" style={{ color: '#059669' }} />
                  </div>
                  <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>No bill generated yet</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                    Generate a bill to track charges for this visit.
                  </p>
                  {canBill && (
                    <button
                      onClick={handleGenerateBill}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
                      style={{ background: '#059669' }}
                    >
                      <Receipt className="w-4 h-4" />
                      Generate Bill
                    </button>
                  )}
                </div>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Amount', value: fmtKES(bill.total_amount), color: '#0F172A', bg: 'var(--bg-card)' },
                    { label: 'Amount Paid',  value: fmtKES(bill.paid_amount),  color: '#059669', bg: '#F0FDF4' },
                    { label: 'Balance Due',  value: fmtKES(bill.balance_due),  color: bill.balance_due > 0 ? '#DC2626' : '#059669', bg: bill.balance_due > 0 ? '#FEF2F2' : '#F0FDF4' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className="rounded-xl p-4 text-center" style={{ background: bg, border: '1px solid var(--border-default)' }}>
                      <p className="text-caption font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="text-xl font-extrabold tabular-nums mt-1 leading-none" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-bold px-3 py-1 rounded-full capitalize" style={{
                      background: BILL_STATUS_COLORS[bill.status]?.bg ?? '#F8FAFC',
                      color:      BILL_STATUS_COLORS[bill.status]?.color ?? '#475569',
                      border:     `1px solid ${BILL_STATUS_COLORS[bill.status]?.border ?? '#E2E8F0'}`,
                    }}>
                      {bill.status}
                    </span>
                    <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
                      Bill ID: <span className="font-mono">{bill._id.slice(0, 8)}â€¦</span>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {canBill && (
                      <button onClick={() => setShowAddCharge(true)} className="flex items-center gap-1.5 px-3 py-2 text-caption font-bold rounded-xl border transition-colors hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
                        <PlusCircle className="w-3.5 h-3.5" /> Add Charge
                      </button>
                    )}
                    {bill.balance_due > 0 && canBill && (
                      <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 px-3 py-2 text-caption font-bold text-white rounded-xl" style={{ background: '#059669' }}>
                        <Banknote className="w-3.5 h-3.5" /> Record Payment
                      </button>
                    )}
                  </div>
                </div>

                <Card>
                  <CardHeader
                    icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}><CreditCard className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /></div>}
                    title="Charges"
                    sub={`${bill.line_items.length} item(s)`}
                  />
                  {bill.line_items.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-body-sm" style={{ color: 'var(--text-muted)' }}>No charges added yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
                            {['Procedure / Description', 'Qty', 'Rate (KES)', 'Amount (KES)'].map(h => (
                              <th key={h} className={`px-5 py-3 text-caption font-semibold uppercase tracking-wider text-left ${h !== 'Procedure / Description' ? 'text-right' : ''}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bill.line_items.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-default)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-1)' }}>
                              <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{item.description}</td>
                              <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</td>
                              <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{item.unit_price.toLocaleString()}</td>
                              <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>{item.total_price.toLocaleString()}</td>
                            </tr>
                          ))}
                          <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border-default)' }}>
                            <td colSpan={3} className="px-5 py-3 text-right font-bold" style={{ color: 'var(--text-primary)' }}>Total</td>
                            <td className="px-5 py-3 text-right font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{bill.total_amount.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {bill.payments.length > 0 && (
                  <Card>
                    <CardHeader
                      icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)' }}><Banknote className="w-3.5 h-3.5" style={{ color: '#059669' }} /></div>}
                      title="Payment History"
                      sub={`${bill.payments.length} payment(s)`}
                    />
                    <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                      {bill.payments.map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className="text-body-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{p.method.replace('_', ' ')}</p>
                            <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                              {fmtDateTime(p.received_at)}
                              {p.reference_number && ` Â· Ref: ${p.reference_number}`}
                            </p>
                          </div>
                          <span className="text-body font-extrabold tabular-nums" style={{ color: '#059669' }}>{fmtKES(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showAdmit && (
        <AdmitModal
          departmentId={visit.department_id}
          doctors={doctors}
          onConfirm={handleAdmit}
          onClose={() => setShowAdmit(false)}
        />
      )}
      {showAssignDoc && (
        <AssignDoctorModal
          doctors={doctors}
          currentDoctorId={visit.assigned_doctor_id}
          onConfirm={handleAssignDoctor}
          onClose={() => setShowAssignDoc(false)}
        />
      )}
      {showAddCharge && (
        <AddLineItemModal
          onConfirm={handleAddCharge}
          onClose={() => setShowAddCharge(false)}
        />
      )}
      {showPayment && bill && (
        <PaymentModal
          balance={bill.balance_due}
          onConfirm={handlePayment}
          onClose={() => setShowPayment(false)}
        />
      )}
      {showConsultForm && (
        <ConsultationNoteModal
          visit={visit}
          nurses={doctors}
          onConfirm={async (data) => {
            try {
              await visitsApi.update(visit.id, data);
              toast.success('Consultation notes saved');
              setShowConsultForm(false);
              load();
            } catch {
              toast.error('Failed to save consultation notes');
            }
          }}
          onClose={() => setShowConsultForm(false)}
        />
      )}
    </div>
  );
}
