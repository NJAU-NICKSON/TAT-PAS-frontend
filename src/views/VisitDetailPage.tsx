import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Bed, UserCheck, Stethoscope, FlaskConical,
  CreditCard, ClipboardCheck, Clock, CheckCircle2, Circle,
  AlertCircle, Loader2, RefreshCw, X, User, FilePlus,
  ChevronRight, Pill, MapPin, Activity, Receipt, FileText,
  PlusCircle, Banknote, Building2, Calendar, Thermometer,
} from 'lucide-react';
import { toast } from 'sonner';
import { visitsApi, Visit, JourneySummary, JourneyStageSummary, VitalSigns } from '../api/visits';
import { bedsApi, Bed as BedType } from '../api/beds';
import { departmentsApi, Department } from '../api/departments';
import { consultationRoomsApi, ConsultationRoom } from '../api/consultationRooms';
import { prescriptionsApi } from '../api/prescriptions';
import { billingApi } from '../api/billing';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { withDoctorTitle, formatTimeEAT, formatDateTimeEAT, getErrorMessage } from '../lib/utils';
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
  waiting_for_doctor:   { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  in_consultation:      { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  awaiting_results:     { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  treatment_in_progress:{ color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  admitted:             { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0' },
  in_ward:              { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0' },
  ready_for_discharge:  { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  discharged:           { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0' },
  cancelled:            { color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' },
};

const RX_STATUS_COLORS: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  draft:        { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8' },
  submitted:    { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD', dot: '#0284C7' },
  flagged:      { color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF', dot: '#7C3AED' },
  verified:     { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  dispensed:    { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD', dot: '#0284C7' },
  administered: { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  archived:     { color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0', dot: '#CBD5E1' },
};

const BILL_STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  open:          { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  partially_paid:{ color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  paid:          { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0' },
  finalized:     { color: '#178A3D', bg: '#F0FDF4', border: '#BBF7D0' },
  waived:        { color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' },
};

const STAGE_ICONS = [UserCheck, Stethoscope, Stethoscope, FlaskConical, CreditCard, ClipboardCheck];

function fmtTime(iso?: string) {
  if (!iso) return ' - ';
  return formatTimeEAT(iso);
}

function fmtDateTime(iso?: string) {
  if (!iso) return ' - ';
  return formatDateTimeEAT(iso);
}

function fmtKES(n: number) {
  return `KES ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hasDisplayName(value?: string | null) {
  return Boolean(value && value.trim());
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg ${className}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}>
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
    bedsApi.list({ status: 'available' })
      .then(r => setBeds(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Failed to load available beds'))
      .finally(() => setLoadingBeds(false));
  }, [departmentId]);

  const bedTypeColors: Record<string, string> = {
    icu: '#DC2626', hdu: '#D97706', nicu: '#DB2777', isolation: '#178A3D',
    general: '#178A3D', maternity: '#EC4899', birthing: '#EC4899',
    paediatric: '#178A3D', day_case: '#475569',
  };

  async function handleSubmit() {
    if (!selectedBed) { setError('Please select a bed'); return; }
    setSubmitting(true); setError('');
    try { await onConfirm(selectedBed, notes, selectedDoctor || undefined); }
    catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not admit the patient.')); setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-lg overflow-hidden animate-slide-up" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2.5">
            <Bed className="w-4 h-4" style={{ color: 'var(--clinical-600)' }} />
            <div>
              <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Admit Patient</h2>
              <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Assign a ward bed - converts to inpatient</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Select Bed *</p>
            {loadingBeds ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--clinical-600)' }} /></div>
            ) : beds.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                <AlertCircle className="w-4 h-4" /> No available beds in this department.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {beds.map(bed => {
                  const accentColor = bedTypeColors[bed.bed_type] ?? '#178A3D';
                  const selected = selectedBed === bed.id;
                  return (
                    <label
                      key={bed.id}
                      className="flex items-start gap-3 p-3.5 rounded-lg cursor-pointer transition-all"
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
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              <option value=""> -  Not assigned yet  - </option>
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
              className="w-full px-3 py-2.5 rounded-lg text-sm resize-none focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 justify-end" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={onClose} aria-label="Close" className="px-4 py-2 text-sm rounded-lg border transition-colors" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || beds.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity"
            style={{ background: '#0F6E2F' }}
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
  doctors, nurses, rooms, currentDoctorId, onConfirm, onClose,
}: {
  doctors: UserType[];
  nurses: UserType[];
  rooms: ConsultationRoom[];
  currentDoctorId?: string;
  onConfirm: (doctorId: string, roomName?: string, nurseId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(currentDoctorId ?? '');
  const [roomName, setRoomName] = useState('');
  const [nurseId, setNurseId]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const autoRoom = selected ? rooms.find(r => r.current_doctor_id === selected) : undefined;

  // When the doctor changes, pre-fill room + nurse from their standing room.
  useEffect(() => {
    setRoomName(autoRoom?.room_name ?? '');
    setNurseId(autoRoom?.current_nurse_id ?? '');
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try { await onConfirm(selected, roomName || undefined, nurseId || undefined); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-lg overflow-hidden animate-slide-up" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: '#178A3D' }} />
            <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Assign Doctor</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Select the attending doctor for this patient.</p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {doctors.map(d => (
              <label key={d.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors" style={{ background: selected === d.id ? 'rgba(23,138,61,0.08)' : 'var(--surface-1)', border: `1px solid ${selected === d.id ? '#178A3D' : 'var(--border-default)'}` }}>
                <input type="radio" name="doctor" value={d.id} checked={selected === d.id} onChange={() => setSelected(d.id)} />
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--clinical-100)', color: 'var(--clinical-700)' }}>
                  {d.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{withDoctorTitle(d.full_name)}</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>{d.email}</p>
                </div>
              </label>
            ))}
          </div>

          {selected && (
            <div className="space-y-2.5 pt-1">
              <div>
                <label className="text-caption font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                  Consultation Room
                </label>
                <select
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  <option value="">No room</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.room_name}>
                      {r.room_name}{r.room_number ? ` (${r.room_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-caption font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                  Assisting Nurse
                </label>
                <select
                  value={nurseId}
                  onChange={e => setNurseId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  <option value="">No nurse</option>
                  {nurses.map(n => (
                    <option key={n.id} value={n.id}>{n.full_name}</option>
                  ))}
                </select>
                {autoRoom?.current_nurse_id && nurseId === autoRoom.current_nurse_id && (
                  <p className="text-meta mt-1" style={{ color: '#178A3D' }}>Pre-filled from the room's standing nurse</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-5 py-4 justify-end" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={onClose} aria-label="Close" className="px-4 py-2 text-sm rounded-lg border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!selected || submitting} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: '#178A3D' }}>
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
  { label: 'Bed Charge  -  General',   description: 'Bed (General)', unit_price: 2000, category: 'ward' as const },
  { label: 'Bed Charge  -  ICU',       description: 'Bed (ICU)', unit_price: 8000, category: 'ward' as const },
  { label: 'Bed Charge  -  HDU',       description: 'Bed (HDU)', unit_price: 5000, category: 'ward' as const },
  { label: 'Bed Charge  -  NICU',      description: 'Bed (NICU)', unit_price: 6000, category: 'ward' as const },
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
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg overflow-hidden animate-slide-up" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" style={{ color: '#178A3D' }} />
            <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Add Charge</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Quick Select</p>
            <select
              value={preset}
              onChange={e => applyPreset(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
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
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              placeholder="e.g. Consultation, Lab Test..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Quantity</p>
              <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none text-right tabular-nums"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Unit Price (KES)</p>
              <input type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none text-right tabular-nums"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
            <span className="text-body-sm font-semibold" style={{ color: '#178A3D' }}>Total Amount</span>
            <span className="text-xl font-extrabold tabular-nums" style={{ color: '#178A3D' }}>{fmtKES(totalPrice)}</span>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 justify-end" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={onClose} aria-label="Close" className="px-4 py-2 text-sm rounded-lg border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>Cancel</button>
          <button onClick={handleAdd} disabled={!description.trim() || unitPrice <= 0 || submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ background: '#178A3D' }}>
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
    { value: 'sha', label: 'SHA' },
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
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-lg overflow-hidden animate-slide-up" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4" style={{ color: '#178A3D' }} />
            <h2 className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Record Payment</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="text-center py-3 rounded-lg" style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
            <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Balance Due</p>
            <p className="text-2xl font-extrabold tabular-nums mt-1" style={{ color: balance > 0 ? '#DC2626' : '#178A3D' }}>{fmtKES(balance)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Amount (KES) *</p>
              <input type="number" min={1} max={balance} value={amount} onChange={e => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none text-right tabular-nums"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Method *</p>
              <select value={method} onChange={e => setMethod(e.target.value as Payment['method'])}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Receipt / Reference No.</p>
            <input value={receipt} onChange={e => setReceipt(e.target.value)} placeholder="Optional"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          </div>

          <div>
            <p className="text-caption font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional"
              className="w-full px-3 py-2.5 rounded-lg text-sm resize-none focus:outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 justify-end" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={onClose} aria-label="Close" className="px-4 py-2 text-sm rounded-lg border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>Cancel</button>
          <button onClick={handlePay} disabled={!amount || amount <= 0 || submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ background: '#178A3D' }}>
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
          done ? 'bg-green-100 text-green-700' : active ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
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
              {stage.tat_min} min {stage.tat_min > stage.target_min ? 'over' : 'on time'}
            </span>
          ) : active ? (
            <span className="text-caption font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 animate-pulse">In Progress</span>
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
  const [nurses, setNurses]             = useState<UserType[]>([]);
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
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const [vRes, jRes] = await Promise.all([visitsApi.getById(id), visitsApi.journey(id)]);
      const v = vRes.data;
      setVisit(v);
      setJourney(jRes.data);

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
        usersApi.listNurses(),
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
      if (docRes.status === 'fulfilled') {
        const n = docRes.value.data;
        const items: UserType[] = Array.isArray(n) ? n : (n as { items: UserType[] }).items ?? [];
        setNurses(items.filter((u: UserType) => u.role === 'nurse'));
      }
      if (v.assigned_doctor_id && v.assigned_doctor_name) {
        setAssignedDoctor({
          id: v.assigned_doctor_id,
          full_name: v.assigned_doctor_name,
          email: '',
          role: 'doctor',
          username: v.assigned_doctor_name,
        } as UserType);
      } else {
        setAssignedDoctor(null);
      }
    } catch {
      setError('Failed to load visit data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!visit) return;
    const triaged = Boolean(visit.triaged_at);
    const consultStarted = Boolean(visit.consultation_started_at);
    const canOpenRx = triaged && consultStarted;
    if (activeTab !== 'prescriptions' || canOpenRx) return;
    setActiveTab(triaged ? 'consultation' : 'triage');
  }, [activeTab, visit]);

  const handleAdmit = async (bedId: string, notes: string, doctorId?: string) => {
    if (!id) return;
    await visitsApi.admit(id, { bed_id: bedId, notes, assigned_doctor_id: doctorId });
    setShowAdmit(false);
    toast.success('Patient admitted successfully');
    await load();
  };

  const handleAssignDoctor = async (doctorId: string, roomName?: string, nurseId?: string) => {
    if (!id) return;
    await visitsApi.update(id, {
      assigned_doctor_id: doctorId,
      ...(roomName ? { consultation_room: roomName } : {}),
      ...(nurseId ? { consultation_nurse_id: nurseId } : {}),
    });
    setShowAssignDoc(false);
    toast.success(roomName ? `Doctor assigned · Room ${roomName}` : 'Doctor assigned');
    await load();
  };

  const handleDischarge = async () => {
    if (!id || !window.confirm('Confirm discharge? The assigned bed will be released.')) return;
    setActionLoading(true);
    try { await visitsApi.discharge(id); toast.success('Patient discharged'); await load(); }
    catch (e: unknown) { toast.error(getErrorMessage(e, 'Could not discharge the patient.')); }
    finally { setActionLoading(false); }
  };

  const handleAddCharge = async (item: BillLineItem) => {
    if (!visit) return;
    const currentBill = bill;

    if (!currentBill) {
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
    if (!visit || !id) return;
    try {
      // Auto-build from the catalogue: consultation, bed-days, nursing, meds.
      const newBill = await billingApi.autoGenerate(id);
      setBill(newBill);
      toast.success('Bill generated automatically from this visit');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Could not generate the bill.'));
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
  const canDischarge = ['receptionist', 'nurse', 'admin'].includes(user?.role ?? '');
  const canBill      = ['billing', 'admin', 'receptionist'].includes(user?.role ?? '');
  const canTriage    = ['nurse', 'admin'].includes(user?.role ?? '');
  const isAdmitted   = ['admitted', 'in_ward'].includes(visit.status);
  const isDischarged = visit.status === 'discharged';
  const billingPaid  = Boolean(
    visit.billing_completed_at ||
    visit.status === 'ready_for_discharge' ||
    (bill && (bill.status === 'paid' || bill.status === 'waived' ||
      (bill.total_amount > 0 && bill.balance_due <= 0)))
  );
  const statusStyle  = STATUS_COLORS[visit.status] ?? STATUS_COLORS.registered;
  const needsTriage  = visit.status === 'registered';
  const triageComplete = Boolean(visit.triaged_at);
  const consultationStarted = Boolean(visit.consultation_started_at);
  const canOpenPrescriptions = triageComplete && consultationStarted;
  const prescriptionBlockReason = !triageComplete
    ? 'Complete triage before opening prescriptions.'
    : !consultationStarted
    ? 'Start consultation before opening prescriptions.'
    : '';
  const patientDisplayName = hasDisplayName(visit.patient_name) ? visit.patient_name!.trim() : 'Unknown Patient';
  const departmentDisplayName = department?.name ?? 'Unknown Department';

  const openTab = (tab: Tab) => {
    if (tab === 'prescriptions' && !canOpenPrescriptions) {
      toast.error(prescriptionBlockReason);
      return;
    }
    setActiveTab(tab);
  };

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
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
        <div className="px-6 py-4">
          <button onClick={() => navigate('/visits')} className="flex items-center gap-1.5 text-caption font-semibold mb-2.5 transition-opacity hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Visits
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-label mb-1" style={{ color: 'var(--text-muted)' }}>
                {visit.visit_type.replace(/_/g, ' ')}
              </p>
              <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {patientDisplayName}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="font-mono text-caption" style={{ color: 'var(--text-muted)' }}>{visit.visit_number}</span>
                <span className="text-meta font-semibold px-2 py-0.5" style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, borderRadius: 'var(--radius-badge)' }}>
                  {STATUS_LABELS[visit.status] ?? visit.status}
                </span>
                <span className="text-meta font-semibold px-2 py-0.5 capitalize" style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-badge)',
                  color: visit.priority === 'critical' ? 'var(--status-critical-text)' : visit.priority === 'urgent' ? 'var(--status-warning-text)' : 'var(--status-success-text)',
                }}>{visit.priority}</span>
                {department && (
                  <span className="text-caption flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <MapPin className="w-3 h-3" />{department.name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={load} className="p-2 transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-button)', color: 'var(--text-secondary)' }}>
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link
                to={`/visits/${visit.id}/journey`}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-button)', color: 'var(--text-secondary)' }}
              >
                <MapPin className="w-3.5 h-3.5" /> Full Journey
              </Link>
              {canAdmit && !isAdmitted && !isDischarged && visit.status !== 'registered' && (
                <button onClick={() => setShowAdmit(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--scion-green-600)', borderRadius: 'var(--radius-button)' }}>
                  <Bed className="w-4 h-4" /> Admit & Assign Bed
                </button>
              )}
              {canDischarge && !isDischarged && (isAdmitted || visit.status === 'ready_for_discharge' || billingPaid) && (
                <button
                  onClick={handleDischarge}
                  disabled={actionLoading || !billingPaid}
                  title={billingPaid ? 'Discharge patient' : 'Billing must be settled before discharge'}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#178A3D', color: '#fff' }}
                >
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
                onClick={() => openTab(tab.key)}
                className="flex items-center gap-2 px-4 py-3 text-caption font-semibold relative flex-shrink-0 transition-colors"
                style={{
                  color: active ? 'var(--scion-green-700)' : 'var(--text-muted)',
                  borderBottom: active ? '2px solid var(--scion-green-600)' : '2px solid transparent',
                  opacity: tab.key === 'prescriptions' && !canOpenPrescriptions ? 0.6 : 1,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.badge != null && (
                  <span className="w-4 h-4 rounded-full text-micro font-extrabold flex items-center justify-center" style={{ background: '#DC2626', color: '#fff' }}>
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
          <div className="w-full max-w-4xl px-6 py-5 space-y-5">
            {visit.triaged_at ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--status-ok-bg)', border: '1px solid var(--status-ok-border)' }}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--status-ok-icon)' }} />
                <p className="text-body-sm font-semibold" style={{ color: 'var(--status-ok-icon)' }}>
                  Patient triaged  -  {fmtDateTime(visit.triaged_at)}.
                  {visit.triage_nurse_name ? ` By ${visit.triage_nurse_name}.` : ''}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
                <Thermometer className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <p className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>
                  This patient has not been triaged yet. Triage is recorded by a nurse on the Triage page.
                </p>
              </div>
            )}

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}><Activity className="w-3.5 h-3.5" style={{ color: '#DC2626' }} /></div>}
                title="Vital Signs"
                sub="Recorded at triage  -  read only"
              />
              <div className="px-5 py-4 grid grid-cols-2 gap-4">
                {[
                  { label: 'BP Systolic (mmHg)',  key: 'blood_pressure_systolic'  as keyof VitalSigns },
                  { label: 'BP Diastolic (mmHg)', key: 'blood_pressure_diastolic' as keyof VitalSigns },
                  { label: 'Temperature (°C)',    key: 'temperature_celsius'      as keyof VitalSigns },
                  { label: 'Pulse Rate (bpm)',    key: 'pulse_rate'               as keyof VitalSigns },
                  { label: 'SpO2 (%)',            key: 'oxygen_saturation'        as keyof VitalSigns },
                  { label: 'Respiratory Rate',    key: 'respiratory_rate'         as keyof VitalSigns },
                  { label: 'Weight (kg)',         key: 'weight_kg'                as keyof VitalSigns },
                  { label: 'Height (cm)',         key: 'height_cm'                as keyof VitalSigns },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <p className="text-caption font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                    <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {visit.vitals?.[key] != null && visit.vitals[key] !== '' ? String(visit.vitals[key]) : ' - '}
                    </p>
                  </div>
                ))}
                {visit.vitals?.triage_notes && (
                  <div className="col-span-2">
                    <p className="text-caption font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Triage Notes</p>
                    <p className="text-body-sm" style={{ color: 'var(--text-primary)' }}>{visit.vitals.triage_notes}</p>
                  </div>
                )}
              </div>
            </Card>

            {!visit.triaged_at && user?.role === 'nurse' && (
              <div className="flex justify-end">
                <button
                  onClick={() => navigate(`/visits/${visit.id}/triage`)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-body-sm font-semibold text-white"
                  style={{ background: 'var(--clinical-600)' }}
                >
                  <Thermometer className="w-4 h-4" />
                  Go to Triage Page
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="w-full px-6 py-5 grid grid-cols-1 lg:grid-cols-3 gap-5">

            <div className="lg:col-span-2">
              <Card>
                <CardHeader
                  icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}><Clock className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
                  title="Patient Journey"
                  sub={journey ? `Total: ${journey.total_tat_min?.toFixed(0) ?? ' - '} / ${journey.target_total_min} min` : undefined}
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
                  icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}><ClipboardCheck className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
                  title="Visit Details"
                />
                <div className="px-5 py-4 space-y-2.5">
                  {[
                    { label: 'Visit No.', value: visit.visit_number },
                    { label: 'Type', value: <span className="capitalize">{visit.visit_type.replace(/_/g, ' ')}</span> },
                    { label: 'Department', value: departmentDisplayName },
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
                      visit.vitals.temperature_celsius     && { label: 'Temp', value: `${visit.vitals.temperature_celsius} °C` },
                      visit.vitals.pulse_rate               && { label: 'Pulse', value: `${visit.vitals.pulse_rate} bpm` },
                      visit.vitals.oxygen_saturation        && { label: 'SpO,,', value: `${visit.vitals.oxygen_saturation}%` },
                      visit.vitals.weight_kg                && { label: 'Weight', value: `${visit.vitals.weight_kg} kg` },
                      visit.vitals.respiratory_rate         && { label: 'RR', value: `${visit.vitals.respiratory_rate}/min` },
                    ].filter(Boolean).map((item, i) => {
                      const { label, value } = item as { label: string; value: string };
                      return (
                        <div key={i} className="px-3 py-2 rounded-lg" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
                          <p className="text-meta" style={{ color: 'var(--text-muted)' }}>{label}</p>
                          <p className="text-body-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
                        </div>
                      );
                    })}
                    {visit.vitals.triage_notes && (
                      <div className="col-span-2 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
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
          <div className="w-full px-6 py-5 space-y-5">

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}><Bed className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
                title="Bed & Room Assignment"
                sub={bed ? `${bed.ward_name}  -  Room ${bed.room_number}` : isAdmitted ? 'Assigned' : 'Not yet admitted'}
                action={
                  canAdmit && !isAdmitted && !isDischarged && visit.status !== 'registered' ? (
                    <button onClick={() => setShowAdmit(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-bold text-white rounded-lg" style={{ background: '#178A3D' }}>
                      <Bed className="w-3 h-3" /> Admit
                    </button>
                  ) : undefined
                }
              />
              {bed ? (
                <div className="px-5 py-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Bed',       value: bed.bed_label,   icon: Bed,       color: '#178A3D' },
                      { label: 'Ward',      value: bed.ward_name,   icon: Building2, color: '#178A3D' },
                      { label: 'Room',      value: `Room ${bed.room_number}`, icon: MapPin, color: '#178A3D' },
                      { label: 'Type',      value: bed.bed_type.toUpperCase(), icon: Activity, color: '#D97706' },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="p-4 rounded-lg flex flex-col items-center gap-2 text-center" style={{ background: `${color}0D`, border: `1px solid ${color}30` }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <p className="text-caption font-bold uppercase tracking-wider" style={{ color }}>{label}</p>
                        <p className="text-body-sm font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {visit.admission_notes && (
                    <div className="mt-4 px-4 py-3 rounded-lg" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
                      <p className="text-caption font-bold mb-1" style={{ color: 'var(--text-muted)' }}>ADMISSION NOTES</p>
                      <p className="text-body-sm italic" style={{ color: 'var(--text-secondary)' }}>"{visit.admission_notes}"</p>
                    </div>
                  )}
                </div>
              ) : isDischarged ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckCircle2 className="w-8 h-8" style={{ color: '#178A3D' }} />
                  <p className="text-body-sm font-semibold" style={{ color: '#178A3D' }}>Patient Discharged</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>{fmtDateTime(visit.discharged_at)}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.08)' }}>
                    <Bed className="w-7 h-7" style={{ color: '#178A3D' }} />
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
                  icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)' }}><MapPin className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
                  title="Consultation Room"
                  sub="Assigned during triage"
                />
                <div className="px-5 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(5,150,105,0.1)' }}>
                    <MapPin className="w-5 h-5" style={{ color: '#178A3D' }} />
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
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)' }}><Stethoscope className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
                title="Attending Doctor"
                sub={assignedDoctor ? withDoctorTitle(assignedDoctor.full_name) : 'Not yet assigned'}
                action={
                  !isDischarged && !assignedDoctor ? (
                    <button onClick={() => setShowAssignDoc(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-bold rounded-lg border transition-colors hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
                      <User className="w-3 h-3" /> Assign
                    </button>
                  ) : undefined
                }
              />
              {assignedDoctor ? (
                <div className="px-5 py-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center text-lg font-extrabold flex-shrink-0" style={{ background: 'var(--clinical-100)', color: 'var(--clinical-700)' }}>
                    {assignedDoctor.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-h3" style={{ color: 'var(--text-primary)' }}>{withDoctorTitle(assignedDoctor.full_name)}</p>
                    {visit.consultation_room ? (
                      <p className="text-body-sm mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <MapPin className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /> {visit.consultation_room}
                      </p>
                    ) : (
                      <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>No consultation room set</p>
                    )}
                    <span className="inline-flex mt-1.5 text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(5,150,105,0.1)', color: '#178A3D', border: '1px solid rgba(5,150,105,0.2)' }}>
                      Attending Physician
                    </span>
                    {visit.consultation_nurse_name && (
                      <p className="text-body-sm mt-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <UserCheck className="w-3.5 h-3.5" style={{ color: '#178A3D' }} />
                        Nurse: <span className="font-semibold">{visit.consultation_nurse_name}</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.08)' }}>
                    <UserCheck className="w-7 h-7" style={{ color: '#178A3D' }} />
                  </div>
                  <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>No doctor assigned</p>
                  <p className="text-caption" style={{ color: 'var(--text-muted)' }}>Assign an attending doctor to this visit.</p>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}><Pill className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
                title="Prescription Flow"
                sub="Order -> Pharmacist -> Administration"
              />
              <div className="px-5 py-5">
                <div className="flex items-center gap-2">
                  {[
                    { label: 'Doctor Orders',  icon: FilePlus,     color: '#178A3D', desc: 'Prescription written' },
                    { label: 'Pharmacist',      icon: FlaskConical, color: '#178A3D', desc: 'Verify & dispense' },
                    { label: 'Administration',  icon: UserCheck,    color: '#178A3D', desc: 'Nurse administers' },
                  ].map(({ label, icon: Icon, color, desc }, i) => (
                    <div key={label} className="contents">
                      <div className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-lg text-center" style={{ background: `${color}0D`, border: `1px solid ${color}20` }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <p className="text-caption font-bold" style={{ color }}>{label}</p>
                        <p className="text-meta" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                      </div>
                      {i < 2 && <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  ))}
                </div>
                <p className="text-caption text-center mt-4" style={{ color: 'var(--text-muted)' }}>
                  {prescriptions.length > 0 ? `${prescriptions.length} prescription(s) on record for this patient.` : 'No prescriptions yet.'}
                  {' '}
                  <button onClick={() => openTab('prescriptions')} className="font-semibold" style={{ color: 'var(--clinical-600)' }}>
                    View prescriptions
                  </button>
                </p>
                {!canOpenPrescriptions && (
                  <p className="text-caption text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                    {prescriptionBlockReason}
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'consultation' && (
          <div className="w-full px-6 py-5 space-y-5">

            <Card>
              <CardHeader
                icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}><Stethoscope className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
                title="Consultation Record"
                sub={visit.consultation_started_at ? `Started: ${fmtDateTime(visit.consultation_started_at)}` : 'Not yet started'}
                action={
                  user?.role === 'doctor' ? (
                    <button
                      onClick={() => navigate('/consultation')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white rounded-lg"
                      style={{ background: '#178A3D' }}
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      Open Consultation Page
                    </button>
                  ) : null
                }
              />
              <div className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#178A3D20' }}>
                      <User className="w-4 h-4" style={{ color: '#178A3D' }} />
                    </div>
                    <div>
                      <p className="text-micro font-bold uppercase tracking-wider" style={{ color: '#178A3D' }}>Doctor</p>
                      <p className="text-sm font-semibold text-gray-800">{visit.assigned_doctor_name ?? assignedDoctor?.full_name ?? ' - '}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#9A341220' }}>
                      <User className="w-4 h-4" style={{ color: '#9A3412' }} />
                    </div>
                    <div>
                      <p className="text-micro font-bold uppercase tracking-wider" style={{ color: '#9A3412' }}>Assisting Nurse</p>
                      <p className="text-sm font-semibold text-gray-800">{visit.consultation_nurse_name ?? ' - '}</p>
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
                  <div className="p-3 rounded-lg" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <p className="text-micro font-bold uppercase tracking-wider text-green-700 mb-1">Chief Complaint</p>
                    <p className="text-sm text-green-800">{visit.chief_complaint}</p>
                  </div>
                )}

                {(visit.clinical_findings || visit.diagnosis || visit.recommendations || visit.follow_up_instructions) ? (
                  <div className="space-y-3">
                    {visit.clinical_findings && (
                      <div className="p-3 rounded-lg" style={{ background: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                        <p className="text-micro font-bold uppercase tracking-wider text-green-700 mb-1">Clinical Findings / Examination</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{visit.clinical_findings}</p>
                      </div>
                    )}
                    {visit.diagnosis && (
                      <div className="p-3 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                        <p className="text-micro font-bold uppercase tracking-wider text-green-700 mb-1">Diagnosis</p>
                        <p className="text-sm font-semibold text-gray-800">{visit.diagnosis}</p>
                      </div>
                    )}
                    {visit.recommendations && (
                      <div className="p-3 rounded-lg" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                        <p className="text-micro font-bold uppercase tracking-wider text-amber-600 mb-1">Recommendations / Plan of Care</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{visit.recommendations}</p>
                      </div>
                    )}
                    {visit.follow_up_instructions && (
                      <div className="p-3 rounded-lg" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                        <p className="text-micro font-bold uppercase tracking-wider text-sky-600 mb-1">Follow-up Instructions</p>
                        <p className="text-sm text-gray-700">{visit.follow_up_instructions}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-3" style={{ background: 'rgba(23,138,61,0.1)' }}>
                      <FileText className="w-6 h-6" style={{ color: '#178A3D' }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">No consultation notes yet</p>
                    <p className="text-xs text-gray-400 mb-3">
                      {user?.role === 'doctor' ? 'Record findings, diagnosis and recommendations on the Consultation page.' : 'The doctor has not yet recorded consultation notes.'}
                    </p>
                    {user?.role === 'doctor' && (
                      <button
                        onClick={() => navigate('/consultation')}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
                        style={{ background: '#178A3D' }}
                      >
                        <Stethoscope className="w-4 h-4" />
                        Open Consultation Page
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Link
              to={`/visits/${visit.id}/journey`}
              className="flex items-center justify-between px-5 py-4 rounded-lg border border-green-200 hover:border-green-400 transition-colors"
              style={{ background: '#EFF6FF' }}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-green-700" />
                <div>
                  <p className="text-sm font-semibold text-green-800">View Full Patient Journey</p>
                  <p className="text-xs text-green-700 mt-0.5">Complete timeline from arrival to discharge  -  all actors, times, vitals, prescriptions</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-green-500 flex-shrink-0" />
            </Link>
          </div>
        )}

        {activeTab === 'prescriptions' && (
          <div className="w-full px-6 py-5 space-y-4">
            {!canOpenPrescriptions && (
              <Card>
                <div className="flex items-start gap-3 px-5 py-4" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#C2410C' }} />
                  <div>
                    <p className="text-body-sm font-semibold" style={{ color: '#9A3412' }}>
                      Prescription flow is locked for this visit
                    </p>
                    <p className="text-caption mt-1" style={{ color: '#C2410C' }}>
                      {prescriptionBlockReason}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { status: 'submitted',    label: 'Submitted',    color: '#178A3D' },
                { status: 'flagged',      label: 'Flagged',      color: '#178A3D' },
                { status: 'verified',     label: 'Verified',     color: '#178A3D' },
                { status: 'dispensed',    label: 'Dispensed',    color: '#D97706' },
                { status: 'administered', label: 'Administered', color: '#22C55E' },
                { status: 'draft',        label: 'Draft',        color: '#94A3B8' },
              ].map(({ status, label, color }) => {
                const count = prescriptions.filter(p => p.status === status).length;
                return (
                  <div key={status} className="flex flex-col items-center p-2.5 rounded-lg" style={{ background: `${color}0D`, border: `1px solid ${color}25` }}>
                    <span className="text-xl font-extrabold tabular-nums" style={{ color }}>{count}</span>
                    <span className="text-meta mt-0.5 text-center" style={{ color }}>{label}</span>
                  </div>
                );
              })}
            </div>

            {['doctor', 'admin'].includes(user?.role ?? '') && canOpenPrescriptions && (
              <Link
                to={`/prescriptions/new?patient_id=${visit.patient_id}&visit_id=${id}`}
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90 w-fit"
                style={{ background: '#178A3D' }}
              >
                <FilePlus className="w-4 h-4" />
                Write New Prescription
              </Link>
            )}

            {['doctor', 'admin'].includes(user?.role ?? '') && !canOpenPrescriptions && (
              <div className="px-4 py-3 rounded-lg text-sm" style={{ background: '#EFF6FF', color: '#0F6E2F', border: '1px solid #BFDBFE' }}>
                Finish triage and start consultation before the doctor can write a prescription.
              </div>
            )}

            {prescriptions.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.08)' }}>
                    <Pill className="w-7 h-7" style={{ color: '#178A3D' }} />
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
                              {rx.rx_number ?? rx.id.slice(0, 8) + ''}
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
                            {rx.medications.map(m => `${m.name} ${m.dose}`).join(' · ').slice(0, 80) || 'No medications listed'}
                          </p>
                          <p className="text-caption mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <Calendar className="w-3 h-3" />
                            {fmtDateTime(rx.ordered_at ?? rx.created_at)}
                            {rx.doctor_name && ` · Dr. ${rx.doctor_name}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {['submitted', 'verified', 'dispensed', 'administered'].map((st, i) => {
                            const order = ['draft', 'submitted', 'verified', 'dispensed', 'administered', 'archived'];
                            const rxIdx = order.indexOf(rx.status);
                            const stIdx = order.indexOf(st);
                            const passed = rxIdx >= stIdx;
                            return (
                              <span key={st} className="contents">
                                <div className="w-2 h-2 rounded-full" style={{ background: passed ? '#178A3D' : 'var(--surface-3)' }} />
                                {i < 3 && <div className="w-3 h-0.5" style={{ background: passed ? '#178A3D' : 'var(--surface-3)' }} />}
                              </span>
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
          <div className="w-full px-6 py-5 space-y-5">
            {!bill ? (
              <Card>
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.08)' }}>
                    <Receipt className="w-8 h-8" style={{ color: '#178A3D' }} />
                  </div>
                  <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>No bill generated yet</p>
                  <p className="text-caption text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
                    Auto-generates an itemized bill from this visit: consultation, bed-days, nursing and dispensed medications, priced from the catalogue.
                  </p>
                  {canBill && (
                    <button
                      onClick={handleGenerateBill}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                      style={{ background: '#178A3D' }}
                    >
                      <Receipt className="w-4 h-4" />
                      Auto-Generate Bill
                    </button>
                  )}
                </div>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Amount', value: fmtKES(bill.total_amount), color: '#0F172A', bg: 'var(--bg-card)' },
                    { label: 'Amount Paid',  value: fmtKES(bill.paid_amount),  color: '#178A3D', bg: '#F0FDF4' },
                    { label: 'Balance Due',  value: fmtKES(bill.balance_due),  color: bill.balance_due > 0 ? '#DC2626' : '#178A3D', bg: bill.balance_due > 0 ? '#FEF2F2' : '#F0FDF4' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className="rounded-lg p-4 text-center" style={{ background: bg, border: '1px solid var(--border-default)' }}>
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
                      Bill ID: <span className="font-mono">{bill._id.slice(0, 8)}</span>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {canBill && (
                      <button onClick={() => setShowAddCharge(true)} className="flex items-center gap-1.5 px-3 py-2 text-caption font-bold rounded-lg border transition-colors hover:bg-[var(--bg-base)]" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
                        <PlusCircle className="w-3.5 h-3.5" /> Add Charge
                      </button>
                    )}
                    {bill.balance_due > 0 && canBill && (
                      <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 px-3 py-2 text-caption font-bold text-white rounded-lg" style={{ background: '#178A3D' }}>
                        <Banknote className="w-3.5 h-3.5" /> Record Payment
                      </button>
                    )}
                  </div>
                </div>

                <Card>
                  <CardHeader
                    icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(23,138,61,0.1)' }}><CreditCard className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
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
                      icon={<div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.1)' }}><Banknote className="w-3.5 h-3.5" style={{ color: '#178A3D' }} /></div>}
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
                              {p.reference_number && ` · Ref: ${p.reference_number}`}
                            </p>
                          </div>
                          <span className="text-body font-extrabold tabular-nums" style={{ color: '#178A3D' }}>{fmtKES(p.amount)}</span>
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
          nurses={nurses}
          rooms={rooms}
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
    </div>
  );
}
