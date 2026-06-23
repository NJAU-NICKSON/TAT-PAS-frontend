import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2, ChevronLeft, Activity, Thermometer, Heart,
  Wind, User, UserCheck, CheckCircle2,
  AlertCircle, RefreshCw, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { visitsApi, Visit, VitalSigns, TriagePayload } from '../api/visits';
import { getErrorMessage } from '../lib/utils';

const VITAL_FIELDS: {
  label: string;
  key: keyof VitalSigns;
  placeholder: string;
  unit: string;
  step?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  normal?: string;
}[] = [
  {
    label: 'Systolic BP', key: 'blood_pressure_systolic', placeholder: '120',
    unit: 'mmHg', icon: Heart, iconColor: '#DC2626', iconBg: '#FEE2E2', normal: '90 - 120',
  },
  {
    label: 'Diastolic BP', key: 'blood_pressure_diastolic', placeholder: '80',
    unit: 'mmHg', icon: Heart, iconColor: '#DC2626', iconBg: '#FEE2E2', normal: '60 - 80',
  },
  {
    label: 'Temperature', key: 'temperature_celsius', placeholder: '37.0',
    unit: '°C', step: '0.1', icon: Thermometer, iconColor: '#D97706', iconBg: '#FEF3C7', normal: '36.5 - 37.5',
  },
  {
    label: 'Pulse Rate', key: 'pulse_rate', placeholder: '72',
    unit: 'bpm', icon: Activity, iconColor: '#178A3D', iconBg: '#F3E8FF', normal: '60 - 100',
  },
  {
    label: 'SpO,,', key: 'oxygen_saturation', placeholder: '98',
    unit: '%', icon: Wind, iconColor: '#0284C7', iconBg: '#E0F2FE', normal: '95 - 100',
  },
  {
    label: 'Respiratory Rate', key: 'respiratory_rate', placeholder: '16',
    unit: '/min', icon: Activity, iconColor: '#178A3D', iconBg: '#DCFCE7', normal: '12 - 20',
  },
  {
    label: 'Weight', key: 'weight_kg', placeholder: '70',
    unit: 'kg', step: '0.1', icon: User, iconColor: '#475569', iconBg: '#F1F5F9',
  },
  {
    label: 'Height', key: 'height_cm', placeholder: '170',
    unit: 'cm', icon: User, iconColor: '#475569', iconBg: '#F1F5F9',
  },
];

function derivePriority(vitals: Partial<VitalSigns>): 'routine' | 'urgent' | 'critical' | 'immediate' {
  const { blood_pressure_systolic: sbp, pulse_rate: hr, oxygen_saturation: spo2, temperature_celsius: temp, respiratory_rate: rr } = vitals;
  if (spo2 !== undefined && spo2 < 90) return 'immediate';
  if (sbp !== undefined && sbp < 80) return 'immediate';
  if (hr !== undefined && (hr < 40 || hr > 140)) return 'critical';
  if (rr !== undefined && (rr < 8 || rr > 30)) return 'critical';
  if (spo2 !== undefined && spo2 < 94) return 'urgent';
  if (sbp !== undefined && sbp > 180) return 'urgent';
  if (temp !== undefined && (temp > 39.5 || temp < 35.0)) return 'urgent';
  if (hr !== undefined && (hr < 50 || hr > 120)) return 'urgent';
  return 'routine';
}

const PRIORITY_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  routine:   { bg: '#F0FDF4', color: '#166534', border: '#86EFAC', label: 'Routine'   },
  urgent:    { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D', label: 'Urgent'    },
  critical:  { bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5', label: 'Critical'  },
  immediate: { bg: '#FFF1F2', color: '#9F1239', border: '#FDA4AF', label: 'Immediate' },
};

function VitalCard({
  field, value, onChange,
}: {
  field: typeof VITAL_FIELDS[number];
  value: number | undefined;
  onChange: (val: number | undefined) => void;
}) {
  const { label, key, placeholder, unit, step, icon: Icon, iconColor, iconBg, normal } = field;
  const hasValue = value !== undefined && !isNaN(value);

  return (
    <div
      className="rounded-lg p-4 transition-all"
      style={{
        background: hasValue ? iconBg : 'white',
        border: `1.5px solid ${hasValue ? iconColor + '40' : '#E2E8F0'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-700 truncate">{label}</p>
          {normal && <p className="text-micro text-gray-400">Normal: {normal}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step={step ?? '1'}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={e => onChange(e.target.value !== '' ? Number(e.target.value) : undefined)}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm font-semibold text-gray-800 outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.8)',
            border: `1.5px solid ${hasValue ? iconColor + '50' : '#E2E8F0'}`,
          }}
        />
        <span className="text-xs font-semibold text-gray-400 flex-shrink-0">{unit}</span>
      </div>
      <span className="hidden">{key}</span>
    </div>
  );
}

export default function TriagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [visit,   setVisit]   = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const [vitals,    setVitals]    = useState<Partial<VitalSigns>>({});
  const [priority,  setPriority]  = useState<'routine' | 'urgent' | 'critical' | 'immediate'>('routine');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const vRes = await visitsApi.getById(id);
      const v = vRes.data;
      if (v) {
        setVisit(v);
        if (v.vitals) setVitals(v.vitals);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    setPriority(derivePriority(vitals));
  }, [vitals]);

  const handleSubmit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // The receptionist owns doctor and room assignment; triage only records vitals.
      const payload: TriagePayload = { vitals: vitals as VitalSigns };
      await visitsApi.triage(id, payload);
      toast.success('Triage completed successfully');
      navigate(`/visits/${id}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Could not complete triage.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1F5F9' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#178A3D' }} />
          <p className="text-sm text-gray-500">Loading visit</p>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1F5F9' }}>
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-base font-semibold text-gray-800">Visit not found</p>
          <button onClick={load} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#178A3D' }}>
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const alreadyTriaged = !!visit.triaged_at;
  const pStyle = PRIORITY_STYLE[priority];

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-default)' }}>
        <div className="w-full px-6 py-4">
          <Link
            to={`/visits/${visit.id}`}
            className="inline-flex items-center gap-1.5 text-xs mb-3 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Visit
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Thermometer className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {alreadyTriaged ? 'Update Triage' : 'Patient Triage'}
                </h1>
                {alreadyTriaged && (
                  <span className="text-meta font-semibold px-2 py-0.5" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)', border: '1px solid var(--status-success-border)', borderRadius: 'var(--radius-badge)' }}>
                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                    Already Triaged
                  </span>
                )}
              </div>
              <p className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{visit.patient_name ?? visit.patient_id}</span>
                {' · '}Visit #{visit.visit_number}
                {' · '}{visit.visit_type.replace(/_/g, ' ').toUpperCase()}
              </p>
              {visit.chief_complaint && (
                <p className="text-caption mt-1" style={{ color: 'var(--text-muted)' }}>
                  Chief complaint: <span style={{ color: 'var(--text-secondary)' }}>{visit.chief_complaint}</span>
                </p>
              )}
            </div>

            <div
              className="px-4 py-2 text-center"
              style={{ background: pStyle.bg, border: `1px solid ${pStyle.border}`, borderRadius: 'var(--radius-card)' }}
            >
              <p className="text-meta font-semibold uppercase tracking-wider" style={{ color: pStyle.color }}>
                Auto Priority
              </p>
              <p className="text-base font-bold" style={{ color: pStyle.color }}>
                {pStyle.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
              <Activity className="w-4 h-4" style={{ color: '#DC2626' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Vital Signs</h2>
              <p className="text-xs text-gray-400">Record all measurements. Priority is auto-calculated.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {VITAL_FIELDS.map(field => (
              <VitalCard
                key={field.key}
                field={field}
                value={vitals[field.key] as number | undefined}
                onChange={val => setVitals(v => ({ ...v, [field.key]: val }))}
              />
            ))}
          </div>

          <div className="mt-3 rounded-lg p-4 bg-white" style={{ border: '1.5px solid #E2E8F0' }}>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
              Triage Notes
            </label>
            <textarea
              rows={3}
              placeholder="Clinical observations, presenting symptoms, relevant history"
              value={vitals.triage_notes ?? ''}
              onChange={e => setVitals(v => ({ ...v, triage_notes: e.target.value || undefined }))}
              className="w-full text-sm text-gray-800 resize-none outline-none bg-transparent leading-relaxed"
              style={{ minHeight: '72px' }}
            />
          </div>
        </div>

        <div className="rounded-lg bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EFF6FF' }}>
              <UserCheck className="w-4 h-4" style={{ color: '#178A3D' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Assigned Doctor</h2>
              <p className="text-xs text-gray-400">Set by reception at registration</p>
            </div>
          </div>

          <div
            className="w-full px-4 py-3 rounded-lg text-sm font-medium bg-gray-50"
            style={{ border: '1.5px solid #E2E8F0', color: visit?.assigned_doctor_name ? '#1F2937' : '#9CA3AF' }}
          >
            {visit?.assigned_doctor_name ?? 'No doctor assigned yet'}
          </div>
        </div>


        <div className="rounded-lg bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FEF3C7' }}>
              <AlertCircle className="w-4 h-4" style={{ color: '#D97706' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Priority</h2>
              <p className="text-xs text-gray-400">Auto-set from vitals  -  override if needed</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(['routine', 'urgent', 'critical', 'immediate'] as const).map(p => {
              const s = PRIORITY_STYLE[p];
              return (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold capitalize transition-all"
                  style={{
                    background: priority === p ? s.color : s.bg,
                    color: priority === p ? 'white' : s.color,
                    border: `1.5px solid ${s.border}`,
                    transform: priority === p ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 pb-8">
          <Link
            to={`/visits/${visit.id}`}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Cancel
          </Link>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #D97706, #B45309)' }}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />
            }
            {alreadyTriaged ? 'Update Triage' : 'Complete Triage'}
          </button>
        </div>

      </div>
    </div>
  );
}
