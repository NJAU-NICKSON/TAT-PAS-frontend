import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Loader2, ChevronLeft, UserCheck, Stethoscope,
  BedDouble, Receipt, LogOut, Clock, AlertTriangle,
  User, FileText, Activity, CheckCircle2,
  Pill, Heart, Thermometer, Wind, RefreshCw,
  Shield, TrendingUp, Zap, ArrowRight,
} from 'lucide-react';
import { visitsApi, Visit, JourneySummary } from '../api/visits';
import { prescriptionsApi } from '../api/prescriptions';
import { billingApi } from '../api/billing';
import { Prescription, Bill } from '../models/types';
import { useAuth } from '../context/AuthContext';

function fmt(iso?: string): string {
  if (!iso) return 'â€”';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtTime(iso?: string): string {
  if (!iso) return 'â€”';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso?: string): string {
  if (!iso) return 'â€”';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function elapsedMin(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
}
function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const FLAG_META: Record<string, { label: string; desc: string; color: string; bg: string; border: string; severity: string }> = {
  high_dose:         { label: 'High Dose',           desc: 'Prescribed dose exceeds safety threshold',              color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', severity: 'HIGH'     },
  extended_duration: { label: 'Extended Duration',   desc: 'Prescription duration exceeds 30 days',                color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', severity: 'MEDIUM'   },
  allergy_match:     { label: 'Allergy Match',       desc: 'Drug matches a recorded patient allergy',              color: '#991B1B', bg: '#FFF1F2', border: '#FECACA', severity: 'CRITICAL' },
  drug_interaction:  { label: 'Drug Interaction',    desc: 'Potential interaction detected between prescribed drugs',color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', severity: 'HIGH'     },
  controlled_sub:    { label: 'Controlled Substance',desc: 'Prescription contains a controlled or scheduled drug',  color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF', severity: 'MEDIUM'   },
  sla_breach:        { label: 'SLA Breach',          desc: 'Pharmacy turnaround time exceeded the SLA target',     color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', severity: 'HIGH'     },
  duplicate_rx:      { label: 'Duplicate Rx',        desc: 'A similar active prescription already exists',         color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', severity: 'MEDIUM'   },
  manual_flag:       { label: 'Manual Flag',         desc: 'Manually flagged by an auditor for review',            color: '#475569', bg: '#F8FAFC', border: '#E2E8F0', severity: 'INFO'     },
};

const SEVERITY_COLOR: Record<string, string> = { CRITICAL: '#991B1B', HIGH: '#DC2626', MEDIUM: '#D97706', INFO: '#475569' };
const SEVERITY_BG:    Record<string, string> = { CRITICAL: '#FEE2E2', HIGH: '#FEE2E2', MEDIUM: '#FEF3C7', INFO: '#F1F5F9'  };

const ROLE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  receptionist: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Receptionist' },
  nurse:        { bg: '#FFF7ED', color: '#9A3412', label: 'Nurse'        },
  doctor:       { bg: '#FAF5FF', color: '#6B21A8', label: 'Doctor'       },
  auditor:      { bg: '#F0FDF4', color: '#166534', label: 'Auditor'      },
  pharmacist:   { bg: '#F0F9FF', color: '#075985', label: 'Pharmacist'   },
  system:       { bg: '#F8FAFC', color: '#475569', label: 'System'       },
};
function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLES[role] ?? ROLE_STYLES.system;
  return (
    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function TATStageCard({
  num, name, tatMin, targetMin, isActive, isPending,
}: {
  num: number; name: string;
  tatMin?: number; targetMin: number;
  isActive?: boolean; isPending?: boolean;
}) {
  const hasData  = tatMin !== undefined;
  const pct      = hasData ? Math.min((tatMin! / targetMin) * 100, 150) : 0;
  const breached = hasData && tatMin! > targetMin;
  const barColor = !hasData ? '#E2E8F0'
    : breached     ? '#DC2626'
    : pct > 80     ? '#D97706'
    :                '#059669';

  return (
    <div
      className="flex-1 min-w-0 rounded-xl p-3"
      style={{
        background: isActive ? 'rgba(37,99,235,0.08)' : breached ? '#FEF2F2' : '#F8FAFC',
        border: `1.5px solid ${isActive ? '#93C5FD' : breached ? '#FCA5A5' : '#E2E8F0'}`,
        minWidth: '120px',
      }}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Stage {num}</p>
          <p className="text-xs font-semibold mt-0.5 leading-tight" style={{ color: '#1E293B' }}>{name}</p>
        </div>
        {hasData ? (
          <span
            className="text-xs font-extrabold tabular-nums px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: breached ? '#FEE2E2' : '#DCFCE7', color: breached ? '#DC2626' : '#059669' }}
          >
            {fmtDuration(tatMin!)}
          </span>
        ) : isActive ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
            Active
          </span>
        ) : (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#F1F5F9', color: '#94A3B8' }}>
            {isPending ? 'Pending' : 'â€”'}
          </span>
        )}
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: hasData ? `${Math.min(pct, 100)}%` : '0%', background: barColor }}
        />
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: '#94A3B8' }}>Target: {fmtDuration(targetMin)}</span>
        {breached && hasData && (
          <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: '#DC2626' }}>
            <AlertTriangle className="w-2.5 h-2.5" />
            +{fmtDuration(tatMin! - targetMin)} over
          </span>
        )}
        {!breached && hasData && (
          <span className="text-[10px] font-semibold" style={{ color: '#059669' }}>âœ“ On time</span>
        )}
      </div>
    </div>
  );
}

function TATSummaryStrip({ journey, visit }: { journey: JourneySummary | null; visit: Visit }) {
  const stages = journey?.stages ?? [];
  const totalTarget = journey?.target_total_min ?? 130;
  const totalActual = journey?.total_tat_min
    ?? elapsedMin(visit.registered_at, visit.discharged_at ?? undefined)
    ?? undefined;
  const totalBreached = totalActual !== undefined && totalActual > totalTarget;

  // Determine which stage is active (no tat_min but previous has data, or fallback from timestamps)
  const activeStageNum = stages.length > 0
    ? stages.find(s => s.tat_min === undefined && (s.stage === 1 || stages[s.stage - 2]?.tat_min !== undefined))?.stage
    : undefined;

  return (
    <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0' }}>
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#EFF6FF' }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>
              Turnaround Time (TAT) â€” Stage-by-Stage Analysis
            </p>
          </div>
          {totalActual !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#94A3B8' }}>Total:</span>
              <span
                className="text-sm font-extrabold tabular-nums px-2 py-0.5 rounded-full"
                style={{ background: totalBreached ? '#FEE2E2' : '#DCFCE7', color: totalBreached ? '#DC2626' : '#059669' }}
              >
                {fmtDuration(totalActual)}
              </span>
              <span className="text-xs" style={{ color: '#94A3B8' }}>/ {fmtDuration(totalTarget)} target</span>
              {totalBreached && (
                <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#DC2626' }}>
                  <AlertTriangle className="w-3.5 h-3.5" /> EXCEEDED
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {stages.length > 0 ? (
            stages.map(s => (
              <TATStageCard
                key={s.stage}
                num={s.stage}
                name={s.name}
                tatMin={s.tat_min}
                targetMin={s.target_min}
                isActive={s.stage === activeStageNum}
                isPending={s.stage > (activeStageNum ?? 99)}
              />
            ))
          ) : (
            // Fallback from visit timestamps when journey API has no stages
            <>
              <TATStageCard num={1} name="Registration"          tatMin={elapsedMin(visit.registered_at, visit.triaged_at) ?? undefined}                         targetMin={10}  isActive={!visit.triaged_at} />
              <TATStageCard num={2} name="Triage"                tatMin={elapsedMin(visit.triaged_at, visit.consultation_started_at) ?? undefined}                targetMin={15}  isActive={!!visit.triaged_at && !visit.consultation_started_at} />
              <TATStageCard num={3} name="Consultation"          tatMin={elapsedMin(visit.consultation_started_at, visit.consultation_ended_at) ?? undefined}     targetMin={30}  isActive={!!visit.consultation_started_at && !visit.consultation_ended_at} />
              <TATStageCard num={4} name="Prescription Audit"    tatMin={undefined}                                                                               targetMin={30}  isPending={!visit.consultation_ended_at} isActive={!!visit.consultation_ended_at && !visit.billing_completed_at} />
              <TATStageCard num={5} name="Pharmacy Dispensing"   tatMin={undefined}                                                                               targetMin={20}  isPending={!visit.consultation_ended_at} />
              <TATStageCard num={6} name="Drug Administration"   tatMin={undefined}                                                                               targetMin={15}  isPending={!visit.consultation_ended_at} />
              <TATStageCard num={7} name="Billing"               tatMin={elapsedMin(visit.billing_completed_at, visit.discharged_at) ?? undefined}               targetMin={15}  isActive={!!visit.billing_completed_at && !visit.discharged_at} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoGrid({ items }: { items: { label: string; value?: string | React.ReactNode }[] }) {
  const rows = items.filter(i => i.value);
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
      {rows.map(({ label, value }) => (
        <div key={label}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#94A3B8' }}>{label}</p>
          <p className="text-xs font-semibold text-gray-800">{value}</p>
        </div>
      ))}
    </div>
  );
}

function VitalsGrid({ vitals }: { vitals: NonNullable<Visit['vitals']> }) {
  const items = [
    { icon: Heart,       label: 'BP',     value: vitals.blood_pressure_systolic ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}` : null, unit: 'mmHg', color: '#DC2626' },
    { icon: Activity,    label: 'Pulse',  value: vitals.pulse_rate?.toString()          ?? null, unit: 'bpm',  color: '#D97706' },
    { icon: Thermometer, label: 'Temp',   value: vitals.temperature_celsius?.toFixed(1) ?? null, unit: 'Â°C',   color: '#2563EB' },
    { icon: Wind,        label: 'SpOâ‚‚',   value: vitals.oxygen_saturation?.toString()   ?? null, unit: '%',    color: '#7C3AED' },
    { icon: Activity,    label: 'RR',     value: vitals.respiratory_rate?.toString()    ?? null, unit: '/min', color: '#059669' },
    { icon: User,        label: 'Weight', value: vitals.weight_kg?.toString()           ?? null, unit: 'kg',   color: '#475569' },
  ].filter(i => i.value);

  if (!items.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ icon: Icon, label, value, unit, color }) => (
        <div key={label} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
          <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
          <div>
            <p className="text-[10px] text-gray-400">{label}</p>
            <p className="text-xs font-bold text-gray-800">{value} <span className="font-normal text-gray-500 text-[10px]">{unit}</span></p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface StopProps {
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  title: string;
  subtitle?: string;
  time?: string;
  duration?: number | null;
  targetMin?: number;
  actor?: string;
  actorRole?: string;
  isComplete: boolean;
  isPending?: boolean;
  isActive?: boolean;
  children?: React.ReactNode;
  isLast?: boolean;
}

function JourneyStop({
  icon, accentColor, accentBg, title, subtitle, time,
  duration, targetMin, actor, actorRole, isComplete, isPending, isActive, children, isLast,
}: StopProps) {
  const breached = duration != null && targetMin !== undefined && duration > targetMin;

  return (
    <div className="flex gap-5">

      <div className="flex flex-col items-center flex-shrink-0" style={{ width: '48px' }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border-2"
          style={{
            background:   isComplete || isActive ? accentBg : '#F8FAFC',
            borderColor:  isComplete || isActive ? accentColor : '#E2E8F0',
            opacity:      isPending ? 0.45 : 1,
            boxShadow:    isActive ? `0 0 0 4px ${accentColor}20` : 'none',
          }}
        >
          {icon}
        </div>
        {isActive && <div className="w-2 h-2 rounded-full mt-1 animate-pulse" style={{ background: accentColor }} />}
        {!isLast && (
          <div
            className="w-0.5 flex-1 mt-1"
            style={{
              background: isComplete ? accentColor : '#E2E8F0',
              minHeight: '32px',
              opacity: isComplete ? 0.25 : 0.5,
            }}
          />
        )}
      </div>

      <div className="flex-1 pb-8">
        <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold" style={{ color: isPending ? '#94A3B8' : '#0F172A' }}>
              {title}
            </h3>
            {subtitle && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {isActive && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full animate-pulse" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                â— In Progress
              </span>
            )}
            {duration != null && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: breached ? '#FEF2F2' : '#F0FDF4', color: breached ? '#DC2626' : '#059669' }}
              >
                <Clock className="w-3 h-3" />
                {fmtDuration(duration)}
                {breached && targetMin != null ? ` (+${fmtDuration(duration - targetMin)} over)` : ''}
              </span>
            )}
            {time && (
              <div className="text-right">
                <p className="text-xs font-semibold tabular-nums" style={{ color: '#475569' }}>{fmtTime(time)}</p>
                <p className="text-[10px]" style={{ color: '#94A3B8' }}>{fmtDate(time)}</p>
              </div>
            )}
            {isPending && !isActive && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#F1F5F9', color: '#94A3B8' }}>Pending</span>
            )}
          </div>
        </div>

        {actor && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#F1F5F9' }}>
              <User className="w-3 h-3 text-gray-400" />
            </div>
            <span className="text-xs font-semibold text-gray-700">{actor}</span>
            {actorRole && <RoleBadge role={actorRole} />}
          </div>
        )}

        {children && (
          <div
            className="rounded-xl border p-4"
            style={{
              background:  isComplete ? accentBg : '#F8FAFC',
              borderColor: isComplete ? accentColor : '#E2E8F0',
              opacity:     isPending ? 0.6 : 1,
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function PrescriptionAuditCard({ rx }: { rx: Prescription }) {
  const steps = [
    { key: 'ordered',      label: 'Ordered',      time: rx.ordered_at ?? rx.created_at, actor: rx.doctor_name,          role: 'doctor',     done: true },
    { key: 'submitted',    label: 'Submitted',     time: rx.submitted_at,               actor: rx.doctor_name,          role: 'doctor',     done: !!rx.submitted_at },
    { key: 'audited',      label: 'Audited',       time: rx.auditor_approved_at ?? rx.verified_at, actor: rx.auditor_name, role: 'auditor', done: !!(rx.auditor_approved_at || rx.verified_at) },
    { key: 'dispensed',    label: 'Dispensed',     time: rx.dispensed_at,               actor: rx.dispensed_by_name,    role: 'pharmacist', done: !!rx.dispensed_at },
    { key: 'administered', label: 'Administered',  time: rx.administered_at,            actor: rx.administered_by_name, role: 'nurse',      done: !!rx.administered_at },
  ];

  const STEP_COLOR: Record<string, string> = {
    doctor: '#7C3AED', auditor: '#059669', pharmacist: '#0284C7', nurse: '#9A3412',
  };

  const flags        = rx.flags ?? [];
  const slaBreached  = rx.sla_breached;
  const tatPharmacy  = rx.tat_pharmacy_min;
  const slaThreshold = rx.sla_threshold_min;
  const slaPct       = (tatPharmacy && slaThreshold) ? Math.min((tatPharmacy / slaThreshold) * 100, 200) : 0;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1.5px solid ${slaBreached ? '#FCA5A5' : '#E2E8F0'}` }}
    >

      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: slaBreached ? '#7F1D1D' : '#1E293B' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Pill className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
          <span className="text-xs font-bold text-white font-mono">
            {rx.rx_number ?? `RX-${rx.id.slice(0, 8).toUpperCase()}`}
          </span>
          {rx.priority && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              {rx.priority.toUpperCase()}
            </span>
          )}
          {flags.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#DC2626', color: 'white' }}>
              <AlertTriangle className="w-2.5 h-2.5" />
              {flags.length} FLAG{flags.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {slaBreached ? (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: '#DC2626', color: 'white' }}>
              âš  SLA BREACHED
            </span>
          ) : tatPharmacy !== undefined && slaThreshold ? (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: '#059669', color: 'white' }}>
              âœ“ SLA COMPLIANT
            </span>
          ) : null}
          <Link to={`/prescriptions/${rx.id}`} className="text-[10px] font-semibold text-blue-300 hover:text-white transition-colors">
            Full detail â†’
          </Link>
        </div>
      </div>

      <div className="px-4 py-2 border-b" style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
        <p className="text-xs text-gray-600 leading-relaxed">
          {rx.medications.map(m => `${m.name} ${m.dose} Â· ${m.route} Â· ${m.frequency}`).join('  Â·  ')}
        </p>
      </div>

      <div className="px-4 pt-3 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: '#64748B' }}>
          PAS Audit Pipeline
        </p>
        <div className="flex items-start">
          {steps.map((step, i) => {
            const color       = STEP_COLOR[step.role] ?? '#94A3B8';
            const isAuditStep = step.key === 'audited';
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1 min-w-0 text-center">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 mb-1"
                    style={{ background: step.done ? color : '#F1F5F9', borderColor: step.done ? color : '#E2E8F0' }}
                  >
                    {isAuditStep && step.done
                      ? <Shield className="w-3.5 h-3.5 text-white" />
                      : step.done
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        : <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    }
                  </div>
                  <p className="text-[10px] font-bold" style={{ color: step.done ? '#1E293B' : '#94A3B8' }}>{step.label}</p>
                  {step.time && step.done && (
                    <p className="text-[10px] tabular-nums" style={{ color: '#94A3B8' }}>{fmtTime(step.time)}</p>
                  )}
                  {step.actor && step.done && (
                    <p className="text-[10px] truncate max-w-full px-1 font-semibold" style={{ color }}>{step.actor}</p>
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="h-0.5 flex-shrink-0 mb-7"
                    style={{ width: '14px', background: (step.done && steps[i + 1].done) ? color : '#E2E8F0' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {flags.length > 0 && (
        <div className="px-4 py-3 border-t" style={{ borderColor: '#E2E8F0', background: '#FFF7F7' }}>
          <div className="flex items-center gap-2 mb-2.5">
            <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#DC2626' }} />
            <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: '#DC2626' }}>
              PAS â€” Audit Flags Raised by System
            </p>
          </div>
          <div className="space-y-2">
            {flags.map((code, i) => {
              const m = FLAG_META[code] ?? FLAG_META.manual_flag;
              return (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg"
                  style={{ background: m.bg, border: `1px solid ${m.border}` }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: m.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold" style={{ color: m.color }}>{m.label}</span>
                      <span
                        className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full"
                        style={{ background: SEVERITY_BG[m.severity], color: SEVERITY_COLOR[m.severity] }}
                      >
                        {m.severity}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{m.desc}</p>
                  </div>
                  {rx.auditor_name && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px]" style={{ color: '#94A3B8' }}>Reviewed</p>
                      <p className="text-[10px] font-semibold" style={{ color: '#059669' }}>{rx.auditor_name}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {rx.return_reason && (
            <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#92400E' }}>
                Returned to Doctor
              </p>
              <p className="text-xs" style={{ color: '#78350F' }}>{rx.return_reason}</p>
            </div>
          )}
        </div>
      )}

      {(tatPharmacy !== undefined || rx.tat_order_to_submit_min !== undefined) && (
        <div className="px-4 py-3 border-t" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
              <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: '#64748B' }}>
                TAT Breakdown
              </p>
            </div>
            {slaThreshold && (
              <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                Pharmacy SLA target: {fmtDuration(slaThreshold)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
            {([
              { label: 'Order â†’ Submitted',     val: rx.tat_order_to_submit_min,    target: undefined,     bold: false },
              { label: 'Submitted â†’ Audited',   val: rx.tat_submit_to_verify_min,   target: undefined,     bold: false },
              { label: 'Flag Hold Time',         val: rx.tat_flag_hold_min,          target: undefined,     bold: false, warn: true },
              { label: 'Audited â†’ Dispensed',   val: rx.tat_verify_to_dispense_min, target: undefined,     bold: false },
              { label: 'Pharmacy Total (TAT)',  val: rx.tat_pharmacy_min,           target: slaThreshold,  bold: true  },
              { label: 'Dispensed â†’ Given',     val: rx.tat_dispense_to_admin_min,  target: undefined,     bold: false },
            ] as { label: string; val?: number; target?: number; bold?: boolean; warn?: boolean }[])
              .filter(r => r.val !== undefined)
              .map(({ label, val, target, bold, warn }) => {
                const over = target !== undefined && val! > target;
                return (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: '#94A3B8', fontWeight: bold ? 700 : 400 }}>
                      {label}
                    </span>
                    <span
                      className="text-[10px] font-bold tabular-nums"
                      style={{ color: over ? '#DC2626' : warn && val! > 0 ? '#D97706' : bold ? '#1E293B' : '#475569' }}
                    >
                      {fmtDuration(val!)}
                      {over ? ' âš ' : ''}
                    </span>
                  </div>
                );
              })}
          </div>

          {tatPharmacy !== undefined && slaThreshold && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold" style={{ color: '#475569' }}>
                  Pharmacy SLA: {fmtDuration(tatPharmacy)} / {fmtDuration(slaThreshold)}
                </span>
                {slaBreached ? (
                  <span className="text-[10px] font-bold" style={{ color: '#DC2626' }}>
                    +{fmtDuration(rx.sla_breach_duration_min ?? 0)} over target
                  </span>
                ) : (
                  <span className="text-[10px] font-bold" style={{ color: '#059669' }}>âœ“ Within SLA</span>
                )}
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(slaPct, 100)}%`,
                    background: slaBreached ? '#DC2626' : slaPct > 80 ? '#D97706' : '#059669',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PatientJourneyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [visit,         setVisit]         = useState<Visit | null>(null);
  const [journey,       setJourney]       = useState<JourneySummary | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [bills,         setBills]         = useState<Bill[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [vRes, jRes, bRes] = await Promise.allSettled([
        visitsApi.getById(id),
        visitsApi.journey(id),
        billingApi.getBillsByVisit(id),
      ]);

      if (vRes.status === 'rejected') {
        setLoadError('Failed to load visit. Please try again.');
        return;
      }
      const visitData = vRes.status === 'fulfilled' ? vRes.value.data : null;
      if (visitData) setVisit(visitData);
      if (jRes.status === 'fulfilled') setJourney(jRes.value.data);
      if (bRes.status === 'fulfilled') setBills(bRes.value);

      // Load prescriptions and filter to this visit
      if (visitData) {
        try {
          const pRes = await prescriptionsApi.list({ patient_id: visitData.patient_id, limit: 100 });
          const all  = Array.isArray(pRes.data) ? pRes.data : (pRes.data as any).items ?? [];
          // Prefer visit.prescription_ids if available; otherwise show all for the patient
          const rxIds = visitData.prescription_ids ?? [];
          const filtered = rxIds.length > 0
            ? (all as Prescription[]).filter(p => rxIds.includes(p.id))
            : (all as Prescription[]);
          setPrescriptions(filtered);
        } catch { /* silently fail â€” prescriptions are non-critical */ }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1F5F9' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2563EB' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>Loading patient journeyâ€¦</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1F5F9' }}>
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertTriangle className="w-10 h-10" style={{ color: '#DC2626' }} />
          <p className="text-sm font-medium" style={{ color: '#1E293B' }}>{loadError}</p>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#2563EB' }}
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!visit) {
    return <div className="p-8 text-center" style={{ color: '#64748B' }}>Visit not found.</div>;
  }

  const totalMin      = elapsedMin(visit.registered_at, visit.discharged_at ?? new Date().toISOString());
  const isComplete    = !!visit.discharged_at;
  const isCancelled   = visit.status === 'cancelled';
  const totalTarget   = journey?.target_total_min ?? 130;
  const totalBreached = totalMin !== null && totalMin > totalTarget;

  const STATUS_LABEL: Record<string, string> = {
    registered: 'Registered', triaged: 'Triaged', waiting_for_doctor: 'Waiting for Doctor',
    in_consultation: 'In Consultation', awaiting_results: 'Awaiting Results',
    treatment_in_progress: 'Treatment in Progress', admitted: 'Admitted', in_ward: 'In Ward',
    ready_for_discharge: 'Ready for Discharge', discharged: 'Discharged', cancelled: 'Cancelled',
  };

  const PRIORITY_COLORS: Record<string, string> = {
    routine: '#059669', urgent: '#D97706', critical: '#DC2626', immediate: '#DC2626',
  };

  // Which stop is the patient currently at?
  const activeStop =
    !visit.triaged_at && !visit.consultation_started_at  ? 'triage'       :
    !!visit.triaged_at && !visit.consultation_started_at ? 'waiting'       :
    !!visit.consultation_started_at && !visit.consultation_ended_at ? 'consultation' :
    prescriptions.some(p => ['submitted', 'flagged', 'verified', 'dispensed'].includes(p.status)) ? 'prescription' :
    visit.admitted_at && !visit.discharged_at ? 'ward'   :
    !visit.billing_completed_at          ? 'billing'      :
    !visit.discharged_at                 ? 'discharge'    : 'done';

  // PAS summary stats
  const totalFlags  = prescriptions.reduce((n, p) => n + (p.flags?.length ?? 0), 0);
  const slaBreaches = prescriptions.filter(p => p.sla_breached).length;
  const auditedRx   = prescriptions.filter(p => !!(p.auditor_name || p.verified_at)).length;

  // Journey stage targets mapped by stage number
  const stageTargets = (journey?.stages ?? []).reduce((acc, s) => {
    acc[s.stage] = s.target_min;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 60%, #1D4ED8 100%)' }}>
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            to={`/visits/${visit.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 mb-4 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Visit
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-white">Patient Journey</h1>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: isCancelled ? '#FEF2F2' : isComplete ? '#F0FDF4' : '#EFF6FF',
                    color:      isCancelled ? '#DC2626' : isComplete ? '#059669' : '#2563EB',
                  }}
                >
                  {STATUS_LABEL[visit.status] ?? visit.status}
                </span>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: `${PRIORITY_COLORS[visit.priority] ?? '#059669'}20`,
                    color:       PRIORITY_COLORS[visit.priority] ?? '#059669',
                    border:     `1px solid ${PRIORITY_COLORS[visit.priority] ?? '#059669'}40`,
                  }}
                >
                  {visit.priority.toUpperCase()}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {visit.patient_name ?? visit.patient_id}
                </span>
                {' Â· '}Visit #{visit.visit_number}
                {' Â· '}{visit.visit_type.replace(/_/g, ' ').toUpperCase()}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {totalMin !== null && (
                <div className="text-right">
                  <p className={`text-3xl font-extrabold tabular-nums ${totalBreached ? 'text-red-300' : 'text-blue-300'}`}>
                    {fmtDuration(totalMin)}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {isComplete ? 'Total visit duration' : 'Time in facility'}
                  </p>
                  <p className="text-[10px]" style={{ color: totalBreached ? '#FCA5A5' : 'rgba(255,255,255,0.4)' }}>
                    Target: {fmtDuration(totalTarget)} {totalBreached ? 'âš  EXCEEDED' : 'âœ“ On track'}
                  </p>
                </div>
              )}
              <button
                onClick={load}
                className="p-2.5 rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-6 mt-5 border-t border-white/10 overflow-x-auto -mx-6 px-6 pt-3">
            {[
              { label: 'Registered By', name: visit.registered_by_name,    time: visit.registered_at,          color: '#93C5FD' },
              { label: 'Triage Nurse',  name: visit.triage_nurse_name,     time: visit.triaged_at,             color: '#FCA5A5' },
              { label: 'Doctor',        name: visit.assigned_doctor_name,  time: visit.consultation_started_at, color: '#C4B5FD' },
              { label: 'Consult Nurse', name: visit.consultation_nurse_name, time: visit.consultation_started_at, color: '#FCA5A5' },
            ].filter(a => a.name).map((actor, i) => (
              <div key={i} className="flex-shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{actor.label}</p>
                <p className="text-xs font-semibold text-white">{actor.name}</p>
                {actor.time && <p className="text-[10px]" style={{ color: actor.color }}>{fmt(actor.time)}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <TATSummaryStrip journey={journey} visit={visit} />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">

          <div className="col-span-8">

            <JourneyStop
              icon={<UserCheck className="w-5 h-5" style={{ color: '#2563EB' }} />}
              accentColor="#2563EB" accentBg="rgba(37,99,235,0.06)"
              title="Arrival & Registration"
              subtitle={`Patient checked in Â· Visit #${visit.visit_number}`}
              time={visit.registered_at}
              actor={visit.registered_by_name}
              actorRole={visit.registered_by_name ? 'receptionist' : undefined}
              isComplete={true}
            >
              <InfoGrid items={[
                { label: 'Visit Type',     value: visit.visit_type.replace(/_/g, ' ') },
                { label: 'Priority',       value: visit.priority },
                { label: 'Department',     value: visit.department_id },
                { label: 'Chief Complaint',value: visit.chief_complaint },
                { label: 'Registered At',  value: fmt(visit.registered_at) },
                { label: 'Registered By',  value: visit.registered_by_name },
              ]} />
            </JourneyStop>

            <JourneyStop
              icon={<Activity className="w-5 h-5" style={{ color: visit.triaged_at ? '#D97706' : '#CBD5E1' }} />}
              accentColor="#D97706" accentBg="rgba(217,119,6,0.06)"
              title="Nurse Triage"
              subtitle="Nurse records vital signs and assigns a doctor"
              time={visit.triaged_at}
              actor={visit.triage_nurse_name}
              actorRole={visit.triage_nurse_name ? 'nurse' : undefined}
              duration={elapsedMin(visit.registered_at, visit.triaged_at)}
              targetMin={stageTargets[1] ?? 10}
              isComplete={!!visit.triaged_at}
              isPending={!visit.triaged_at && !visit.consultation_started_at}
              isActive={activeStop === 'triage'}
            >
              {visit.vitals ? (
                <div>
                  <VitalsGrid vitals={visit.vitals} />
                  {visit.vitals.triage_notes && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#92400E' }}>Triage Notes</p>
                      <p className="text-xs text-gray-700">{visit.vitals.triage_notes}</p>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <button
                        onClick={() => navigate(`/visits/${visit.id}/triage`)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#D97706' }}
                      >
                        <span>Update Triage</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : isAdmin && activeStop === 'triage' ? (
                <button
                  onClick={() => navigate(`/visits/${visit.id}/triage`)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#D97706' }}
                >
                  <span>Triage Patient Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : undefined}
            </JourneyStop>

            <JourneyStop
              icon={<Clock className="w-5 h-5" style={{ color: visit.consultation_started_at ? '#2563EB' : visit.triaged_at ? '#2563EB' : '#CBD5E1' }} />}
              accentColor="#2563EB" accentBg="rgba(37,99,235,0.06)"
              title="Waiting for Doctor"
              subtitle={visit.assigned_doctor_name ? `Assigned to ${visit.assigned_doctor_name}` : 'Awaiting doctor assignment'}
              time={visit.triaged_at}
              actor={visit.assigned_doctor_name}
              actorRole={visit.assigned_doctor_name ? 'doctor' : undefined}
              duration={elapsedMin(visit.triaged_at ?? visit.registered_at, visit.consultation_started_at)}
              targetMin={stageTargets[2] ?? 15}
              isComplete={!!visit.consultation_started_at}
              isPending={!visit.triaged_at}
              isActive={activeStop === 'waiting'}
            >
              {isAdmin && activeStop === 'waiting' ? (
                <button
                  onClick={() => navigate(`/visits/${visit.id}?tab=consultation`)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#2563EB' }}
                >
                  <span>Open Consultation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : undefined}
            </JourneyStop>

            <JourneyStop
              icon={<Stethoscope className="w-5 h-5" style={{ color: visit.consultation_started_at ? '#7C3AED' : '#CBD5E1' }} />}
              accentColor="#7C3AED" accentBg="rgba(124,58,237,0.06)"
              title="Doctor Consultation"
              subtitle={visit.consultation_room ? `Room ${visit.consultation_room}` : undefined}
              time={visit.consultation_started_at}
              actor={visit.assigned_doctor_name}
              actorRole={visit.assigned_doctor_name ? 'doctor' : undefined}
              duration={elapsedMin(visit.consultation_started_at, visit.consultation_ended_at)}
              targetMin={stageTargets[3] ?? 30}
              isComplete={!!visit.consultation_started_at}
              isPending={!visit.consultation_started_at}
              isActive={activeStop === 'consultation'}
            >
              <div className="space-y-3">
                <InfoGrid items={[
                  { label: 'Doctor',            value: visit.assigned_doctor_name },
                  { label: 'Room',              value: visit.consultation_room },
                  { label: 'Assisting Nurse',   value: visit.consultation_nurse_name },
                  { label: 'Started',           value: fmt(visit.consultation_started_at) },
                  { label: 'Ended',             value: fmt(visit.consultation_ended_at) },
                  { label: 'Duration',          value: elapsedMin(visit.consultation_started_at, visit.consultation_ended_at) != null ? fmtDuration(elapsedMin(visit.consultation_started_at, visit.consultation_ended_at)!) : undefined },
                ]} />
                {(visit.clinical_findings || visit.diagnosis || visit.recommendations || visit.follow_up_instructions) && (
                  <div className="pt-3 border-t border-purple-200 space-y-2">
                    {visit.clinical_findings && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B21A8' }}>Clinical Findings</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{visit.clinical_findings}</p>
                      </div>
                    )}
                    {visit.diagnosis && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B21A8' }}>Diagnosis</p>
                        <p className="text-xs font-semibold text-gray-800">{visit.diagnosis}</p>
                      </div>
                    )}
                    {visit.recommendations && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B21A8' }}>Recommendations</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{visit.recommendations}</p>
                      </div>
                    )}
                    {visit.follow_up_instructions && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B21A8' }}>Follow-up</p>
                        <p className="text-xs text-gray-700">{visit.follow_up_instructions}</p>
                      </div>
                    )}
                  </div>
                )}
                {isAdmin && (activeStop === 'consultation' || visit.status === 'in_consultation') && (
                  <div className="pt-3 border-t border-purple-200">
                    <button
                      onClick={() => navigate(`/visits/${visit.id}?tab=consultation`)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: '#7C3AED' }}
                    >
                      <span>Record Consultation Notes</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </JourneyStop>

            <JourneyStop
              icon={<Shield className="w-5 h-5" style={{ color: prescriptions.length ? '#0284C7' : '#CBD5E1' }} />}
              accentColor="#0284C7" accentBg="rgba(2,132,199,0.06)"
              title={prescriptions.length > 0
                ? `Medications & Safety Review (${prescriptions.length})`
                : 'Medications & Safety Review'}
              subtitle="Prescriptions ordered by the doctor, safety-checked before dispensing"
              isComplete={prescriptions.some(p => ['verified', 'dispensed', 'administered'].includes(p.status))}
              isPending={prescriptions.length === 0}
              isActive={activeStop === 'prescription'}
            >
              {prescriptions.length === 0 ? (
                <p className="text-xs italic" style={{ color: '#94A3B8' }}>No prescriptions recorded for this visit.</p>
              ) : (
                <div className="space-y-4">
                  {(totalFlags > 0 || slaBreaches > 0) && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#DC2626' }} />
                      <p className="text-xs font-semibold" style={{ color: '#991B1B' }}>
                        {totalFlags > 0 && `${totalFlags} audit flag${totalFlags > 1 ? 's' : ''} raised by PAS`}
                        {totalFlags > 0 && slaBreaches > 0 && '  Â·  '}
                        {slaBreaches > 0 && `${slaBreaches} SLA breach${slaBreaches > 1 ? 'es' : ''} recorded`}
                      </p>
                    </div>
                  )}
                  {prescriptions.map(rx => <PrescriptionAuditCard key={rx.id} rx={rx} />)}
                </div>
              )}
            </JourneyStop>

            {(visit.admitted_at || ['admitted', 'in_ward', 'ready_for_discharge'].includes(visit.status)) && (
              <JourneyStop
                icon={<BedDouble className="w-5 h-5" style={{ color: visit.admitted_at ? '#059669' : '#CBD5E1' }} />}
                accentColor="#059669" accentBg="rgba(5,150,105,0.06)"
                title="Ward Admission"
                time={visit.admitted_at}
                duration={elapsedMin(visit.consultation_ended_at ?? visit.consultation_started_at, visit.admitted_at)}
                isComplete={!!visit.admitted_at}
                isPending={!visit.admitted_at}
                isActive={activeStop === 'ward'}
              >
                <InfoGrid items={[
                  { label: 'Ward',            value: visit.ward_name },
                  { label: 'Bed',             value: visit.bed_label ?? visit.bed_id },
                  { label: 'Admitted At',     value: fmt(visit.admitted_at) },
                  { label: 'Admission Notes', value: visit.admission_notes },
                ]} />
              </JourneyStop>
            )}

            {bills.length > 0 && (
              <JourneyStop
                icon={<Receipt className="w-5 h-5" style={{ color: '#D97706' }} />}
                accentColor="#D97706" accentBg="rgba(217,119,6,0.06)"
                title="Billing"
                time={bills[0]?.created_at}
                isComplete={bills.some(b => b.status === 'paid')}
                isActive={activeStop === 'billing'}
              >
                <div className="space-y-3">
                  {bills.map(bill => (
                    <div key={bill._id} className="space-y-2">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Total Billed', value: `KES ${(bill.total_amount || 0).toLocaleString()}` },
                          { label: 'Paid',         value: `KES ${(bill.paid_amount  || 0).toLocaleString()}` },
                          { label: 'Balance',      value: `KES ${(bill.balance_due  || 0).toLocaleString()}` },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-[10px] font-bold uppercase" style={{ color: '#D97706' }}>{label}</p>
                            <p className="text-xs font-bold text-gray-800">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                          style={{ background: bill.status === 'paid' ? '#F0FDF4' : '#FFFBEB', color: bill.status === 'paid' ? '#166534' : '#92400E' }}
                        >
                          {bill.status}
                        </span>
                        {bill.payments.length > 0 && (
                          <span className="text-xs text-gray-500">{bill.payments.length} payment(s)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </JourneyStop>
            )}

            <JourneyStop
              icon={<LogOut className="w-5 h-5" style={{ color: visit.discharged_at ? '#059669' : '#CBD5E1' }} />}
              accentColor="#059669" accentBg="rgba(5,150,105,0.06)"
              title={isCancelled ? 'Visit Cancelled' : 'Discharge'}
              time={visit.discharged_at}
              duration={elapsedMin(
                visit.admitted_at ?? visit.billing_completed_at ?? visit.consultation_ended_at ?? visit.registered_at,
                visit.discharged_at,
              )}
              isComplete={!!visit.discharged_at || isCancelled}
              isPending={!visit.discharged_at && !isCancelled}
              isActive={activeStop === 'discharge'}
              isLast
            >
              {(visit.discharge_notes || visit.discharged_at) ? (
                <InfoGrid items={[
                  { label: 'Discharged At',       value: fmt(visit.discharged_at) },
                  { label: 'Total Visit Duration', value: totalMin != null ? fmtDuration(totalMin) : undefined },
                  { label: 'Discharge Notes',      value: visit.discharge_notes },
                ]} />
              ) : undefined}
            </JourneyStop>

          </div>{/* end timeline */}

          <div className="col-span-4 space-y-4">
            <div className="rounded-2xl bg-white border border-gray-200 p-5 sticky top-4 space-y-5">

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Visit Summary</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Patient',  value: visit.patient_name },
                    { label: 'Visit #',  value: visit.visit_number },
                    { label: 'Type',     value: visit.visit_type.replace(/_/g, ' ') },
                    { label: 'Status',   value: STATUS_LABEL[visit.status] ?? visit.status },
                    { label: 'Priority', value: visit.priority },
                  ].filter(r => r.value).map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{label}</span>
                      <span className="text-xs font-semibold text-gray-800 capitalize">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Timeline</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Arrived',      time: visit.registered_at,           color: '#2563EB' },
                    { label: 'Triaged',      time: visit.triaged_at,              color: '#D97706' },
                    { label: 'Seen by Doctor', time: visit.consultation_started_at, color: '#7C3AED' },
                    { label: 'Admitted',     time: visit.admitted_at,             color: '#059669' },
                    { label: 'Discharged',   time: visit.discharged_at,           color: '#059669' },
                  ].filter(t => t.time).map(({ label, time, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-xs text-gray-500">{label}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-gray-700">{fmtTime(time)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {journey && journey.stages.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">TAT vs Target</h4>
                  </div>
                  <div className="space-y-3">
                    {journey.stages.map(stage => {
                      const has      = stage.tat_min !== undefined;
                      const breached = has && stage.tat_min! > stage.target_min;
                      const pct      = has ? Math.min((stage.tat_min! / stage.target_min) * 100, 100) : 0;
                      return (
                        <div key={stage.stage}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 truncate mr-2">{stage.name}</span>
                            <span
                              className="text-xs font-bold tabular-nums flex-shrink-0 flex items-center gap-1"
                              style={{ color: has ? (breached ? '#DC2626' : '#059669') : '#94A3B8' }}
                            >
                              {has ? fmtDuration(stage.tat_min!) : 'â€”'}
                              {breached && <AlertTriangle className="w-3 h-3" />}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: breached ? '#DC2626' : '#059669' }}
                            />
                          </div>
                          <p className="text-[10px] text-right mt-0.5" style={{ color: '#94A3B8' }}>
                            target: {fmtDuration(stage.target_min)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {prescriptions.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">PAS Summary</h4>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Prescriptions', value: prescriptions.length, color: '#2563EB', danger: false },
                      { label: 'Audit Flags',   value: totalFlags,           color: totalFlags  > 0 ? '#DC2626' : '#059669', danger: totalFlags  > 0 },
                      { label: 'SLA Breaches',  value: slaBreaches,          color: slaBreaches > 0 ? '#DC2626' : '#059669', danger: slaBreaches > 0 },
                      { label: 'Audited',       value: auditedRx,            color: '#059669',  danger: false },
                    ].map(({ label, value, color, danger }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                        style={{ background: danger && value > 0 ? '#FEF2F2' : '#F8FAFC' }}
                      >
                        <span className="text-xs text-gray-500">{label}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && !isComplete && !isCancelled && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-3.5 h-3.5 text-blue-500" />
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quick Actions</h4>
                  </div>
                  <div className="space-y-2">
                    {visit.status === 'registered' && (
                      <button
                        onClick={() => navigate(`/visits/${visit.id}/triage`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#D97706' }}
                      >
                        <span>Triage Patient</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {['waiting_for_doctor', 'triaged'].includes(visit.status) && (
                      <button
                        onClick={() => navigate(`/visits/${visit.id}?tab=consultation`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#7C3AED' }}
                      >
                        <span>Start Consultation</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {visit.status === 'in_consultation' && (
                      <button
                        onClick={() => navigate(`/visits/${visit.id}?tab=consultation`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#7C3AED' }}
                      >
                        <span>Record Consultation Notes</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {['in_consultation', 'awaiting_results', 'treatment_in_progress'].includes(visit.status) && !visit.admitted_at && (
                      <button
                        onClick={() => navigate(`/visits/${visit.id}?tab=care`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#059669' }}
                      >
                        <span>Admit to Ward</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {['admitted', 'in_ward'].includes(visit.status) && (
                      <button
                        onClick={() => navigate(`/visits/${visit.id}?tab=prescriptions`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#0284C7' }}
                      >
                        <span>Manage Prescriptions</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {['in_ward', 'ready_for_discharge', 'admitted'].includes(visit.status) && (
                      <button
                        onClick={() => navigate(`/visits/${visit.id}?tab=billing`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#D97706' }}
                      >
                        <span>Billing / Discharge</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!visit.billing_completed_at && (visit.consultation_ended_at || visit.admitted_at) &&
                     !['admitted', 'in_ward', 'ready_for_discharge'].includes(visit.status) && (
                      <button
                        onClick={() => navigate(`/visits/${visit.id}?tab=billing`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: '#D97706' }}
                      >
                        <span>Process Billing</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                <Link
                  to={`/visits/${visit.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> View Full Visit Record
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
