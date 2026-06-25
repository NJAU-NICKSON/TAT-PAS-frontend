import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, Search, RefreshCw, Clock, AlertTriangle, ChevronRight,
  Loader2, ShieldOff, CheckCircle2, Package, ShieldCheck, Flag, User,
  Heart, Thermometer, Activity, Wind, Weight, Droplets, ChevronDown,
  Printer, ExternalLink,
} from 'lucide-react';
import { prescriptionsApi, UpdateStatusExtra } from '../api/prescriptions';
import { patientsApi } from '../api/patients';
import { visitsApi, Visit, VitalSigns } from '../api/visits';
import { auditsApi } from '../api/audits';
import { Prescription, Patient, AuditRecord } from '../models/types';
import { useAuth } from '../context/AuthContext';
import { printDispensingReceipt } from '../lib/printDocs';
import { withDoctorTitle, formatTimeEAT, formatDateTimeEAT, getErrorMessage } from '../lib/utils';
import { toast } from 'sonner';

type ListResult<T> = T[] | { items?: T[] };

async function printReceiptWithFollowUp(rx: Prescription): Promise<void> {
  let followUp;
  if (rx.visit_id) {
    try {
      const v = (await visitsApi.getById(rx.visit_id)).data;
      if (v.follow_up_date || v.follow_up_instructions) {
        followUp = { follow_up_date: v.follow_up_date, follow_up_instructions: v.follow_up_instructions };
      }
    } catch {}
  }
  printDispensingReceipt(rx, followUp);
}

const PRIORITY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  routine:   { bg: '#F0FDF4', color: '#166534', border: '#86EFAC' },
  urgent:    { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D' },
  critical:  { bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5' },
  stat:      { bg: '#FFF1F2', color: '#9F1239', border: '#FDA4AF' },
  immediate: { bg: '#FFF1F2', color: '#9F1239', border: '#FDA4AF' },
};

const PRIORITY_ORDER: Record<string, number> = { stat: 0, critical: 1, urgent: 2, routine: 3 };
const DISPENSE_SLA_MIN = 30;

function age(dob?: string): string {
  if (!dob) return ' - ';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return `${years}y`;
}

function fmtTime(iso?: string): string {
  if (!iso) return ' - ';
  return formatTimeEAT(iso);
}

function fmt(iso?: string): string {
  if (!iso) return ' - ';
  return formatDateTimeEAT(iso);
}

function useNow(ms = 10000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function ElapsedBadge({ since, slaMin }: { since: string; slaMin: number }) {
  const now = useNow();
  const min = Math.floor((now - new Date(since).getTime()) / 60000);
  const breached = min >= slaMin;
  const crit = min >= slaMin * 2;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
      style={{
        background: crit ? '#7F1D1D' : breached ? '#FEF2F2' : '#F0F9FF',
        color: crit ? '#FCA5A5' : breached ? '#DC2626' : '#0369A1',
        border: `1px solid ${crit ? '#991B1B' : breached ? '#FCA5A5' : '#BAE6FD'}`,
      }}>
      <Clock className="w-3 h-3" />
      {min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`}
      {breached && <AlertTriangle className="w-3 h-3" />}
    </span>
  );
}

function VitalCell({ icon, label, value, unit, warn }: {
  icon: React.ReactNode; label: string; value?: number | string; unit?: string; warn?: boolean;
}) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: warn ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${warn ? '#FCA5A5' : '#E2E8F0'}` }}>
      <span style={{ color: warn ? '#DC2626' : '#64748B' }}>{icon}</span>
      <div>
        <p className="text-micro text-gray-400 uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-bold ${warn ? 'text-red-600' : 'text-gray-800'}`}>
          {value}{unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

const SEV: Record<string, { bg: string; color: string }> = {
  low:      { bg: '#F0FDF4', color: '#166534' },
  medium:   { bg: '#FFFBEB', color: '#92400E' },
  high:     { bg: '#FEF2F2', color: '#991B1B' },
  critical: { bg: '#FFF1F2', color: '#9F1239' },
};

function SevBadge({ sev }: { sev: string }) {
  const s = SEV[sev] ?? SEV.low;
  return (
    <span className="text-micro font-bold px-1.5 py-0.5 rounded-full uppercase"
      style={{ background: s.bg, color: s.color }}>
      {sev}
    </span>
  );
}

function DispensePanel({ rx, onSuccess, onCancel }: {
  rx: Prescription; onSuccess: () => void; onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      const extra: UpdateStatusExtra = {};
      // The backend generates the receipt number automatically on dispense.
      if (comment.trim()) extra.pharmacist_comment = comment.trim();
      const updated = await prescriptionsApi.updateStatus(rx.id, 'dispensed', extra);
      const dispensed = (updated.data as typeof rx) ?? rx;
      toast.success(`Dispensed · Receipt ${dispensed.receipt_number ?? ''}`);
      // Print the dispensing receipt so the patient gets a copy.
      printReceiptWithFollowUp(dispensed);
      onSuccess();
    } catch { toast.error('Failed to dispense'); }
    finally { setBusy(false); }
  };

  return (
    <div className="border-t border-green-200 bg-green-50 p-4 space-y-3">
      <p className="text-xs font-bold text-green-800 uppercase tracking-wide">Confirm Dispense</p>

      <div className="rounded-lg border border-green-200 bg-white overflow-hidden">
        <div className="bg-green-700 px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold text-white">Dispensing Receipt</span>
          <button onClick={() => printReceiptWithFollowUp(rx)} className="flex items-center gap-1 text-xs text-white/70 hover:text-white">
            <Printer className="w-3 h-3" /> Print
          </button>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Rx #</span>
            <span className="font-mono font-semibold">{rx.rx_number ?? rx.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Patient</span>
            <span className="font-semibold">{rx.patient_name ?? rx.patient_id}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Doctor</span>
            <span className="font-semibold">{rx.doctor_name ?? rx.doctor_id}</span>
          </div>
          {rx.auditor_name && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Approved by</span>
              <span className="font-semibold text-green-800">{rx.auditor_name}</span>
            </div>
          )}
          <div className="border-t border-dashed border-gray-200 my-1" />
          {rx.medications.map((m, i) => (
            <div key={i} className="text-xs">
              <span className="font-semibold">{m.name}</span>
              <span className="text-gray-400 ml-1">{m.dose} · {m.route} · {m.frequency} · {m.duration_days}d</span>
            </div>
          ))}
          <div className="border-t border-dashed border-gray-200 my-1" />
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Date/Time</span>
            <span className="font-semibold">{fmt(new Date().toISOString())}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Receipt No.</label>
          <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 font-mono">
            RCP-{new Date().getFullYear()}-XXXX
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Pharmacist Notes (optional)</label>
          <input value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Counselling given, substitutions"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} aria-label="Close"
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={go} disabled={busy}
          className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-40">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Confirm Dispense
        </button>
      </div>
    </div>
  );
}

interface DetailData {
  patient?: Patient;
  visit?: Visit;
  flags?: AuditRecord[];
}

function DetailPanel({ rx, onDispensed }: {
  rx: Prescription; onDispensed: () => void;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<DetailData>({});
  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showDispense, setShowDispense] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setDetailError(null);
      try {
        const [patRes, flagRes] = await Promise.allSettled([
          patientsApi.getById(rx.patient_id),
          auditsApi.list({ prescription_id: rx.id, limit: 20 }),
        ]);
        const patient = patRes.status === 'fulfilled' ? patRes.value.data : undefined;
        const flags = flagRes.status === 'fulfilled'
          ? (() => {
              const auditData = flagRes.value.data as ListResult<AuditRecord>;
              return Array.isArray(auditData) ? auditData : auditData.items ?? [];
            })()
          : [];

        let visit: Visit | undefined;
        if (patient?.current_visit_id) {
          try {
            const vRes = await visitsApi.getById(patient.current_visit_id);
            visit = vRes.data;
          } catch {}
        }

        if (!cancelled) setData({ patient, visit, flags });
      } catch {
        if (!cancelled) setDetailError('Failed to load patient details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rx.id, rx.patient_id]);

  const { patient, visit, flags } = data;
  const v = visit?.vitals;

  const vitalWarn = (field: keyof VitalSigns, val?: number) => {
    if (!val) return false;
    if (field === 'oxygen_saturation') return val < 94;
    if (field === 'pulse_rate') return val > 100 || val < 50;
    if (field === 'blood_pressure_systolic') return val > 140 || val < 90;
    if (field === 'temperature_celsius') return val > 38 || val < 36;
    return false;
  };

  return (
    <div className="border-t border-gray-100">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : detailError ? (
        <div className="flex items-center gap-2 px-4 py-3 m-4 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {detailError}
        </div>
      ) : (
        <div className="p-4 space-y-4">

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Patient
              </span>
              {patient && (
                <button onClick={() => navigate(`/patients/${patient.id}`)}
                  className="flex items-center gap-1 text-xs text-green-700 hover:underline">
                  View record <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
            {patient ? (
              <div className="px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Name</span>
                  <span className="font-semibold text-gray-800">{patient.first_name} {patient.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">MRN</span>
                  <span className="font-mono font-semibold text-gray-800">{patient.mrn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Age / Gender</span>
                  <span className="font-semibold text-gray-800">{age(patient.dob)} · {patient.gender ?? ' - '}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Weight</span>
                  <span className="font-semibold text-gray-800">{patient.weight ? `${patient.weight} kg` : ' - '}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Blood Group</span>
                  <span className="font-semibold text-gray-800">{patient.blood_group ?? ' - '}</span>
                </div>
                {patient.allergies && patient.allergies.length > 0 && (
                  <div className="col-span-2 mt-1 p-2 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-micro font-bold text-red-700 uppercase tracking-wide mb-1">s  Allergies</p>
                    <div className="flex flex-wrap gap-1">
                      {patient.allergies.map((a, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">
                          {typeof a === 'string' ? a : (a.substance ?? JSON.stringify(a))}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {patient.chronic_conditions && patient.chronic_conditions.length > 0 && (
                  <div className="col-span-2 mt-1">
                    <p className="text-micro font-bold text-amber-700 uppercase tracking-wide mb-1">Chronic Conditions</p>
                    <div className="flex flex-wrap gap-1">
                      {patient.chronic_conditions.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-800 border border-amber-200">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="px-4 py-3 text-xs text-gray-400">Could not load patient details.</p>
            )}
          </div>

          {visit && (
            <div className="rounded-lg border border-green-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-200">
                <span className="text-xs font-bold text-green-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Triage &amp; Visit
                </span>
                <button onClick={() => navigate(`/visits/${visit.id}`)}
                  className="flex items-center gap-1 text-xs text-green-700 hover:underline">
                  {visit.visit_number} <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                {visit.chief_complaint && (
                  <div>
                    <p className="text-micro font-bold text-gray-400 uppercase tracking-wide">Chief Complaint</p>
                    <p className="text-sm text-gray-800 mt-0.5">{visit.chief_complaint}</p>
                  </div>
                )}
                {visit.diagnosis && (
                  <div>
                    <p className="text-micro font-bold text-gray-400 uppercase tracking-wide">Diagnosis</p>
                    <p className="text-sm text-gray-800 mt-0.5">{visit.diagnosis}</p>
                  </div>
                )}
                {v && (
                  <div>
                    <p className="text-micro font-bold text-gray-400 uppercase tracking-wide mb-2">Vital Signs</p>
                    <div className="grid grid-cols-3 gap-2">
                      {v.blood_pressure_systolic !== undefined && v.blood_pressure_diastolic !== undefined && (
                        <VitalCell icon={<Heart className="w-3.5 h-3.5" />} label="BP"
                          value={`${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}`} unit="mmHg"
                          warn={vitalWarn('blood_pressure_systolic', v.blood_pressure_systolic)} />
                      )}
                      <VitalCell icon={<Activity className="w-3.5 h-3.5" />} label="HR"
                        value={v.pulse_rate} unit="bpm"
                        warn={vitalWarn('pulse_rate', v.pulse_rate)} />
                      <VitalCell icon={<Droplets className="w-3.5 h-3.5" />} label="SpO,,"
                        value={v.oxygen_saturation} unit="%"
                        warn={vitalWarn('oxygen_saturation', v.oxygen_saturation)} />
                      <VitalCell icon={<Thermometer className="w-3.5 h-3.5" />} label="Temp"
                        value={v.temperature_celsius} unit="°C"
                        warn={vitalWarn('temperature_celsius', v.temperature_celsius)} />
                      <VitalCell icon={<Wind className="w-3.5 h-3.5" />} label="RR"
                        value={v.respiratory_rate} unit="/min" />
                      <VitalCell icon={<Weight className="w-3.5 h-3.5" />} label="Weight"
                        value={v.weight_kg} unit="kg" />
                    </div>
                    {v.triage_notes && (
                      <p className="text-xs text-gray-600 mt-2 italic">"{v.triage_notes}"</p>
                    )}
                  </div>
                )}
                {visit.assigned_doctor_name && (
                  <p className="text-xs text-gray-500">Assigned to: <span className="font-semibold text-gray-700">{withDoctorTitle(visit.assigned_doctor_name)}</span></p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5" /> Prescription
              </span>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{withDoctorTitle(rx.doctor_name) || rx.doctor_id}</span>
                <span>{fmtTime(rx.ordered_at ?? rx.created_at)}</span>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              {rx.medications.map((m, i) => (
                <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="font-bold text-gray-800 text-sm">{m.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {[
                      { label: 'Dose', val: m.dose },
                      { label: 'Route', val: m.route },
                      { label: 'Frequency', val: m.frequency },
                      { label: 'Duration', val: `${m.duration_days} days` },
                    ].map(f => (
                      <span key={f.label} className="text-xs px-2 py-0.5 rounded-lg bg-white border border-gray-200">
                        <span className="text-gray-400">{f.label}:</span>{' '}
                        <span className="font-semibold text-gray-700">{f.val}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {rx.notes && (
                <p className="text-xs text-gray-600 italic px-1">Doctor notes: "{rx.notes}"</p>
              )}
            </div>
          </div>

          {flags && flags.length > 0 && (
            <div className="rounded-lg border border-amber-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5" /> Audit Flags ({flags.length})
                </span>
              </div>
              <div className="divide-y divide-amber-100">
                {flags.map(f => (
                  <div key={f.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-800">{f.issue}</p>
                      <SevBadge sev={f.severity} />
                    </div>
                    {f.recommendation && (
                      <p className="text-xs text-gray-500 mt-0.5">' {f.recommendation}</p>
                    )}
                    {f.resolved && (
                      <p className="text-xs text-green-700 mt-0.5">✓ Resolved · {f.resolution_note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            <button onClick={() => navigate(`/prescriptions/${rx.id}`)}
              className="flex items-center gap-1.5 text-xs text-green-700 hover:underline font-medium">
              Full prescription record <ExternalLink className="w-3 h-3" />
            </button>

            <div className="flex items-center gap-2">
              {(rx.status === 'submitted' || rx.status === 'flagged') && (
                <button
                  onClick={async () => {
                    try {
                      await prescriptionsApi.approveForPharmacy(rx.id);
                      toast.success('Prescription approved  -  ready to dispense');
                      onDispensed();
                    } catch (e) {
                      toast.error(getErrorMessage(e, 'Could not approve. Check for unresolved flags.'));
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
                  style={{ background: rx.status === 'flagged' ? '#EA580C' : '#178A3D' }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve for Pharmacy
                </button>
              )}

              {rx.status === 'verified' && !showDispense && (
                <button onClick={() => setShowDispense(true)}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg bg-green-700 hover:bg-green-800 transition-colors">
                  <FlaskConical className="w-4 h-4" />
                  Dispense
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showDispense && (
        <DispensePanel
          rx={rx}
          onSuccess={() => { setShowDispense(false); onDispensed(); }}
          onCancel={() => setShowDispense(false)}
        />
      )}
    </div>
  );
}

function RxRow({ rx, accentBorder, onRefresh }: {
  rx: Prescription;
  accentBorder: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const p = PRIORITY_STYLE[rx.priority ?? 'routine'] ?? PRIORITY_STYLE.routine;
  const sinceTime = rx.verified_at ?? rx.submitted_at ?? rx.created_at;
  const now = useNow();
  const waitMin = sinceTime ? Math.floor((now - new Date(sinceTime).getTime()) / 60000) : null;
  const breached = waitMin !== null && waitMin >= DISPENSE_SLA_MIN;

  return (
    <div className="rounded-lg overflow-hidden bg-white"
      style={{ border: `1.5px solid ${open ? accentBorder : breached ? '#FCA5A5' : '#E2E8F0'}` }}>

      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors group">
        <div className="mt-1.5 w-3 h-3 rounded-full flex-shrink-0"
          style={{ background: p.color, boxShadow: `0 0 0 3px ${p.border}` }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm text-gray-900 font-mono">
              {rx.rx_number ?? `RX-${rx.id.slice(0, 8).toUpperCase()}`}
            </span>
            <span className="text-micro font-bold px-1.5 py-0.5 rounded-full border"
              style={{ background: p.bg, color: p.color, borderColor: p.border }}>
              {(rx.priority ?? 'routine').toUpperCase()}
            </span>
            {breached && (
              <span className="text-micro font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" /> SLA BREACH
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{rx.patient_name ?? rx.patient_id}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {rx.medications.map(m => `${m.name} ${m.dose}`).join(' · ')}
          </p>
          {rx.auditor_name && (
            <p className="text-xs text-green-700 mt-1">✓ Approved by {rx.auditor_name}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {sinceTime && <ElapsedBadge since={sinceTime} slaMin={DISPENSE_SLA_MIN} />}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <DetailPanel rx={rx} onDispensed={() => { setOpen(false); onRefresh(); }} />
      )}
    </div>
  );
}

function DispensedRow({ rx }: { rx: Prescription }) {
  const navigate = useNavigate();
  return (
    <div
      className="w-full rounded-lg p-4 flex items-center gap-3 opacity-80 hover:opacity-100 transition-all hover:shadow-sm"
      style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
      <CheckCircle2 className="w-4 h-4 text-green-700 flex-shrink-0" />
      <button onClick={() => navigate(`/prescriptions/${rx.id}`)} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-gray-700 font-mono truncate">
          {rx.rx_number ?? `RX-${rx.id.slice(0, 8).toUpperCase()}`}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {rx.patient_name ?? rx.patient_id} · {rx.medications.map(m => m.name).join(', ')}
        </p>
        <p className="text-micro text-gray-400 mt-0.5">
          {rx.receipt_number ? <span className="font-mono">{rx.receipt_number}</span> : 'No receipt no.'}
          {rx.dispensed_at ? ` · ${fmtTime(rx.dispensed_at)}` : ''}
          {rx.status === 'administered' ? ' · administered' : ''}
        </p>
      </button>
      <button
        onClick={() => printDispensingReceipt(rx)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 border border-green-200 rounded-lg hover:bg-green-50 flex-shrink-0"
        title="Reprint dispensing receipt">
        <Printer className="w-3.5 h-3.5" /> Reprint
      </button>
    </div>
  );
}

function Section({ icon, title, count, iconColor, badgeBg, badgeColor, children, emptyText, lastRefresh }: {
  icon: React.ReactNode; title: string; count: number;
  iconColor: string; badgeBg: string; badgeColor: string;
  children: React.ReactNode; emptyText: string; lastRefresh?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <span style={{ color: iconColor }}>{icon}</span>
          {title}
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: badgeBg, color: badgeColor }}>{count}</span>
        </h2>
        {lastRefresh !== undefined && (
          <p className="text-micro text-gray-400 tabular-nums">
            {new Date(lastRefresh).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>
      {count === 0 ? (
        <div className="rounded-lg bg-white border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-400">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

export default function PharmacyQueuePage() {
  const { user } = useAuth();
  const [verified, setVerified]   = useState<Prescription[]>([]);
  const [flagged, setFlagged]     = useState<Prescription[]>([]);
  const [submitted, setSubmitted] = useState<Prescription[]>([]);
  const [dispensed, setDispensed] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const role = user?.role ?? '';
  const allowed = role === 'pharmacist' || role === 'admin';

  const sort = (list: Prescription[]) =>
    [...list].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority ?? 'routine'] ?? 3;
      const pb = PRIORITY_ORDER[b.priority ?? 'routine'] ?? 3;
      if (pa !== pb) return pa - pb;
      const ta = a.verified_at ?? a.submitted_at ?? a.created_at;
      const tb = b.verified_at ?? b.submitted_at ?? b.created_at;
      return new Date(ta).getTime() - new Date(tb).getTime();
    });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [vR, fR, sR, dR] = await Promise.allSettled([
        prescriptionsApi.list({ status: 'verified',  limit: 100 }),
        prescriptionsApi.list({ status: 'flagged',   limit: 100 }),
        prescriptionsApi.list({ status: 'submitted', limit: 100 }),
        prescriptionsApi.dispensedByMe({ limit: 50 }),
      ]);
      if (vR.status === 'fulfilled') setVerified(sort(vR.value.data));
      if (fR.status === 'fulfilled') setFlagged(sort(fR.value.data));
      if (sR.status === 'fulfilled') setSubmitted(sort(sR.value.data));
      if (dR.status === 'fulfilled') setDispensed(dR.value.data);
    } finally {
      setIsLoading(false);
      setLastRefresh(Date.now());
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1F5F9' }}>
        <div className="text-center p-8">
          <ShieldOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Access Restricted</h2>
          <p className="text-sm text-gray-500">
            Pharmacy queue is available to pharmacists and admins only.
            <br />Your role: <span className="font-mono font-bold text-gray-700">{role}</span>
          </p>
        </div>
      </div>
    );
  }

  const fil = (list: Prescription[]) =>
    search.trim()
      ? list.filter(rx =>
          (rx.patient_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (rx.rx_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
          rx.medications.some(m => m.name.toLowerCase().includes(search.toLowerCase()))
        )
      : list;

  const fVerified  = fil(verified);
  const fFlagged   = fil(flagged);
  const fSubmitted = fil(submitted);

  const totalPending = verified.length + flagged.length + submitted.length;
  const slaBreached  = verified.filter(rx => {
    const t = rx.verified_at ?? rx.submitted_at;
    return t && (Date.now() - new Date(t).getTime()) / 60000 >= DISPENSE_SLA_MIN;
  }).length;
  const statCount = [...verified, ...flagged, ...submitted].filter(rx => rx.priority === 'stat').length;

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      <div className="flex items-center justify-between px-6 h-12" style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <h1 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Pharmacy Queue</h1>
        </div>
        <button onClick={load} disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-button)', color: 'var(--text-secondary)' }}>
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
        {[
          { label: 'In Pipeline', value: totalPending,    danger: false },
          { label: 'Ready',       value: verified.length, danger: false },
          { label: 'SLA Breach',  value: slaBreached,     danger: slaBreached > 0 },
          { label: 'STAT',        value: statCount,       danger: statCount > 0 },
        ].map(s => (
          <div key={s.label} className="px-4 py-3"
            style={{ background: s.danger ? 'var(--status-critical-bg)' : 'var(--bg-card)', border: `1px solid ${s.danger ? 'var(--status-critical-border)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-card)' }}>
            <p className="text-label" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="font-bold tabular-nums leading-none mt-1.5" style={{ fontSize: '1.75rem', color: s.danger ? 'var(--status-critical-text)' : 'var(--text-primary)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="px-6 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by patient, Rx number, or drug name"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-green-700" />
        </div>
      ) : (
        <div className="px-6 pb-8 space-y-6">
          <Section icon={<Package className="w-4 h-4" />} title="Ready to Dispense"
            count={fVerified.length} iconColor="#178A3D" badgeBg="#C8EED6" badgeColor="#0F6E2F"
            emptyText="No approved prescriptions waiting." lastRefresh={lastRefresh}>
            {fVerified.map(rx => (
              <RxRow key={rx.id} rx={rx} accentBorder="#A7E4BD" onRefresh={load} />
            ))}
          </Section>

          {fFlagged.length > 0 && (
            <Section icon={<Flag className="w-4 h-4" />} title="Flagged  -  Awaiting Audit Resolution"
              count={fFlagged.length} iconColor="#DC2626" badgeBg="#FEE2E2" badgeColor="#991B1B"
              emptyText="No flagged prescriptions.">
              {fFlagged.map(rx => (
                <RxRow key={rx.id} rx={rx} accentBorder="#FCA5A5" onRefresh={load} />
              ))}
            </Section>
          )}

          {fSubmitted.length > 0 && (
            <Section icon={<ShieldCheck className="w-4 h-4" />} title="Submitted  -  Awaiting Audit"
              count={fSubmitted.length} iconColor="#B45309" badgeBg="#FEF3C7" badgeColor="#92400E"
              emptyText="No prescriptions awaiting audit.">
              {fSubmitted.map(rx => (
                <RxRow key={rx.id} rx={rx} accentBorder="#FCD34D" onRefresh={load} />
              ))}
            </Section>
          )}

          {dispensed.length > 0 && (
            <Section icon={<CheckCircle2 className="w-4 h-4" />} title="Dispensed by Me"
              count={dispensed.length} iconColor="#94A3B8" badgeBg="#F1F5F9" badgeColor="#64748B"
              emptyText="You have not dispensed any prescriptions yet.">
              {fil(dispensed).slice(0, 20).map(rx => (
                <DispensedRow key={rx.id} rx={rx} />
              ))}
            </Section>
          )}

          {totalPending === 0 && dispensed.length === 0 && (
            <div className="rounded-lg bg-white border border-gray-200 p-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">All clear</p>
              <p className="text-xs text-gray-400 mt-1">No prescriptions in the pipeline.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
