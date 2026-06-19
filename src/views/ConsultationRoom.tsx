import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope, User, Clock, AlertTriangle, Plus, Trash2,
  CheckCircle2, RefreshCw, ChevronRight, Pill, Activity,
  Heart, Wind, Thermometer, ClipboardList, X,
  ArrowRightCircle, UserCheck, FileText, DoorOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { visitsApi, Visit, ConsultationNotePayload } from '../api/visits';
import { prescriptionsApi } from '../api/prescriptions';
import { patientsApi } from '../api/patients';
import { consultationRoomsApi } from '../api/consultationRooms';
import { useAuth } from '../context/AuthContext';
import { OrderSource, Patient, MedicationItem, Priority } from '../models/types';

const ROUTE_OPTIONS = [
  { value: 'oral',        label: 'Oral' },
  { value: 'IV',          label: 'IV (Intravenous)' },
  { value: 'IM',          label: 'IM (Intramuscular)' },
  { value: 'SC',          label: 'SC (Subcutaneous)' },
  { value: 'sublingual',  label: 'Sublingual' },
  { value: 'topical',     label: 'Topical' },
  { value: 'inhalation',  label: 'Inhalation' },
  { value: 'nasal',       label: 'Nasal' },
  { value: 'rectal',      label: 'Rectal' },
  { value: 'NG tube',     label: 'NG Tube' },
];

const FREQ_OPTIONS = [
  { value: 'OD',     label: 'OD  -  Once Daily' },
  { value: 'BD',     label: 'BD  -  Twice Daily' },
  { value: 'TDS',    label: 'TDS  -  Three Times Daily' },
  { value: 'QDS',    label: 'QDS  -  Four Times Daily' },
  { value: 'mane',   label: 'Mane  -  Morning' },
  { value: 'nocte',  label: 'Nocte  -  At Night' },
  { value: 'PRN',    label: 'PRN  -  As Needed' },
  { value: 'STAT',   label: 'STAT  -  Immediately' },
  { value: 'weekly', label: 'Weekly' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'routine',   label: 'Routine',   color: '#178A3D' },
  { value: 'urgent',    label: 'Urgent',    color: '#D97706' },
  { value: 'stat',      label: 'STAT',      color: '#DC2626' },
  { value: 'discharge', label: 'Discharge', color: '#178A3D' },
];

function calcAge(dob?: string): string {
  if (!dob) return '?';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return `${years}y`;
}

function timeWaiting(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function visitOrderSource(visitType: string): OrderSource {
  const map: Record<string, OrderSource> = {
    opd: 'opd', ipd: 'ipd', emergency: 'emergency',
    day_surgery: 'theatre', maternity: 'maternity',
    paediatric: 'paediatric', nicu: 'nicu',
  };
  return map[visitType] ?? 'opd';
}

function parseDoseNum(dose: string): number {
  const m = dose.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function allergyLabel(a: unknown): string {
  if (typeof a === 'string') return a;
  const obj = a as Record<string, unknown>;
  return String(obj?.substance ?? obj?.name ?? a);
}

const inp = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors';
const inpStyle = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
};

function Lbl({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
      {children}{required && <span style={{ color: '#DC2626' }}> *</span>}
    </label>
  );
}

function NoPatientSelected() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-12 text-center">
      <div className="w-20 h-20 rounded-lg flex items-center justify-center" style={{ background: 'var(--clinical-100)' }}>
        <Stethoscope className="w-10 h-10" style={{ color: 'var(--clinical-600)' }} />
      </div>
      <div>
        <p className="text-h3 mb-1" style={{ color: 'var(--text-primary)' }}>Consultation Room</p>
        <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
          Select a waiting patient from the queue to begin.
        </p>
      </div>
    </div>
  );
}

type QueueTab = 'waiting' | 'consulting';

function QueuePanel({
  waiting, consulting, activeVisitId, onSelect, onRefresh, loading, isAdmin,
}: {
  waiting: Visit[]; consulting: Visit[]; activeVisitId?: string;
  onSelect: (v: Visit) => void; onRefresh: () => void; loading: boolean;
  isAdmin?: boolean;
}) {
  const [tab, setTab] = useState<QueueTab>('waiting');
  const list = tab === 'waiting' ? waiting : consulting;

  return (
    <div
      className="w-72 flex-shrink-0 flex flex-col border-r"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
    >
      <div className="px-4 pt-5 pb-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-body font-bold" style={{ color: 'var(--text-primary)' }}>
            {isAdmin ? 'All Patients' : 'My Patients'}
          </p>
          <button
            onClick={onRefresh} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-base)] transition-colors disabled:opacity-50"
            style={{ color: 'var(--text-muted)' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex rounded-lg p-0.5 gap-1" style={{ background: 'var(--bg-base)' }}>
          {([
            { key: 'waiting' as QueueTab,    label: 'Waiting',  count: waiting.length },
            { key: 'consulting' as QueueTab, label: 'Active',   count: consulting.length },
          ]).map(({ key, label, count }) => (
            <button
              key={key} onClick={() => setTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all"
              style={{
                background: tab === key ? 'var(--bg-card)' : 'transparent',
                color:      tab === key ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow:  tab === key ? 'var(--shadow-card)' : 'none',
              }}
            >
              {label}
              {count > 0 && (
                <span
                  className="w-4 h-4 rounded-full text-micro flex items-center justify-center font-bold"
                  style={{
                    background: key === 'waiting' ? '#DBEAFE' : '#C8EED6',
                    color:      key === 'waiting' ? '#0F6E2F' : '#0F6E2F',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading && list.length === 0 ? (
          <div className="space-y-2 px-3 py-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: 'var(--bg-base)' }} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
            <UserCheck className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
              {tab === 'waiting' ? 'No patients waiting' : 'No active consultation'}
            </p>
          </div>
        ) : (
          list.map(v => {
            const isActive   = v.id === activeVisitId;
            const isCritical = v.priority === 'critical' || v.priority === 'immediate';
            const isUrgent   = v.priority === 'urgent';
            return (
              <button
                key={v.id} onClick={() => onSelect(v)}
                className="w-full text-left transition-all"
                style={{
                  padding: '8px 12px',
                  margin: '2px 4px',
                  width: 'calc(100% - 8px)',
                  background: isActive ? 'var(--clinical-50)' : 'transparent',
                  border:     `1.5px solid ${isActive ? 'var(--clinical-200)' : 'transparent'}`,
                  borderRadius: '12px',
                  display: 'block',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      background: isCritical ? '#FEE2E2' : isUrgent ? '#FEF3C7' : 'var(--bg-base)',
                      color:      isCritical ? '#DC2626' : isUrgent ? '#D97706' : 'var(--text-secondary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    {(v.patient_name ?? 'P').charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {v.patient_name ?? 'Unknown Patient'}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {v.chief_complaint ?? 'No complaint recorded'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Clock className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {timeWaiting(v.registered_at)}
                      </span>
                      {(isCritical || isUrgent) && (
                        <span
                          className="text-micro font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: isCritical ? '#FEE2E2' : '#FEF3C7',
                            color:      isCritical ? '#DC2626' : '#D97706',
                          }}
                        >
                          {v.priority?.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 mt-1.5 flex-shrink-0" style={{ color: 'var(--clinical-600)' }} />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function VitalsBar({ vitals }: { vitals: Visit['vitals'] }) {
  if (!vitals) return (
    <div className="px-5 py-2 text-xs italic" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
      No vitals recorded from triage
    </div>
  );

  const items = [
    { Icon: Heart,       label: 'BP',     value: vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}` : null, unit: 'mmHg' },
    { Icon: Thermometer, label: 'Temp',   value: vitals.temperature_celsius != null ? vitals.temperature_celsius.toFixed(1) : null, unit: '°C' },
    { Icon: Activity,    label: 'Pulse',  value: vitals.pulse_rate ?? null, unit: 'bpm' },
    { Icon: Wind,        label: 'O,, Sat', value: vitals.oxygen_saturation ?? null, unit: '%' },
    { Icon: Wind,        label: 'RR',     value: vitals.respiratory_rate ?? null, unit: '/min' },
    { Icon: User,        label: 'Wt',     value: vitals.weight_kg ?? null, unit: 'kg' },
  ].filter(i => i.value !== null);

  if (items.length === 0) return (
    <div className="px-5 py-2 text-xs italic" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
      No vitals recorded from triage
    </div>
  );

  return (
    <div
      className="flex flex-wrap gap-x-5 gap-y-1.5 px-5 py-2.5"
      style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-base)' }}
    >
      {items.map(({ Icon, label, value, unit }) => (
        <div key={label} className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}:</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{unit}</span>
        </div>
      ))}
    </div>
  );
}

function MedRow({
  med, index, onChange, onRemove, showRemove,
}: {
  med: MedicationItem; index: number;
  onChange: (i: number, f: keyof MedicationItem, v: string | number) => void;
  onRemove: (i: number) => void;
  showRemove: boolean;
}) {
  const doseNum    = parseDoseNum(med.dose);
  const isMcg      = /mcg|microgram/i.test(med.dose);
  const isHighDose = (isMcg && doseNum > 500) || (!isMcg && doseNum > 2000);

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: isHighDose ? '#FFFBEB' : 'var(--bg-base)',
        border: `1.5px solid ${isHighDose ? '#FCD34D' : 'var(--border-default)'}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Medication {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {isHighDose && (
            <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
              <AlertTriangle className="w-3 h-3" /> High Dose  -  will flag for audit
            </span>
          )}
          {showRemove && (
            <button
              onClick={() => onRemove(index)}
              className="p-1 rounded-lg hover:bg-red-50 transition-colors"
              style={{ color: '#DC2626' }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Lbl required>Drug Name</Lbl>
          <input
            className={inp} style={inpStyle}
            placeholder="e.g. Amoxicillin"
            value={med.name}
            onChange={e => onChange(index, 'name', e.target.value)}
          />
        </div>
        <div>
          <Lbl required>Dose</Lbl>
          <input
            className={inp} style={inpStyle}
            placeholder="e.g. 500mg, 10mg/5ml"
            value={med.dose}
            onChange={e => onChange(index, 'dose', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Lbl required>Route</Lbl>
          <select className={inp} style={inpStyle} value={med.route} onChange={e => onChange(index, 'route', e.target.value)}>
            <option value="">Select</option>
            {ROUTE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <Lbl required>Frequency</Lbl>
          <select className={inp} style={inpStyle} value={med.frequency} onChange={e => onChange(index, 'frequency', e.target.value)}>
            <option value="">Select</option>
            {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <Lbl required>Duration (days)</Lbl>
          <input
            type="number" min={1} max={365}
            className={inp} style={inpStyle}
            value={med.duration_days}
            onChange={e => onChange(index, 'duration_days', parseInt(e.target.value, 10) || 1)}
          />
        </div>
      </div>
    </div>
  );
}

type NextStatus = 'treatment_in_progress' | 'awaiting_results' | 'ready_for_discharge';

const NEXT_OPTIONS: { value: NextStatus; label: string; desc: string; color: string }[] = [
  {
    value: 'treatment_in_progress',
    label: 'Treatment in Progress',
    desc: 'Prescription sent to pharmacy  -  patient receives medication on-site.',
    color: '#178A3D',
  },
  {
    value: 'awaiting_results',
    label: 'Awaiting Lab / Radiology Results',
    desc: 'Investigations ordered  -  patient stays until results are reviewed.',
    color: '#D97706',
  },
  {
    value: 'ready_for_discharge',
    label: 'Ready for Discharge',
    desc: 'Consultation complete  -  patient may be discharged with instructions.',
    color: '#178A3D',
  },
];

function CompleteModal({
  hasPendingMeds, onComplete, onClose, completing,
}: {
  hasPendingMeds: boolean;
  onComplete: (s: NextStatus) => void;
  onClose: () => void;
  completing: boolean;
}) {
  const [next, setNext] = useState<NextStatus>('treatment_in_progress');
  const chosen = NEXT_OPTIONS.find(o => o.value === next)!;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md rounded-lg overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <h3 className="text-h3" style={{ color: 'var(--text-primary)' }}>Complete Consultation</h3>
            <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Any unsaved notes and pending medications will be submitted automatically.
            </p>
          </div>

          <div className="px-6 py-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              What happens next for this patient?
            </p>
            {NEXT_OPTIONS.map(opt => (
              <button
                key={opt.value} onClick={() => setNext(opt.value)}
                className="w-full text-left p-4 rounded-lg transition-all"
                style={{
                  background: next === opt.value ? `${opt.color}12` : 'var(--bg-base)',
                  border: `2px solid ${next === opt.value ? opt.color : 'var(--border-default)'}`,
                }}
              >
                <p className="text-body-sm font-semibold" style={{ color: next === opt.value ? opt.color : 'var(--text-primary)' }}>
                  {opt.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
              </button>
            ))}
          </div>

          {hasPendingMeds && next === 'treatment_in_progress' && (
            <div className="mx-6 mb-4 px-4 py-3 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-xs font-semibold" style={{ color: '#0F6E2F' }}>
                Prescription will be submitted and sent to the pharmacy queue now.
              </p>
            </div>
          )}

          <div
            className="flex justify-end gap-3 px-6 py-4"
            style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)' }}
          >
            <button
              onClick={onClose} disabled={completing}
              className="px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-[var(--bg-row-hover)]"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => onComplete(next)} disabled={completing}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              style={{ background: chosen.color }}
            >
              {completing ? 'Processing' : 'Complete Consultation'}
              {!completing && <ArrowRightCircle className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface NoteState {
  clinical_findings: string;
  diagnosis: string;
  plan_of_care: string;
  follow_up_instructions: string;
  follow_up_date: string;
}
const emptyNote = (): NoteState => ({
  clinical_findings: '', diagnosis: '', plan_of_care: '',
  follow_up_instructions: '', follow_up_date: '',
});
const emptyMed = (): MedicationItem => ({ name: '', dose: '', route: '', frequency: '', duration_days: 5 });

export default function ConsultationRoom() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const isAdmin   = user?.role === 'admin';

  const [loading,    setLoading]    = useState(false);
  const [allVisits,  setAllVisits]  = useState<Visit[]>([]);

  const [activeVisit,    setActiveVisit]    = useState<Visit | null>(null);
  const [patient,        setPatient]        = useState<Patient | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);

  const [assignedRoomId,  setAssignedRoomId]  = useState<string | null>(null);
  const [assignedRoomName,setAssignedRoomName]= useState<string | null>(null);

  const [note,      setNote]      = useState<NoteState>(emptyNote());
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteSaving,setNoteSaving]= useState(false);

  const [meds,         setMeds]         = useState<MedicationItem[]>([emptyMed()]);
  const [priority,     setPriority]     = useState<Priority>('routine');
  const [rxNotes,      setRxNotes]      = useState('');
  const [rxSubmitted,  setRxSubmitted]  = useState(false);
  const [rxSubmitting, setRxSubmitting] = useState(false);

  const [showComplete, setShowComplete] = useState(false);
  const [completing,   setCompleting]   = useState(false);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const [waitRes, activeRes] = await Promise.all([
        visitsApi.list({ status: 'waiting_for_doctor', limit: 100 }),
        visitsApi.list({ status: 'in_consultation',    limit: 100 }),
      ]);
      const toArr = (r: unknown): Visit[] => {
        if (Array.isArray(r)) return r;
        const obj = r as Record<string, unknown>;
        return Array.isArray(obj?.items) ? (obj.items as Visit[]) : [];
      };
      const myId   = user?.id;
      const filter = (arr: Visit[]) =>
        isAdmin ? arr : myId ? arr.filter(v => !v.assigned_doctor_id || v.assigned_doctor_id === myId) : arr;
      setAllVisits([
        ...filter(toArr(waitRes.data)),
        ...filter(toArr(activeRes.data)),
      ]);
    } catch {
      toast.error('Failed to load patient queue');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdmin]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  const waiting    = useMemo(() => allVisits.filter(v => v.status === 'waiting_for_doctor'), [allVisits]);
  const consulting = useMemo(() => allVisits.filter(v => v.status === 'in_consultation'),    [allVisits]);

  const loadPatientAndNote = useCallback(async (visit: Visit) => {
    setPatientLoading(true);
    try {
      const [ptRes, noteRes] = await Promise.all([
        patientsApi.getById(visit.patient_id),
        visitsApi.getConsultationNote(visit.id).catch(() => null),
      ]);
      setPatient(ptRes.data);
      if (noteRes?.data) {
        const n = noteRes.data;
        setNote({
          clinical_findings:      n.clinical_findings      ?? '',
          diagnosis:              n.diagnosis              ?? '',
          plan_of_care:           n.plan_of_care           ?? '',
          follow_up_instructions: n.follow_up_instructions ?? '',
          follow_up_date:         n.follow_up_date         ?? '',
        });
        setNoteSaved(true);
      }
    } catch {
      toast.error('Could not load patient details');
    } finally {
      setPatientLoading(false);
    }
  }, []);

  const activateVisit = useCallback(async (visit: Visit) => {
    setActiveVisit(visit);
    setAssignedRoomId(null);
    setAssignedRoomName(visit.consultation_room ?? null);

    if (visit.status === 'waiting_for_doctor') {
      try {
        const updated = await visitsApi.update(visit.id, { status: 'in_consultation' });
        setActiveVisit(updated.data);
        setAllVisits(prev => prev.map(v => v.id === visit.id ? updated.data : v));
      } catch {}
    }
  }, []);

  const handleSelectVisit = useCallback(async (visit: Visit) => {
    setNote(emptyNote());
    setMeds([emptyMed()]);
    setPriority('routine');
    setRxNotes('');
    setRxSubmitted(false);
    setNoteSaved(false);

    setActiveVisit(visit);
    await loadPatientAndNote(visit);

    if (visit.status === 'in_consultation') {
      setAssignedRoomId(null);
      setAssignedRoomName(visit.consultation_room ?? null);
      return;
    }

    await activateVisit(visit);
  }, [loadPatientAndNote, activateVisit]);

  const updateMed = (i: number, field: keyof MedicationItem, val: string | number) =>
    setMeds(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  const hasValidMeds = meds.some(m => m.name.trim() && m.dose.trim() && m.route && m.frequency);

  const handleSaveNote = async () => {
    if (!activeVisit) return;
    const hasContent = Object.values(note).some(v => v.trim());
    if (!hasContent) { toast.error('Add at least one field before saving'); return; }
    setNoteSaving(true);
    try {
      const payload: ConsultationNotePayload = {
        clinical_findings:     note.clinical_findings     || undefined,
        diagnosis:             note.diagnosis             || undefined,
        plan_of_care:          note.plan_of_care          || undefined,
        follow_up_instructions:note.follow_up_instructions || undefined,
        follow_up_date:        note.follow_up_date        || undefined,
      };
      await visitsApi.addConsultationNote(activeVisit.id, payload);
      setNoteSaved(true);
      toast.success('Consultation note saved');
    } catch {
      toast.error('Failed to save note');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleSubmitRx = async () => {
    if (!activeVisit) return;
    const valid = meds.filter(m => m.name.trim() && m.dose.trim() && m.route && m.frequency);
    if (valid.length === 0) { toast.error('Complete at least one medication entry'); return; }
    setRxSubmitting(true);
    try {
      await prescriptionsApi.create({
        patient_id:   activeVisit.patient_id,
        medications:  valid,
        visit_id:     activeVisit.id,
        priority,
        order_source: visitOrderSource(activeVisit.visit_type),
        notes:        rxNotes || undefined,
      });
      setRxSubmitted(true);
      setMeds([emptyMed()]);
      toast.success('Prescription sent to pharmacy queue');
    } catch {
      toast.error('Failed to submit prescription');
    } finally {
      setRxSubmitting(false);
    }
  };

  const handleComplete = async (nextStatus: NextStatus) => {
    if (!activeVisit) return;
    setCompleting(true);
    try {
      if (!noteSaved && Object.values(note).some(v => v.trim())) {
        await visitsApi.addConsultationNote(activeVisit.id, {
          clinical_findings:     note.clinical_findings     || undefined,
          diagnosis:             note.diagnosis             || undefined,
          plan_of_care:          note.plan_of_care          || undefined,
          follow_up_instructions:note.follow_up_instructions || undefined,
          follow_up_date:        note.follow_up_date        || undefined,
        });
      }

      if (!rxSubmitted && hasValidMeds) {
        const valid = meds.filter(m => m.name.trim() && m.dose.trim() && m.route && m.frequency);
        await prescriptionsApi.create({
          patient_id:   activeVisit.patient_id,
          medications:  valid,
          visit_id:     activeVisit.id,
          priority,
          order_source: visitOrderSource(activeVisit.visit_type),
          notes:        rxNotes || undefined,
        });
      }

      await visitsApi.update(activeVisit.id, { status: nextStatus });

      if (assignedRoomId) {
        try {
          await consultationRoomsApi.update(assignedRoomId, {
            status:             'available',
            current_patient_id: undefined,
            current_doctor_id:  undefined,
          });
        } catch {}
      }

      toast.success('Consultation completed');
      setShowComplete(false);
      setActiveVisit(null);
      setPatient(null);
      setAssignedRoomId(null);
      setAssignedRoomName(null);
      await loadVisits();
    } catch {
      toast.error('Failed to complete consultation');
    } finally {
      setCompleting(false);
    }
  };

  const allergies = (patient?.allergies ?? []) as unknown[];
  const chronic   = patient?.chronic_conditions ?? [];

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      <QueuePanel
        waiting={waiting}
        consulting={consulting}
        activeVisitId={activeVisit?.id}
        onSelect={handleSelectVisit}
        onRefresh={loadVisits}
        loading={loading}
        isAdmin={isAdmin}
      />

      {!activeVisit ? (
        <div className="flex-1"><NoPatientSelected /></div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">

          <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
            <div className="flex items-start justify-between px-5 py-4">
              <div className="flex items-start gap-3">
                {patientLoading ? (
                  <div className="w-12 h-12 rounded-lg animate-pulse" style={{ background: 'var(--bg-base)' }} />
                ) : (
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0"
                    style={{ background: 'var(--clinical-100)', color: 'var(--clinical-600)' }}
                  >
                    {(activeVisit.patient_name ?? 'P').charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-h2" style={{ color: 'var(--text-primary)' }}>
                      {activeVisit.patient_name ?? 'Patient'}
                    </h2>
                    {activeVisit.priority === 'critical' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#DC2626' }}>CRITICAL</span>
                    )}
                    {activeVisit.priority === 'immediate' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#DC2626' }}>IMMEDIATE</span>
                    )}
                    {activeVisit.priority === 'urgent' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#D97706' }}>URGENT</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {patient ? (
                      <>
                        <span className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
                          MRN: <strong style={{ color: 'var(--text-primary)' }}>{patient.mrn}</strong>
                        </span>
                        <span className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
                          {calcAge(patient.dob)} · {patient.gender ?? '?'} · {patient.blood_group ?? 'Unknown blood group'}
                        </span>
                        {patient.weight && (
                          <span className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
                            {patient.weight} kg
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-body-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>Loading patient</span>
                    )}
                    <span className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
                      {activeVisit.visit_number} · {activeVisit.visit_type.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {assignedRoomName && (
                  <span
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: '#DCFCE7', color: '#178A3D', border: '1px solid #A7F3D0' }}
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    {assignedRoomName}
                  </span>
                )}
                <button
                  onClick={() => navigate(`/visits/${activeVisit.id}`)}
                  className="flex items-center gap-1 text-xs font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--clinical-600)' }}
                >
                  Full visit <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {activeVisit.chief_complaint && (
              <div className="px-5 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider mr-2" style={{ color: 'var(--text-muted)' }}>CC:</span>
                <span className="text-body-sm" style={{ color: 'var(--text-primary)' }}>{activeVisit.chief_complaint}</span>
              </div>
            )}

            {(allergies.length > 0 || chronic.length > 0) && (
              <div className="flex flex-wrap gap-2 px-5 pb-3">
                {allergies.map((a, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
                    <AlertTriangle className="w-3 h-3" /> ALLERGY: {allergyLabel(a)}
                  </span>
                ))}
                {chronic.map((c, i) => (
                  <span key={i} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                    {c}
                  </span>
                ))}
              </div>
            )}

            <VitalsBar vitals={activeVisit.vitals} />
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6" style={{ background: '#F1F5F9' }}>

            <div
              className="rounded-lg overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EFF6FF' }}>
                    <FileText className="w-4 h-4" style={{ color: '#178A3D' }} />
                  </div>
                  <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Consultation Notes</p>
                </div>
                {noteSaved && (
                  <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#178A3D' }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <Lbl>Clinical Findings</Lbl>
                  <textarea
                    rows={3} className={inp} style={{ ...inpStyle, resize: 'vertical' }}
                    placeholder="Physical examination findings, observations, test results reviewed"
                    value={note.clinical_findings}
                    onChange={e => { setNote(n => ({ ...n, clinical_findings: e.target.value })); setNoteSaved(false); }}
                  />
                </div>
                <div>
                  <Lbl>Diagnosis</Lbl>
                  <input
                    className={inp} style={inpStyle}
                    placeholder="e.g. Upper respiratory tract infection (URTI), ICD-10: J06.9"
                    value={note.diagnosis}
                    onChange={e => { setNote(n => ({ ...n, diagnosis: e.target.value })); setNoteSaved(false); }}
                  />
                </div>
                <div>
                  <Lbl>Plan of Care</Lbl>
                  <textarea
                    rows={2} className={inp} style={{ ...inpStyle, resize: 'vertical' }}
                    placeholder="Management plan, investigations ordered, referrals, procedures"
                    value={note.plan_of_care}
                    onChange={e => { setNote(n => ({ ...n, plan_of_care: e.target.value })); setNoteSaved(false); }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Lbl>Follow-up Instructions</Lbl>
                    <input
                      className={inp} style={inpStyle}
                      placeholder="e.g. Return in 7 days if no improvement"
                      value={note.follow_up_instructions}
                      onChange={e => { setNote(n => ({ ...n, follow_up_instructions: e.target.value })); setNoteSaved(false); }}
                    />
                  </div>
                  <div>
                    <Lbl>Follow-up Date</Lbl>
                    <input
                      type="date" className={inp} style={inpStyle}
                      value={note.follow_up_date}
                      onChange={e => { setNote(n => ({ ...n, follow_up_date: e.target.value })); setNoteSaved(false); }}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNote} disabled={noteSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    style={{ background: '#178A3D' }}
                  >
                    {noteSaving ? 'Saving' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </div>

            <div
              className="rounded-lg overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F0FDF4' }}>
                    <Pill className="w-4 h-4" style={{ color: '#178A3D' }} />
                  </div>
                  <p className="text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Prescription</p>
                </div>
                {rxSubmitted && (
                  <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#178A3D' }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sent to Pharmacy
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <Lbl>Priority</Lbl>
                  <div className="flex gap-2 flex-wrap">
                    {PRIORITY_OPTIONS.map(opt => (
                      <button
                        key={opt.value} onClick={() => setPriority(opt.value)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: priority === opt.value ? opt.color : 'var(--bg-base)',
                          color:      priority === opt.value ? 'white' : 'var(--text-muted)',
                          border: `1.5px solid ${priority === opt.value ? opt.color : 'var(--border-default)'}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {meds.map((med, i) => (
                    <MedRow
                      key={i} med={med} index={i}
                      onChange={updateMed}
                      onRemove={idx => setMeds(prev => prev.filter((_, j) => j !== idx))}
                      showRemove={meds.length > 1}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setMeds(prev => [...prev, emptyMed()])}
                  className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--clinical-600)' }}
                >
                  <Plus className="w-4 h-4" /> Add Another Medication
                </button>

                <div>
                  <Lbl>Notes for Pharmacist</Lbl>
                  <input
                    className={inp} style={inpStyle}
                    placeholder="Special dispensing instructions, substitution notes (optional)"
                    value={rxNotes}
                    onChange={e => setRxNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitRx}
                    disabled={rxSubmitting || rxSubmitted || !hasValidMeds}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    style={{ background: '#178A3D' }}
                  >
                    {rxSubmitting
                      ? 'Submitting'
                      : rxSubmitted
                        ? '✓ Prescription Sent'
                        : (<><Pill className="w-4 h-4" /> Submit to Pharmacy</>)
                    }
                  </button>
                </div>
              </div>
            </div>

          </div>

          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-default)' }}
          >
            <button
              onClick={async () => {
                if (assignedRoomId) {
                  try {
                    await consultationRoomsApi.update(assignedRoomId, {
                      status: 'available',
                      current_patient_id: undefined,
                      current_doctor_id:  undefined,
                    });
                  } catch {}
                }
                setActiveVisit(null);
                setPatient(null);
                setAssignedRoomId(null);
                setAssignedRoomName(null);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border hover:bg-[var(--bg-base)] transition-colors"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
            >
              <X className="w-4 h-4" /> Close
            </button>
            <button
              onClick={() => setShowComplete(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
              style={{ background: 'var(--clinical-600)' }}
            >
              <ClipboardList className="w-4 h-4" />
              Complete Consultation
              <ArrowRightCircle className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {showComplete && (
        <CompleteModal
          hasPendingMeds={!rxSubmitted && hasValidMeds}
          onComplete={handleComplete}
          onClose={() => setShowComplete(false)}
          completing={completing}
        />
      )}
    </div>
  );
}
